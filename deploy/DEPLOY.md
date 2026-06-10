# Remifi production deploy

One agent on Render. Web and Telegram are thin clients that call it.

## Topology

```
remifi.xyz (Vercel)     ──► api.remifi.xyz (Render) ──► RemitClawAgent + wallet + /data
Telegram/WhatsApp (VPS) ──► api.remifi.xyz (same)
```

## 1. Agent API — Render (`api.remifi.xyz`)

1. Connect repo → New Blueprint → `render.yaml` (or Docker web service).
2. Custom domain: `api.remifi.xyz`.
3. Set secrets in Render dashboard:

| Variable | Value |
|----------|-------|
| `CELO_RPC_URL` | Your Celo RPC |
| `CELO_CHAIN_ID` | `42220` or `11142220` (Sepolia) |
| `AGENT_PRIVATE_KEY` | Agent signing key (**only here**) |
| `AGENT_API_KEY` | Shared secret for web + VPS |
| `PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `PUBLIC_BASE_URL` | `https://remifi.xyz` |
| `WEB_ORIGIN` | `https://remifi.xyz` |
| `DATA_DIR` | `/data` (set in blueprint) |
| `AGENT_ID` | After `npm run register` |
| `REMIFI_VAULT_ADDRESS` | Optional — phone claim escrow |
| `TWILIO_*` | Optional — SMS/WhatsApp claim alerts |

4. Verify:

```bash
curl https://api.remifi.xyz/api/health
curl https://api.remifi.xyz/api/agent
```

`executionReady: true` means sends will work. Fund the agent wallet (USDC + CELO on Sepolia).

## 2. Web — Vercel (`remifi.xyz`)

Set in Vercel env (see `web/.env.production.example`):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `NEXT_PUBLIC_AGENT_API_KEY` | Same as Render `AGENT_API_KEY` |
| `NEXT_PUBLIC_CELO_CHAIN_ID` | Match Render |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Wallet auth |

Web Pay calls `POST /api/intent` and `POST /api/transfer`. People page syncs contacts via `POST /api/contacts/sync`.

## 3. OpenClaw — VPS (Telegram / WhatsApp)

The VPS is a **chat gateway**. It does not sign transactions.

1. Clone repo, `npm install`, `npm install -g openclaw`.
2. Copy `.env.vps.example` → `.env` and fill in:

| Variable | Required |
|----------|----------|
| `PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `AGENT_API_KEY` | Same as Render |
| `ANTHROPIC_API_KEY` | Claude for OpenClaw |
| `TELEGRAM_BOT_TOKEN` | BotFather token |

**Do not set on VPS:** `AGENT_PRIVATE_KEY`, `CELO_RPC_URL`, `DATA_DIR`, Twilio (agent handles notifications on Render).

3. Run:

```bash
openclaw onboard   # first time
openclaw gateway run
```

4. Keep alive with systemd — see example in `.env.vps.example` comments.

### How VPS talks to the agent

All remittance operations use:

```bash
npm run remifi-api -- quote --amount 5 --recipient Mom
npm run remifi-api -- send --amount 5 --recipient Mom --yes
npm run remifi-api -- health
```

`remifi-api` calls `PUBLIC_AGENT_API_URL` with header `x-api-key: AGENT_API_KEY`.

## Local development

| Terminal | Command |
|----------|---------|
| Agent API | `npm run serve` (localhost:8787) |
| Web | `cd web && npm run dev` |
| OpenClaw | `openclaw gateway run` |

For local OpenClaw without Render, either:

- Set `PUBLIC_AGENT_API_URL=http://localhost:8787` and use `npm run remifi-api`, or
- Unset `PUBLIC_AGENT_API_URL` and use `npm run remifi` (in-process CLI).

## Unified checklist

- [ ] Render healthy, wallet funded
- [ ] Web Pay quotes and sends
- [ ] Contact added on web appears in `GET /api/contacts?name=Mom`
- [ ] Telegram "send to Mom" uses same quote (via `remifi-api`)
- [ ] Telegram send shows in `GET /api/history`
- [ ] One wallet address on `/api/agent` for all channels
