use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tokio_util::io::ReaderStream;
use tower_http::cors::{AllowOrigin, CorsLayer};

type HmacSha256 = Hmac<Sha256>;

const UA: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

struct AppState {
    client: reqwest::Client,
    key: Vec<u8>,
}

#[derive(Deserialize)]
struct ExtractRequest {
    url: String,
}

#[derive(Serialize)]
struct FormatInfo {
    id: String,
    quality: String,
    ext: String,
    size: Option<u64>,
    has_audio: bool,
    codec: String,
    kind: String,
    height: Option<u64>,
    play: String,
    download: String,
}

#[derive(Serialize)]
struct ExtractResponse {
    title: String,
    thumbnail: Option<String>,
    duration: Option<f64>,
    formats: Vec<FormatInfo>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

struct Bruto {
    id: String,
    quality: String,
    ext: String,
    url: String,
    size: Option<u64>,
    has_audio: bool,
    has_video: bool,
    height: Option<u64>,
    abr: f64,
    codec: String,
}

const ALLOWED_ORIGINS: [&str; 3] = [
    "https://downloadanyvideo.wired.rs",
    "http://localhost:3010",
    "http://localhost:5173",
];

fn check_origin(headers: &HeaderMap) -> bool {
    let origin = headers
        .get("origin")
        .or_else(|| headers.get("referer"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if origin.is_empty() {
        return false;
    }
    ALLOWED_ORIGINS.iter().any(|o| origin.starts_with(o))
}

fn assinar(key: &[u8], dados: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("hmac key");
    mac.update(dados.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn url_midia(key: &[u8], url: &str, nome: &str, baixar: bool) -> String {
    format!(
        "/api/media?u={}&n={}&sig={}&d={}",
        urlencoding::encode(url),
        urlencoding::encode(nome),
        assinar(key, url),
        if baixar { 1 } else { 0 }
    )
}

fn url_merge(key: &[u8], v: &str, a: &str, nome: &str, baixar: bool) -> String {
    let payload = format!("{v}\n{a}");
    format!(
        "/api/merge?v={}&a={}&n={}&sig={}&d={}",
        urlencoding::encode(v),
        urlencoding::encode(a),
        urlencoding::encode(nome),
        assinar(key, &payload),
        if baixar { 1 } else { 0 }
    )
}

fn referer_para(url: &str) -> Option<&'static str> {
    if url.contains("googlevideo.com") || url.contains("youtube.com") {
        Some("https://www.youtube.com/")
    } else if url.contains("tiktok") {
        Some("https://www.tiktok.com/")
    } else if url.contains("cdninstagram") || url.contains("fbcdn") {
        Some("https://www.instagram.com/")
    } else {
        None
    }
}

fn nome_seguro(nome: &str) -> String {
    let limpo: String = nome
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if limpo.is_empty() {
        "downloadanyvideo".to_string()
    } else {
        limpo.chars().take(80).collect()
    }
}

async fn extract(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<ExtractRequest>,
) -> Result<Json<ExtractResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !check_origin(&headers) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Access denied".into(),
            }),
        ));
    }

    if req.url.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "URL is required".into(),
            }),
        ));
    }

    let url = req.url.trim().to_string();

    let cmd = timeout(
        Duration::from_secs(120),
        Command::new("yt-dlp")
            .arg("-J")
            .arg("--no-warnings")
            .arg("--no-check-certificates")
            .arg("--no-js-runtimes")
            .arg("--js-runtimes")
            .arg("bun")
            .arg(&url)
            .output(),
    )
    .await
    .map_err(|_| {
        (
            StatusCode::GATEWAY_TIMEOUT,
            Json(ErrorResponse {
                error: "Request timed out (120s)".into(),
            }),
        )
    })?
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to run yt-dlp: {e}"),
            }),
        )
    })?;

    if !cmd.status.success() {
        let stderr = String::from_utf8_lossy(&cmd.stderr);
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("yt-dlp error: {stderr}"),
            }),
        ));
    }

    let stdout = String::from_utf8_lossy(&cmd.stdout);
    let data: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to parse yt-dlp output: {e}"),
            }),
        )
    })?;

    let title = data["title"].as_str().unwrap_or("Unknown").to_string();
    let thumbnail = data["thumbnail"].as_str().map(String::from);
    let duration = data["duration"].as_f64();

    let mut brutos: Vec<Bruto> = Vec::new();

    if let Some(fmts) = data["formats"].as_array() {
        for fmt in fmts {
            let vcodec = fmt["vcodec"].as_str().unwrap_or("none");
            let acodec = fmt["acodec"].as_str().unwrap_or("none");
            let url = fmt["url"].as_str().unwrap_or("");

            if url.is_empty() || (vcodec == "none" && acodec == "none") {
                continue;
            }

            // manifests (HLS/DASH) não são arquivos: o proxy não consegue servir como mídia
            if url.contains(".m3u8") || url.contains(".mpd") || url.contains("/manifest/") {
                continue;
            }

            let height = fmt["height"].as_u64();
            let format_note = fmt["format_note"].as_str().unwrap_or("");
            let has_video = vcodec != "none";
            let has_audio = acodec != "none";

            let quality: String = if !has_video {
                let abitrate = fmt["abr"].as_f64().unwrap_or(0.0) as u64;
                if abitrate > 0 {
                    format!("{}k", abitrate)
                } else {
                    "áudio".into()
                }
            } else if !format_note.is_empty() && format_note != "Unknown" {
                format_note.to_string()
            } else {
                match height.unwrap_or(0) {
                    2160.. => "4K".into(),
                    1440.. => "1440p".into(),
                    1080.. => "1080p".into(),
                    720.. => "720p".into(),
                    480.. => "480p".into(),
                    360.. => "360p".into(),
                    h => format!("{}p", h),
                }
            };

            let size = fmt["filesize"]
                .as_u64()
                .or_else(|| fmt["filesize_approx"].as_u64());

            brutos.push(Bruto {
                id: fmt["format_id"].as_str().unwrap_or("").to_string(),
                quality,
                ext: fmt["ext"].as_str().unwrap_or("").to_string(),
                url: url.to_string(),
                size,
                has_audio,
                has_video,
                height,
                abr: fmt["abr"].as_f64().unwrap_or(0.0),
                codec: if has_video { vcodec } else { acodec }.to_string(),
            });
        }
    }

    if brutos.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No video formats found".into(),
            }),
        ));
    }

    // melhor faixa de áudio para casar com vídeos sem som
    let melhor_audio = brutos
        .iter()
        .filter(|f| !f.has_video && f.has_audio)
        .max_by(|a, b| {
            (a.ext == "m4a")
                .cmp(&(b.ext == "m4a"))
                .then(a.abr.partial_cmp(&b.abr).unwrap_or(std::cmp::Ordering::Equal))
        });

    let mut formats: Vec<FormatInfo> = Vec::new();

    for b in &brutos {
        let extensao = if b.ext.is_empty() { "bin" } else { &b.ext };
        let nome = nome_seguro(&format!("{}-{}.{}", title, b.quality, extensao));

        let (play, download, tamanho) = if b.has_video && !b.has_audio {
            match melhor_audio {
                Some(a) => {
                    let nome_mp4 = nome_seguro(&format!("{}-{}.mp4", title, b.quality));
                    (
                        url_merge(&st.key, &b.url, &a.url, &nome_mp4, false),
                        url_merge(&st.key, &b.url, &a.url, &nome_mp4, true),
                        b.size.map(|s| s + a.size.unwrap_or(0)),
                    )
                }
                None => (
                    url_midia(&st.key, &b.url, &nome, false),
                    url_midia(&st.key, &b.url, &nome, true),
                    b.size,
                ),
            }
        } else {
            (
                url_midia(&st.key, &b.url, &nome, false),
                url_midia(&st.key, &b.url, &nome, true),
                b.size,
            )
        };

        formats.push(FormatInfo {
            id: b.id.clone(),
            quality: b.quality.clone(),
            ext: b.ext.clone(),
            size: tamanho,
            has_audio: b.has_audio,
            codec: b.codec.clone(),
            kind: if b.has_video { "video".into() } else { "audio".into() },
            height: b.height,
            play,
            download,
        });
    }

    formats.sort_by(|a, b| {
        let por_tipo = b.kind.cmp(&a.kind);
        let por_audio = b.has_audio.cmp(&a.has_audio);
        let altura_a = a.height.unwrap_or(0);
        let altura_b = b.height.unwrap_or(0);
        por_tipo.then(por_audio).then(altura_b.cmp(&altura_a))
    });

    Ok(Json(ExtractResponse {
        title,
        thumbnail,
        duration,
        formats,
    }))
}

