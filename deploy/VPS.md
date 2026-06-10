# Deploy Remifi Agent API on a VPS

This guide deploys the **Remifi HTTP API** (`src/server.ts`) — the backend the web app calls for quotes, transfers, balances, and contacts.

| Component | Deploy here? |
|-----------|----------------|
| **Agent API** (`npm run serve` / Docker) | ✅ This guide |
| **Next.js web app** (`web/`) | Vercel, Netlify, or same VPS (separate process) |
| **OpenClaw + Telegram bot** | Optional — same VPS or another host |

**Default port:** `8787` (or `PORT` if set by your platform)  
**Health check:** `GET /api/health`

---

## 1. VPS requirements

| Item | Minimum |
|------|---------|
| OS | Ubuntu 22.04 / 24.04 LTS (or Debian 12) |
| RAM | 1 GB |
| CPU | 1 vCPU |
| Disk | 10 GB (+ 1 GB for persistent `DATA_DIR`) |
| Node (bare-metal path) | **Node 18+** (22 recommended) |
| Docker (recommended path) | Docker 24+ |

Open inbound ports:

- **22** — SSH (restrict to your IP if possible)
- **80 / 443** — HTTP/HTTPS (nginx reverse proxy)

Do **not** expose `8787` publicly; bind it to `127.0.0.1` and put nginx in front.

---

## 2. Server setup (Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx ufw

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Option A — Docker (recommended)

Uses the repo [`Dockerfile`](../Dockerfile).

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in so docker group applies
```

Clone and build:

```bash
sudo mkdir -p /opt/remifi
sudo chown $USER:$USER /opt/remifi
cd /opt/remifi
git clone https://github.com/YOUR_ORG/RemiFi.git .
docker build -t remifi-api:latest .
```

Create environment file (see [§4](#4-environment-variables)):

```bash
sudo mkdir -p /etc/remifi
sudo nano /etc/remifi/.env
sudo chmod 600 /etc/remifi/.env
```

Run the container:

```bash
docker run -d \
  --name remifi-api \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -v remifi-data:/data \
  --env-file /etc/remifi/.env \
  -e NODE_ENV=production \
  -e DATA_DIR=/data \
  remifi-api:latest
```

Verify:

```bash
curl -s http://127.0.0.1:8787/api/health
docker logs -f remifi-api
```

**Update after code changes:**

```bash
cd /opt/remifi
git pull
docker build -t remifi-api:latest .
docker stop remifi-api && docker rm remifi-api
# Re-run the docker run command above
```

---

### Option B — Node.js + systemd (no Docker)

```bash
# Node 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

cd /opt/remifi
git clone https://github.com/YOUR_ORG/RemiFi.git .
npm ci
npm run build

