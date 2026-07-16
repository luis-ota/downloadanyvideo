# DownloadAnyVideo

**→ https://downloadanyvideo.wired.rs**

Extrai vídeos de links e exibe todas as qualidades disponíveis para play/download.

**Stack:** Rust (Axum) + React (Vite, TypeScript) + yt-dlp + deno + Docker

### Como funciona

1. Cole um link de vídeo (YouTube, Vimeo, etc.)
2. O backend executa `yt-dlp -J` para extrair metadados e URLs diretas
3. O frontend exibe a lista de formatos (qualidade, codec, tamanho)
4. Clique em **Play** ou **Download** para abrir o vídeo

### Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/extract` | Envia `{"url":"..."}` e recebe `{title, thumbnail, duration, formats}` |

### Desenvolvimento

```bash
# Backend
cd backend
cargo run

# Frontend
cd frontend
bun install
bun run dev
```

### Produção (Docker)

```bash
docker compose up --build -d
```

### Deploy

```bash
git push
ssh servidor "cd ~/downloadanyvideo && git pull && docker compose up --build -d"
```

### SmartLink

O projeto usa SmartLink da Adterra — o primeiro clique em Play/Download após cada extração abre um anúncio em nova aba.

### Notas

- `deno` está instalado no container backend porque o yt-dlp precisa de um runtime JS para resolver o desafio JavaScript do YouTube (EJS).
- O backend usa ffmpeg para mesclar streams de vídeo/áudio quando necessário.
- A API é restrita por header `Origin` — apenas o domínio de produção e `localhost` são permitidos.