#[derive(Deserialize)]
struct MediaParams {
    u: String,
    sig: String,
    d: Option<u8>,
    n: Option<String>,
}

async fn media(
    State(st): State<Arc<AppState>>,
    Query(p): Query<MediaParams>,
    headers: HeaderMap,
) -> Response {
    if assinar(&st.key, &p.u) != p.sig {
        return (StatusCode::FORBIDDEN, "assinatura invalida").into_response();
    }

    let mut req = st.client.get(&p.u).header(header::USER_AGENT, UA);
    if let Some(r) = referer_para(&p.u) {
        req = req.header(header::REFERER, r);
    }
    if let Some(range) = headers.get(header::RANGE) {
        req = req.header(header::RANGE, range);
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("erro no upstream: {e}")).into_response();
        }
    };

    let status = resp.status();
    if !status.is_success() && status != StatusCode::PARTIAL_CONTENT {
        return (
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            format!("upstream respondeu {}", status),
        )
            .into_response();
    }

    let mut out = Response::builder().status(status.as_u16());
    for h in [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
    ] {
        if let Some(v) = resp.headers().get(&h) {
            out = out.header(h, v);
        }
    }

    let nome = nome_seguro(p.n.as_deref().unwrap_or("downloadanyvideo"));
    let disposition = if p.d == Some(1) {
        format!("attachment; filename=\"{nome}\"")
    } else {
        format!("inline; filename=\"{nome}\"")
    };
    out = out.header(header::CONTENT_DISPOSITION, disposition);

    let stream = resp.bytes_stream();
    out.body(Body::from_stream(stream))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "erro ao montar resposta").into_response())
}

