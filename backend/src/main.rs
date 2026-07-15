use axum::{Json, Router, http::StatusCode, routing::post};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tower_http::cors::{Any, CorsLayer};

#[derive(Deserialize)]
struct ExtractRequest {
    url: String,
}

#[derive(Serialize)]
struct FormatInfo {
    id: String,
    quality: String,
    ext: String,
    url: String,
    size: Option<u64>,
    has_audio: bool,
    codec: String,
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

async fn extract(
    Json(req): Json<ExtractRequest>,
) -> Result<Json<ExtractResponse>, (StatusCode, Json<ErrorResponse>)> {
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
    let data: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to parse yt-dlp output: {e}"),
                }),
            )
        })?;

    let title = data["title"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();
    let thumbnail = data["thumbnail"].as_str().map(String::from);
    let duration = data["duration"].as_f64();

    let mut formats: Vec<FormatInfo> = Vec::new();

    if let Some(fmts) = data["formats"].as_array() {
        for fmt in fmts {
            let vcodec = fmt["vcodec"].as_str().unwrap_or("none");
            let acodec = fmt["acodec"].as_str().unwrap_or("none");
            let url = fmt["url"].as_str().unwrap_or("");

            if url.is_empty() || (vcodec == "none" && acodec == "none") {
                continue;
            }

            let height = fmt["height"].as_u64().unwrap_or(0);
            let format_note = fmt["format_note"].as_str().unwrap_or("");

            let quality: String = if vcodec == "none" {
                let abitrate = fmt["abr"].as_f64().unwrap_or(0.0) as u64;
                if abitrate > 0 {
                    format!("{}k", abitrate)
                } else {
                    "áudio".into()
                }
            } else if !format_note.is_empty() && format_note != "Unknown" {
                format_note.to_string()
            } else {
                match height {
                    2160.. => "4K".into(),
                    1440.. => "1440p".into(),
                    1080.. => "1080p".into(),
                    720.. => "720p".into(),
                    480.. => "480p".into(),
                    360.. => "360p".into(),
                    _ => format!("{}p", height),
                }
            };

            let size = fmt["filesize"]
                .as_u64()
                .or_else(|| fmt["filesize_approx"].as_u64());

            formats.push(FormatInfo {
                id: fmt["format_id"].as_str().unwrap_or("").to_string(),
                quality,
                ext: fmt["ext"].as_str().unwrap_or("").to_string(),
                url: url.to_string(),
                size,
                has_audio: acodec != "none",
                codec: if vcodec != "none" {
                    vcodec.to_string()
                } else {
                    format!("aac")
                },
            });
        }
    }

    formats.sort_by(|a, b| {
        b.has_audio.cmp(&a.has_audio).then_with(|| {
            let aq = a.quality.parse::<u64>().unwrap_or(0);
            let bq = b.quality.parse::<u64>().unwrap_or(0);
            bq.cmp(&aq)
        })
    });

    if formats.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No video formats found".into(),
            }),
        ));
    }

    Ok(Json(ExtractResponse {
        title,
        thumbnail,
        duration,
        formats,
    }))
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/extract", post(extract))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("Failed to bind to port 3001");

    println!("Backend running on http://0.0.0.0:3001");
    axum::serve(listener, app).await.unwrap();
}
