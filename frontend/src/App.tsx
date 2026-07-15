import { useState, useCallback, useRef } from 'react'
import { extractVideo, type VideoResult, type Format } from './api'

const SMARTLINK = "https://www.effectivecpmnetwork.com/tfm84s4e6a?key=a0917091db28caa0a680bad911c9473b"

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VideoResult | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const smartlinkReady = useRef(true)

  const smartlinkClick = useCallback(() => {
    if (smartlinkReady.current) {
      smartlinkReady.current = false
      window.open(SMARTLINK, '_blank')
    }
  }, [])

  const resetSmartlink = useCallback(() => {
    smartlinkReady.current = true
  }, [])

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

  const handlePlay = (fmt: Format) => {
    smartlinkClick()
    setPlayingUrl(fmt.url)
  }

  const handleDownload = (fmt: Format) => {
    smartlinkClick()
    const a = document.createElement('a')
    a.href = fmt.url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const formatSize = (b: number | null) => {
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
          <p>Cole o link e veja todas as qualidades disponíveis.</p>

          <div className="input-area">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Cole um link de vídeo..."
              onKeyDown={e => e.key === 'Enter' && handleExtract()}
              className="url-input"
            />
            <button onClick={handleExtract} disabled={loading} className="btn primary">
              {loading ? 'Processando…' : 'Buscar'}
            </button>
          </div>
        </section>

        {error && <div className="error">{error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Extraindo informações…</p>
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
                  <span className="duration">{formatDuration(result.duration)}</span>
                )}
              </div>
            </div>

            <div className="formats">
              {result.formats.map((fmt, i) => (
                <div key={`${fmt.id}-${i}`} className="format-card">
                  <div className="format-info">
                    <span className="quality">{fmt.quality || fmt.ext}</span>
                    <span className="ext">{fmt.ext}</span>
                    {fmt.has_audio ? (
                      <span className="badge badge-audio">áudio</span>
                    ) : (
                      <span className="badge badge-video">só video</span>
                    )}
                    {fmt.size && <span className="size">{formatSize(fmt.size)}</span>}
                  </div>
                  <div className="format-actions">
                    <button className="btn ghost" onClick={() => handlePlay(fmt)}>▶ Play</button>
                    <button className="btn ghost" onClick={() => handleDownload(fmt)}>⬇ Download</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>DownloadAnyVideo</span>
        <span className="sep">·</span>
        <span>conteúdo público e licenciado</span>
      </footer>

      {playingUrl && (
        <div className="modal-overlay" onClick={() => setPlayingUrl(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlayingUrl(null)}>✕</button>
            <video controls autoPlay className="video-player" src={playingUrl} />
          </div>
        </div>
      )}
    </div>
  )
}