#[derive(Deserialize)]
struct MergeParams {
    v: String,
    a: String,
    sig: String,
    d: Option<u8>,
    n: Option<String>,
}

async fn merge(
    State(st): State<Arc<AppState>>,
    Query(p): Query<MergeParams>,
) -> Response {
    let payload = format!("{}\n{}", p.v, p.a);
    if assinar(&st.key, &payload) != p.sig {
        return (StatusCode::FORBIDDEN, "assinatura invalida").into_response();
    }

    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-nostdin", "-loglevel", "error"]);
    cmd.args(["-user_agent", UA]);
    if let Some(r) = referer_para(&p.v) {
        cmd.args(["-headers", &format!("Referer: {r}\r\n")]);
    }
    cmd.arg("-i").arg(&p.v);
    cmd.args(["-user_agent", UA]);
    if let Some(r) = referer_para(&p.a) {
        cmd.args(["-headers", &format!("Referer: {r}\r\n")]);
    }
    cmd.arg("-i").arg(&p.a);
    cmd.args([
        "-c",
        "copy",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "pipe:1",
    ]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut filho = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("falha no ffmpeg: {e}"))
                .into_response();
        }
    };

    let stdout = match filho.stdout.take() {
        Some(s) => s,
        None => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "ffmpeg sem stdout").into_response();
        }
    };

    let nome = nome_seguro(p.n.as_deref().unwrap_or("downloadanyvideo.mp4"));
    let disposition = if p.d == Some(1) {
        format!("attachment; filename=\"{nome}\"")
    } else {
        format!("inline; filename=\"{nome}\"")
    };

    let stream = ReaderStream::new(stdout);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(header::CONTENT_DISPOSITION, disposition)
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "erro ao montar resposta").into_response())
}

#[tokio::main]
async fn main() {
    let mut chave = [0u8; 32];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        use std::io::Read;
        let _ = f.read_exact(&mut chave);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .expect("http client");

    let estado = Arc::new(AppState {
        client,
        key: chave.to_vec(),
    });

    let origins: Vec<axum::http::HeaderValue> = ALLOWED_ORIGINS
        .iter()
        .map(|o| o.parse().unwrap())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([axum::http::Method::POST, axum::http::Method::GET])
        .allow_headers([axum::http::HeaderName::from_static("content-type")]);

    let app = Router::new()
        .route("/api/extract", post(extract))
        .route("/api/media", get(media))
        .route("/api/merge", get(merge))
        .layer(cors)
        .with_state(estado);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("Failed to bind to port 3001");

    println!("Backend running on http://0.0.0.0:3001");
    axum::serve(listener, app).await.unwrap();
}
