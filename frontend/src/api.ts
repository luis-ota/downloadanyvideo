export interface Format {
  id: string
  quality: string
  ext: string
  url: string
  size: number | null
  has_audio: boolean
  codec: string
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
