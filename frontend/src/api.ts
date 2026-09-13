export interface Format {
  id: string
  quality: string
  ext: string
  size: number | null
  has_audio: boolean
  codec: string
  kind: 'video' | 'audio'
  height: number | null
  play: string
  download: string
}

export interface VideoResult {
  title: string
  thumbnail: string | null
  duration: number | null
  formats: Format[]
}

export async function extractVideo(url: string): Promise<VideoResult> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function curarFormatos(formats: Format[]) {
  const videos = formats.filter(f => f.kind === 'video')
  const audios = formats
    .filter(f => f.kind === 'audio')
    .sort((a, b) => (b.ext === 'm4a' ? 1 : 0) - (a.ext === 'm4a' ? 1 : 0) || (b.size ?? 0) - (a.size ?? 0))

  const porAltura = new Map<number, Format>()
  for (const v of videos) {
    const altura = v.height ?? 0
    const atual = porAltura.get(altura)
    if (!atual) {
      porAltura.set(altura, v)
      continue
    }
    const pontos = (f: Format) => (f.has_audio ? 100 : 0) + (f.ext === 'mp4' ? 10 : 0)
    if (pontos(v) > pontos(atual)) porAltura.set(altura, v)
  }

  const melhoresVideos = [...porAltura.values()]
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
    .slice(0, 8)

  return {
    videos: melhoresVideos,
    audios: audios.slice(0, 3),
    total: formats.length,
  }
}
