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

### Deploy (CI/CD)

Cada push na `master` dispara `.github/workflows/deploy.yml`, que entra por SSH na
VPS (`tools-vps`) e executa o script `/usr/local/bin/deploy-downloadanyvideo`. A
chave do Actions tem **forced command**: só consegue rodar esse script, que faz
`git fetch` + `git reset --hard origin/master`, `docker compose build --pull` e
`docker compose up -d` — o build acontece na própria VPS, sem registry de imagens.

| Secret | Valor |
|---|---|
| `DEPLOY_HOST` | `164.152.61.189` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | chave privada ed25519 com forced command na VPS |
| `DEPLOY_KNOWN_HOSTS` | saída de `ssh-keyscan -H 164.152.61.189` |

### SmartLink

O projeto usa SmartLink da Adterra — o primeiro clique em Play/Download após cada extração abre um anúncio em nova aba.

### Notas

- `deno` está instalado no container backend porque o yt-dlp precisa de um runtime JS para resolver o desafio JavaScript do YouTube (EJS).
- O backend usa ffmpeg para mesclar streams de vídeo/áudio quando necessário.
- A API é restrita por header `Origin` — apenas o domínio de produção e `localhost` são permitidos.
