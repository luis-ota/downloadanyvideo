import { useMemo, useRef, useState } from 'react'
import { curarFormatos, extractVideo, type Format, type VideoResult } from './api'

const SMARTLINK = "https://www.effectivecpmnetwork.com/tfm84s4e6a?key=a0917091db28caa0a680bad911c9473b"

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VideoResult | null>(null)
  const [todos, setTodos] = useState(false)
  const smartlinkReady = useRef(true)

  const curadoria = useMemo(() => (result ? curarFormatos(result.formats) : null), [result])

  const tentarSmartlink = () => {
    if (!smartlinkReady.current) return
    smartlinkReady.current = false
    try {
      window.open(SMARTLINK, '_blank')
    } catch {
      // popup bloqueado: a midia ja foi aberta
    }
  }

  const abrirMidia = (link: string, baixar: boolean) => {
    if (baixar) {
      const a = document.createElement('a')
      a.href = link
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } else {
      window.open(link, '_blank', 'noopener')
    }
    tentarSmartlink()
  }

  const handleExtract = async () => {
    if (!url.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setTodos(false)
    try {
      const data = await extractVideo(url)
      setResult(data)
      smartlinkReady.current = true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao extrair vídeo')
    } finally {
      setLoading(false)
    }
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

  const linha = (fmt: Format, i: number, compacta = false) => (
    <li key={`${fmt.id}-${i}`} className={compacta ? 'formato formato-compacto' : 'formato'}>
      <span className="formato-numero" aria-hidden="true">
        {String(i + 1).padStart(2, '0')}
      </span>
      <span className="formato-qualidade">{fmt.quality}</span>
      <span className="formato-fichas">
        <span className="ficha-tag">{fmt.ext}</span>
        <span className={fmt.has_audio ? 'ficha-tag ficha-ok' : 'ficha-tag ficha-muda'}>
          {fmt.has_audio ? 'áudio' : 'sem áudio'}
        </span>
        {fmt.size != null && <span className="ficha-tamanho">{fmtSize(fmt.size)}</span>}
      </span>
      <span className="formato-acoes">
        <button className="btn-acao" onClick={() => abrirMidia(fmt.play, false)}>
          play <span aria-hidden="true">▶</span>
        </button>
        <button className="btn-acao btn-acao-cheio" onClick={() => abrirMidia(fmt.download, true)}>
          baixar <span aria-hidden="true">↓</span>
        </button>
      </span>
    </li>
  )

  const take = result ? String(result.formats.length).padStart(2, '0') : '00'

  return (
    <div className="sala">
      <header className="cabeca">
        <a className="marca" href="/">
          <span className="marca-luz" aria-hidden="true" />
          <span className="marca-nome">downloadanyvideo</span>
        </a>
        <a className="marca-por" href="https://wired.rs/" target="_blank" rel="noopener">
          wired layer co. <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="palco">
        <section className="abertura">
          <p className="ficha" aria-hidden="true">
            youtube · tiktok · instagram · vimeo · x · soundcloud
          </p>
          <h1 className="titulo">
            Cole o link.
            <br />
            <em>Leve o vídeo.</em>
          </h1>
          <p className="linha-fina">
            Extraímos as melhores qualidades do vídeo: escolha o formato, dê play ou baixe.
            Sem cadastro, sem instalar nada.
          </p>

          <div className="bilhete">
            <label className="bilhete-rotulo" htmlFor="url">
              link do vídeo
            </label>
            <div className="bilhete-linha">
              <input
                id="url"
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={e => e.key === 'Enter' && handleExtract()}
                className="bilhete-campo"
                spellCheck={false}
                autoFocus
              />
              <button onClick={handleExtract} disabled={loading || !url.trim()} className="btn-extrair">
                {loading ? 'revelando' : 'extrair'}
                <span aria-hidden="true">{loading ? '…' : '→'}</span>
              </button>
            </div>
          </div>

          {error && (
            <p className="falha" role="alert">
              <span className="falha-marca" aria-hidden="true">TAKE FALHOU</span>
              {error}
            </p>
          )}
        </section>

        <div className="pelicula" aria-hidden="true">
          <div className="tira">
            <span>download any video</span><i>◆</i>
            <span>youtube</span><i>◆</i>
            <span>tiktok</span><i>◆</i>
            <span>instagram</span><i>◆</i>
            <span>vimeo</span><i>◆</i>
            <span>x</span><i>◆</i>
            <span>soundcloud</span><i>◆</i>
            <span>download any video</span><i>◆</i>
            <span>youtube</span><i>◆</i>
            <span>tiktok</span><i>◆</i>
            <span>instagram</span><i>◆</i>
            <span>vimeo</span><i>◆</i>
            <span>x</span><i>◆</i>
            <span>soundcloud</span><i>◆</i>
          </div>
        </div>

        {loading && (
          <section className="revelando" aria-live="polite">
            <span className="rec" aria-hidden="true" />
            <span>revelando os formatos, aguarde alguns segundos…</span>
          </section>
        )}

        {result && curadoria && (
          <section className="contacto" aria-live="polite">
            <article className="quadro">
              <div className="quadro-cena">
                {result.thumbnail ? (
                  <img src={result.thumbnail} alt="" className="quadro-imagem" loading="lazy" />
                ) : (
                  <span className="quadro-vazio" aria-hidden="true">sem quadro</span>
                )}
                <span className="quadro-take">TAKE {take}</span>
              </div>
              <div className="quadro-texto">
                <h2 className="quadro-titulo">{result.title}</h2>
                <p className="quadro-meta">
                  {result.duration ? `duração ${fmtDuration(result.duration)} · ` : ''}
                  {result.formats.length} formato{result.formats.length === 1 ? '' : 's'}
                </p>
              </div>
            </article>

            {!todos && (
              <>
                <p className="secao-rotulo">melhores qualidades de vídeo</p>
                <ul className="formatos">{curadoria.videos.map((f, i) => linha(f, i))}</ul>

                {curadoria.audios.length > 0 && (
                  <>
                    <p className="secao-rotulo">somente áudio</p>
                    <ul className="formatos">{curadoria.audios.map((f, i) => linha(f, i))}</ul>
                  </>
                )}
              </>
            )}

            {todos && (
              <>
                <p className="secao-rotulo">todos os {curadoria.total} formatos</p>
                <ul className="formatos">{result.formats.map((f, i) => linha(f, i, true))}</ul>
              </>
            )}

            <button className="btn-todos" onClick={() => setTodos(v => !v)}>
              {todos ? 'ver só as melhores' : `ver todos os ${curadoria.total} formatos`}
            </button>

            <p className="aviso">
              vídeos sem áudio são remuxados com a melhor faixa de som no servidor antes de
              baixar. play e download abrem o arquivo em uma nova aba. conteúdo público e
              licenciado: respeite os direitos dos criadores.
            </p>
          </section>
        )}
      </main>

      <footer className="rodape">
        <span className="rodape-marca">downloadanyvideo</span>
        <span className="rodape-sep" aria-hidden="true">·</span>
        <a href="https://portfolio.wired.rs/" target="_blank" rel="noopener">portfólio</a>
        <span className="rodape-sep" aria-hidden="true">·</span>
        <a href="https://github.com/luis-ota/downloadanyvideo" target="_blank" rel="noopener">github</a>
        <span className="rodape-sep" aria-hidden="true">·</span>
        <span>conteúdo público e licenciado</span>
      </footer>
    </div>
  )
}
