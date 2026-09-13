import { useState, useRef } from 'react'
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
    if (!url.trim()) return
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

  const openUrl = (url: string) => {
    smartlinkClick()
    window.open(url, '_blank', 'noopener')
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
    <div className="container">
      <header className="header">
        <span className="brand">DownloadAnyVideo</span>
      </header>

      <main>
        <section className="hero">
          <h1>Baixe vídeos de <span>qualquer lugar</span></h1>
          <p>Cole o link e veja todas as qualidades disponíveis para download.</p>

          <div className="input-area">
            <span className="prompt">$</span>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="cole um link de vídeo..."
              onKeyDown={e => e.key === 'Enter' && handleExtract()}
              className="url-input"
              spellCheck={false}
              autoFocus
            />
            <button onClick={handleExtract} disabled={loading} className="btn-search">
              {loading ? '…' : '→'}
            </button>
          </div>
        </section>

        {error && <div className="error">{error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Extraindo informações…</span>
          </div>
        )}

        {result && (
          <section className="result">
            <div className="video-header">
              {result.thumbnail && (
                <img src={result.thumbnail} alt="" className="thumbnail" />
              )}
              <div className="video-meta">
                <h2 className="video-title">{result.title}</h2>
                {result.duration && (
                  <span className="duration">{fmtDuration(result.duration)}</span>
                )}
              </div>
            </div>

            <div className="formats">
              {result.formats.map((fmt, i) => (
                <div key={`${fmt.id}-${i}`} className="format-row">
                  <div className="format-info">
                    <span className="quality">{fmt.quality}</span>
                    <span className="ext">{fmt.ext}</span>
                    {!fmt.has_audio && <span className="audio-note">sem áudio</span>}
                    {fmt.size != null && <span className="size">{fmtSize(fmt.size)}</span>}
                  </div>
                  <div className="format-actions">
                    <button className="btn-action" onClick={() => openUrl(fmt.url)}>▶ Play</button>
                    <button className="btn-action" onClick={() => openUrl(fmt.url)}>⬇ Download</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>DownloadAnyVideo · conteúdo público e licenciado</span>
        <span aria-hidden="true">·</span>
        <a href="https://portfolio.wired.rs/" target="_blank" rel="noopener">desenvolvido por Wired Layer Co.</a>
      </footer>
    </div>
  )
}
