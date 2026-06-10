# Deployment — Render (API) + Hostinger VPS (OpenClaw agent)

Remifi splits into two services:

| Service | Host | Role |
|---------|------|------|
| **HTTP API** | Render (Docker) | Web app backend — quotes, transfers, contacts, health |
| **OpenClaw agent** | Hostinger VPS | Telegram/WhatsApp bot — runs `npm run remifi` via the skill |

```
Web app (Vercel etc.)  ──►  Render API  (https://api.remifi.xyz)
Telegram users         ──►  Hostinger VPS OpenClaw  (@remifi_bot)
```

Both can share the same `AGENT_PRIVATE_KEY` and Celo RPC settings, or you can keep signing only on the VPS and use Render for read-only quotes (not recommended for sends).

---

## 1. Render — HTTP API

### Option A: Blueprint (recommended)

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect repo.
3. Render reads `render.yaml` and creates `remifi-api` with a **1 GB persistent disk** at `/data`.
4. In the service **Environment** tab, set secrets:

| Variable | Example |
|----------|---------|
| `CELO_RPC_URL` | `https://forno.celo-sepolia.celo-testnet.org` |
| `CELO_CHAIN_ID` | `11142220` |
| `AGENT_PRIVATE_KEY` | `0x…` (operator wallet) |
| `AGENT_API_KEY` | random secret — web app sends `x-api-key` |
| `WEB_ORIGIN` | `https://your-web-app.vercel.app` |
| `PUBLIC_AGENT_API_URL` | `https://remifi-api.onrender.com` |
| `PUBLIC_BASE_URL` | your marketing site URL |

5. Deploy. Health check: `GET /api/health`.

Render sets `PORT` automatically — the server binds `0.0.0.0:PORT`.

### Option B: Manual Docker service

1. **New Web Service** → connect repo → **Runtime: Docker**.
2. Add a **disk** mounted at `/data` (contacts + transaction history persist here).
3. Set `DATA_DIR=/data` and the env vars above.

### Verify

```bash
curl https://YOUR-SERVICE.onrender.com/api/health
```

### Web app

In `web/.env.local` (or Vercel env):

```env
NEXT_PUBLIC_AGENT_API_URL=https://YOUR-SERVICE.onrender.com
NEXT_PUBLIC_AGENT_API_KEY=your-agent-api-key
```

---

## 2. Hostinger VPS — OpenClaw + Telegram

The bot must run 24/7 on a machine you control. Render hosts the **HTTP API only**, not OpenClaw.

### Prerequisites

- Ubuntu 22.04+ VPS (1 GB RAM minimum, 2 GB recommended)
- Node.js 22+
- Domain optional (Telegram uses BotFather token, not your domain)

### Install

```bash
# On the VPS
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

npm install -g openclaw

git clone https://github.com/YOUR_ORG/RemitClaw.git
cd RemitClaw
npm ci
```

### Environment

```bash
cp .env.example .env
nano .env
```

Minimum for the agent:

```env
CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
CELO_CHAIN_ID=11142220
AGENT_PRIVATE_KEY=0x…
ANTHROPIC_API_KEY=sk-ant-…
DATA_DIR=./data
```

### OpenClaw config

```bash
openclaw onboard   # or copy ~/.openclaw from your dev machine
```

Ensure Telegram is public for demos:

```json
"channels": {
  "telegram": {
    "enabled": true,
    "dmPolicy": "open",
    "allowFrom": ["*"],
    "botToken": "YOUR_BOT_TOKEN"
  }
}
```

Point the skill env at the same Celo settings. Optionally set `OPENCLAW_GATEWAY_URL` if the web app talks to the gateway.

### Run as a systemd service

```bash
sudo nano /etc/systemd/system/openclaw-remifi.service
```

```ini
[Unit]
Description=OpenClaw Remifi gateway
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/RemitClaw
Environment=NODE_ENV=production
ExecStart=/usr/bin/openclaw gateway run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-remifi
sudo systemctl status openclaw-remifi
```

### Optional: point agent at Render API

If you want the VPS agent to use the hosted API instead of local `npm run remifi`:

- Web app → Render API (already configured)
- OpenClaw on VPS still runs CLI locally (recommended — lower latency for sends)

To use remote API from custom tooling, call `https://YOUR-SERVICE.onrender.com/api/intent` with `x-api-key`.

---

## 3. Local Docker test (before Render)

```bash
cp .env.example .env
# fill AGENT_PRIVATE_KEY, CELO_RPC_URL, etc.

docker compose up --build
curl http://localhost:8787/api/health
```

---

## 4. Security checklist

- [ ] `AGENT_API_KEY` set on Render — never expose in the web client bundle unless you accept public API access
- [ ] `WEB_ORIGIN` locked to your real web app domain (not `*` in production)
- [ ] `AGENT_PRIVATE_KEY` only on servers you control (Render +/or VPS)
- [ ] Telegram `dmPolicy: "open"` only for demos — switch to `allowlist` for private bots
- [ ] Fund agent wallet with testnet USDC + CELO (Sepolia) or mainnet stables for production

---

## 5. Architecture summary

| Concern | Render | Hostinger VPS |
|---------|--------|---------------|
| Web app API | ✅ | — |
| Telegram bot | — | ✅ |
| Persistent contacts/history | Disk `/data` | `./data` on VPS |
| Signs on-chain txs | ✅ (if key set) | ✅ (if key set) |
| Must stay online | For web users | For Telegram users |