sudo mkdir -p /var/lib/remifi/data
sudo chown -R $USER:$USER /var/lib/remifi
```

Copy env:

```bash
sudo mkdir -p /etc/remifi
sudo cp .env.example /etc/remifi/.env
sudo nano /etc/remifi/.env
sudo chmod 600 /etc/remifi/.env
```

Create systemd unit `/etc/systemd/system/remifi-api.service`:

```ini
[Unit]
Description=Remifi Agent API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/remifi
EnvironmentFile=/etc/remifi/.env
Environment=NODE_ENV=production
Environment=DATA_DIR=/var/lib/remifi/data
Environment=AGENT_API_PORT=8787
ExecStart=/usr/bin/node /opt/remifi/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /opt/remifi /var/lib/remifi
sudo systemctl daemon-reload
sudo systemctl enable --now remifi-api
sudo systemctl status remifi-api
curl -s http://127.0.0.1:8787/api/health
```

**Update:**

```bash
cd /opt/remifi
git pull
npm ci
npm run build
sudo systemctl restart remifi-api
```

---

## 3. HTTPS reverse proxy (nginx)

Point a DNS **A record** at your VPS, e.g. `api.remifi.xyz` → `YOUR_VPS_IP`.

Create `/etc/nginx/sites-available/remifi-api`:

```nginx
server {
    listen 80;
    server_name api.remifi.xyz;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable and get TLS:

```bash
sudo ln -s /etc/nginx/sites-available/remifi-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.remifi.xyz
```

Test publicly:

```bash
curl -s https://api.remifi.xyz/api/health
```

---

## 4. Environment variables

Copy from [`.env.example`](../.env.example). Store secrets in `/etc/remifi/.env` — **never commit this file**.

### Required for production API

| Variable | Example | Notes |
|----------|---------|-------|
| `CELO_RPC_URL` | `https://forno.celo.org` | Celo RPC |
| `CELO_CHAIN_ID` | `42220` | Mainnet; use `11142220` for Sepolia testnet |
| `AGENT_PRIVATE_KEY` | `0x…` | Custodial signer — fund with USDC + CELO for gas |
| `AGENT_API_KEY` | `remifi_…` | Shared secret; web sends `x-api-key` header |
| `WEB_ORIGIN` | `https://remifi.xyz` | CORS origin for your frontend (no trailing slash) |
| `DATA_DIR` | `/data` (Docker) or `/var/lib/remifi/data` | Persists contacts, history, schedules |
| `PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` | Public URL in agent card / metadata |
| `PUBLIC_BASE_URL` | `https://remifi.xyz` | Marketing / claim links |

### Optional

| Variable | Purpose |
|----------|---------|
| `REMIFI_VAULT_ADDRESS` | Phone escrow (`RemifiVault`) |
| `DEMO_RECIPIENT_ADDRESS` | Fallback demo recipient |
| `TWILIO_*` | SMS / WhatsApp claim links |
| `AGENT_ID` | ERC-8004 registration id |
| `THIRDWEB_SECRET_KEY` | x402 micropayments |
| `DAILY_TRANSFER_LIMIT_USD` | Spending cap (default 500) |
| `SINGLE_TRANSFER_LIMIT_USD` | Per-tx cap (default 200) |

**Generate an API key:**

```bash
openssl rand -hex 24 | sed 's/^/remifi_/'
```

---

## 5. Connect the web app

In `web/.env.local` (or Vercel env vars):

```env
NEXT_PUBLIC_AGENT_API_URL=https://api.remifi.xyz
NEXT_PUBLIC_AGENT_API_KEY=<same value as AGENT_API_KEY>
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
```

Redeploy the frontend after changing these.

---

## 6. Persistent data

These files live under `DATA_DIR` and survive restarts:

| File | Purpose |
|------|---------|
| `contacts.json` | Named recipients (Mom, etc.) |
| `transactions.json` | Transfer history |
| `schedules.json` | Recurring sends |
| `corridors.json` | Mento token routes (seeded on first boot in Docker) |

**Backup (Docker):**

```bash
docker run --rm -v remifi-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/remifi-data-$(date +%F).tar.gz -C /data .
```

**Backup (bare metal):**

```bash
sudo tar czf remifi-data-$(date +%F).tar.gz -C /var/lib/remifi/data .
```

---

## 7. Fund the agent wallet

Before live transfers:

1. Derive address: `GET https://api.remifi.xyz/api/agent` (after deploy)
2. Send **USDC** (testnet or mainnet per `CELO_CHAIN_ID`) to that address
3. Keep a small **CELO** balance for gas (or use a paymaster if configured)

CLI check from the VPS:

```bash
cd /opt/remifi
npm run remifi -- balance
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502` from nginx | API not running — `docker logs remifi-api` or `journalctl -u remifi-api -f` |
| CORS errors in browser | `WEB_ORIGIN` must exactly match frontend URL |
| `401` / unauthorized | `NEXT_PUBLIC_AGENT_API_KEY` must match `AGENT_API_KEY` |
| Transfers fail “insufficient funds” | Fund agent wallet USDC (see §7) |
| Empty contacts after redeploy | `DATA_DIR` not mounted — check Docker volume or `/var/lib/remifi/data` |
| Health check fails | `curl http://127.0.0.1:8787/api/health` on the VPS |

**Logs**

```bash
# Docker
docker logs -f --tail 100 remifi-api

# systemd
sudo journalctl -u remifi-api -f
```

---

## 9. Security checklist

- [ ] `AGENT_PRIVATE_KEY` only on the server (`chmod 600` on `.env`)
- [ ] `AGENT_API_KEY` set in production (do not leave unset)
- [ ] API bound to `127.0.0.1:8787`, not `0.0.0.0:8787` on the public interface
- [ ] HTTPS via nginx + certbot
- [ ] SSH key auth, disable password login
- [ ] Regular backups of `DATA_DIR`
- [ ] Transfer limits configured for your risk tolerance

---

## 10. Quick reference

```bash
# Health
curl https://api.remifi.xyz/api/health

# Agent address
curl -H "x-api-key: YOUR_KEY" https://api.remifi.xyz/api/agent

# Balances
curl -H "x-api-key: YOUR_KEY" https://api.remifi.xyz/api/balance
```

**Related:** Render deployment uses the same Docker image — see [`render.yaml`](../render.yaml).
