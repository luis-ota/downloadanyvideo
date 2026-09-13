import { useRef, useState } from 'react'
import { extractVideo, type VideoResult } from './api'

const SMARTLINK = "https://www.effectivecpmnetwork.com/tfm84s4e6a?key=a0917091db28caa0a680bad911c9473b"

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VideoResult | null>(null)
  const smartlinkReady = useRef(true)

  const smartlinkClick = () => {
    if (smartlinkReady.current) {
      smartlinkReady.current = false
      window.open(SMARTLINK, '_blank')
    }
  }

  const resetSmartlink = () => {
    smartlinkReady.current = true
  }

  const handleExtract = async () => {
    if (!url.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await extractVideo(url)
      setResult(data)
      resetSmartlink()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao extrair vídeo')
    } finally {
      setLoading(false)
    }
  }

  const openUrl = (link: string) => {
    smartlinkClick()
    window.open(link, '_blank', 'noopener')
  }

  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const fmtSize = (b: number | null) => {
    if (!b) return ''
    const mb = b / (1024 * 1024)
    if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`
    return `${mb.toFixed(0)} MB`
  }

  return (
    <div className="site">
      <header className="topo">
        <a className="marca" href="/">
          <span className="marca-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M12 8v6" />
              <path d="M9.5 11.5 12 14l2.5-2.5" />
            </svg>
          </span>
          <span className="marca-nome">downloadanyvideo</span>
        </a>
        <a className="marca-por" href="https://wired.rs/" target="_blank" rel="noopener">
          wired layer co. <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="conteudo">
        <section className="hero">
          <p className="kicker" aria-hidden="true">youtube · tiktok · instagram · vimeo · x · soundcloud</p>
          <h1>
            baixe vídeos de <em>qualquer link</em>
          </h1>
          <p className="sub">
            Cole o endereço do vídeo e escolha a qualidade. Sem cadastro, sem instalar nada,
            com as melhores qualidades disponíveis para download.
          </p>

          <div className="terminal">
            <span className="prompt" aria-hidden="true">$</span>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="cole um link de vídeo..."
              onKeyDown={e => e.key === 'Enter' && handleExtract()}
              className="url-input"
              aria-label="link do vídeo"
              spellCheck={false}
              autoFocus
            />
            <button onClick={handleExtract} disabled={loading || !url.trim()} className="btn-extrair">
              {loading ? 'extraindo' : 'extrair'}
              <span aria-hidden="true">{loading ? '…' : '→'}</span>
            </button>
          </div>

          {error && (
            <p className="erro" role="alert">
              <span className="erro-sinal" aria-hidden="true">!</span> {error}
            </p>
          )}
        </section>

        {loading && (
          <section className="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>consultando o extrator, aguarde alguns segundos…</span>
          </section>
        )}

        {result && (
          <section className="resultado" aria-live="polite">
            <header className="video">
              {result.thumbnail && (
                <img src={result.thumbnail} alt="" className="thumbnail" loading="lazy" />
              )}
              <div className="video-meta">
                <h2 className="video-titulo">{result.title}</h2>
                <p className="video-info">
                  {result.duration ? `duração ${fmtDuration(result.duration)} · ` : ''}
                  {result.formats.length} formato{result.formats.length === 1 ? '' : 's'} disponíve{result.formats.length === 1 ? 'l' : 'is'}
                </p>
              </div>
            </header>

            <ul className="formatos">
              {result.formats.map((fmt, i) => (
                <li key={`${fmt.id}-${i}`} className="formato">
                  <div className="formato-info">
                    <span className="qualidade">{fmt.quality}</span>
                    <span className="tag">{fmt.ext}</span>
                    {fmt.has_audio ? (
                      <span className="tag tag-ok">áudio</span>
                    ) : (
                      <span className="tag tag-mudo">sem áudio</span>
                    )}
                    {fmt.size != null && <span className="tamanho">{fmtSize(fmt.size)}</span>}
                  </div>
                  <div className="formato-acoes">
                    <button className="btn-acao" onClick={() => openUrl(fmt.url)}>
                      play <span aria-hidden="true">▶</span>
                    </button>
                    <button className="btn-acao btn-acao-primario" onClick={() => openUrl(fmt.url)}>
                      baixar <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="aviso">
              o play e o download abrem o arquivo em uma nova aba. conteúdo público e licenciado,
              respeite os direitos dos criadores.
            </p>
          </section>
        )}
      </main>

      <footer className="rodape">
        <span>downloadanyvideo · wired layer co.</span>
        <span aria-hidden="true">·</span>
        <a href="https://portfolio.wired.rs/" target="_blank" rel="noopener">portfólio</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/luis-ota/downloadanyvideo" target="_blank" rel="noopener">github</a>
      </footer>
    </div>
  )
}
