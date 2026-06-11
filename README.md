# Remifi

A **multilingual** AI remittance agent on Celo — speak in English, Spanish, Portuguese, or French — that turns natural language into cross-border stablecoin transfers via [Mento Protocol](https://mento.org). Built on [OpenClaw](https://openclaw.ai) for conversational channels (Telegram, WhatsApp) and a mobile-first Next.js web app wired to the agent HTTP API.

> *"Send $50 to my mom in the Philippines"* · *"Enviar 50 dólares a mi mamá en Filipinas"* · *"Transferir 100 euros para meu irmão na Nigéria"* · *"Envoyer 50 euros à mon frère au Nigeria"*  
> → auto-detected locale, Mento route, fee comparison vs Western Union & Wise, on-chain swap + transfer.

---

## What it does

1. **Understands** remittance requests in **English, Spanish, Portuguese, and French** — amount, currency, destination, recipient, and recurring schedules (`src/intent/locales/`).
2. **Quotes** live Mento routes on Celo (USDm→PHPm, EURm→NGNm, …).
3. **Compares fees** against Western Union and Wise.
4. **Executes** on-chain swaps and transfers (agent wallet today; user wallet via Thirdweb planned).
5. **Notifies** recipients via SMS/WhatsApp (Twilio).
6. **Records** history, receipts, and enforces spending limits.

---

## Three ways to use it

| Surface | How | Best for |
|---------|-----|----------|
| **Web app** (`web/`) | AI Pay chat → agent API (`npm run serve`) | Mobile UI, demos, hackathon video |
| **OpenClaw** | Telegram / WhatsApp → `remifi` skill + CLI | Conversational agent |
| **CLI** | `npm run remifi`, `npm run send` | Dev, scripting, CI |

---

## Features

| Feature | Module |
|---------|--------|
| **Multilingual** intent parsing (EN, ES, PT, FR) + auto locale detection | `src/intent/`, `src/intent/locales/` |
| Mento route quotes & on-chain swaps | `src/mento/`, `src/transfers/onchain.ts` |
| Fee comparison vs Western Union & Wise | `src/fees/` |
| Agent HTTP API (web ↔ agent bridge) | `src/server.ts`, `src/api/` |
| Spending limits & confirmation threshold | `src/transfers/executor.ts` |
| Recurring transfer scheduling | `src/transfers/scheduler.ts` |
| SMS / WhatsApp notifications | `src/notifications/` |
| Transaction history | `src/history/` |
| ERC-8004 agent registration | `src/agent/register.ts` |
| OpenClaw skill | `skills/remifi/SKILL.md` |
| Mobile web UI (Thirdweb auth, AI Pay, wallet) | `web/` |

---

## Project structure

```
Remifi/
├── openclaw.json           # OpenClaw agent + remifi skill
├── skills/remifi/          # SKILL.md — agent instructions for OpenClaw
├── data/
│   ├── corridors.json      # USD→PHP, EUR→NGN, GBP→KES (+ Mento token addresses)
│   ├── transactions.json   # Transfer history
│   └── schedules.json      # Recurring transfers
├── src/
│   ├── agent/              # RemifiAgent orchestrator + ERC-8004
│   ├── api/                # HTTP service (quote, transfer, history, balance)
│   ├── intent/             # NLU parser + locales
│   ├── mento/              # Mento SDK client
│   ├── fees/               # Traditional provider comparison
│   ├── transfers/          # Limits, scheduling, on-chain execution
│   ├── notifications/      # Twilio
│   ├── history/            # Transaction store
│   ├── config/             # Environment (zod)
│   ├── server.ts           # Agent API (:8787)
│   └── cli/                # remifi, send, quote, register, agent
└── web/                    # Next.js mobile UI
    └── app/                # AI Pay, wallet, contacts, Thirdweb auth
```

---

## Quick start

### 1. Install

```bash
npm install
cp .env.example .env
# CELO_RPC_URL required; AGENT_PRIVATE_KEY for on-chain sends
```

Web env (separate file):

```bash
cd web
cp .env.example .env.local
# NEXT_PUBLIC_AGENT_API_URL=http://localhost:8787
# NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
npm install
```

### 2. Agent API + web app (recommended demo)

```bash
# Terminal 1 — agent API
npm run serve

# Terminal 2 — web UI
cd web && npm run dev
# http://localhost:3000 → AI Pay (/pay)
```

### 3. CLI

```bash
# Health + readiness
npm run remifi -- health

# Live Mento quote (no private key needed)
npm run remifi -- quote "Send $5 to Mom in the Philippines"

# On-chain send (needs AGENT_PRIVATE_KEY + recipient wallet)
npm run remifi -- send "Send $5 to Mom in the Philippines" --to-wallet 0xRecipient --yes

# Parse intent only (any supported language)
npx tsx src/cli/parse-intent.ts "Send $50 to my mom in the Philippines"
npx tsx src/cli/parse-intent.ts "Enviar 50 dólares a mi mamá en Filipinas"
npx tsx src/cli/parse-intent.ts "Transferir 100 euros para meu irmão na Nigéria todo mês"
npx tsx src/cli/parse-intent.ts "Envoyer 50 euros à mon frère au Nigeria"
```

### 4. OpenClaw (Telegram / WhatsApp)

```bash
npm install -g openclaw
openclaw onboard
openclaw gateway run
```

Point OpenClaw at this repo workspace and load the **remifi** skill (`openclaw.json`). Production VPS calls `npm run remifi-api` → `api.remifi.xyz`; local dev may use `npm run remifi` — never invent rates in chat.

### 5. Tests

```bash
npm test
```

### 6. Deploy (Render + Hostinger VPS)

| Component | Where |
|-----------|--------|
| HTTP API (`npm run serve`) | **Render** — Docker (`Dockerfile`, `render.yaml`) |
| OpenClaw / Telegram bot | **Hostinger VPS** — `openclaw gateway run` 24/7 |

```bash
# Local prod-like API
docker compose up --build

# Full guide: deploy/DEPLOY.md
# VPS env template: .env.vps.example
```

---

## Agent API

Default: `http://localhost:8787` (set `AGENT_API_PORT` in `.env`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Readiness (`executionReady` if `AGENT_PRIVATE_KEY` set) |
| POST | `/api/intent` | Parse message + live Mento quote |
| POST | `/api/transfer` | Execute transfer → `txHash` |
| GET | `/api/history` | Transaction history |
| GET | `/api/balance?address=0x…` | On-chain stablecoin balances |
| GET | `/api/agent` | Agent wallet + ERC-8004 info |
| GET | `/.well-known/agent.json` | ERC-8004 registration file |

Optional body fields on `/api/intent` and `/api/transfer`: `destinationCountry`, `recipientWallet`, `recipientPhone`.

The `message` field accepts **any supported language** — locale is auto-detected server-side.

---

## Multilingual support

Remifi parses remittance intent in four languages. Users can type or speak naturally on web, Telegram, WhatsApp, or CLI — no language selector required.

| Language | Example |
|----------|---------|
| **English** | Send $50 to my mom in the Philippines |
| **Spanish** | Enviar 50 dólares a mi mamá en Filipinas |
| **Portuguese** | Transferir 100 euros para meu irmão na Nigéria todo mês |
| **French** | Envoyer 50 euros à mon frère au Nigeria |

Each locale understands local country names (e.g. *Filipinas*, *Nigéria*, *Brésil*), currency formats (`$50`, `50 euros`, `R$100`), and recurring phrases (*cada mes*, *todo mês*, *chaque mois*).

---

## Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| **Mento SDK** | Quotes & swaps on Celo | `CELO_RPC_URL` — **no Mento API key** |
| **Celo stablecoins** | USDm, EURm, PHPm, NGNm, … | `data/corridors.json` |
| **viem** | Sign & broadcast txs | `AGENT_PRIVATE_KEY` (demo operator wallet) |
| **OpenClaw** | Telegram, WhatsApp, memory | `ANTHROPIC_API_KEY`, `openclaw.json` |
| **Thirdweb** | Web auth + embedded wallets | `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` in `web/.env.local` |
| **Twilio** | SMS / WhatsApp receipts | `TWILIO_*` |
| **ERC-8004** | Onchain agent identity | `npm run register` → `AGENT_ID` |

---

## Signing models

| Model | Who signs | Status |
|-------|-----------|--------|
| **Agent wallet** | `AGENT_PRIVATE_KEY` on server | ✅ Today — hackathon demo, Telegram bot |
| **User wallet** | Thirdweb in browser | ⏳ Planned — production, non-custodial |
| **Claim escrow** | Vault contract + recipient claim | ⏳ Future — phone-only recipients |

End users should **never** paste private keys. See [howitworks.md §8–9](./howitworks.md) for phone-only recipients and escrow vault design.

---

## Security

- Spending limits: `DAILY_TRANSFER_LIMIT_USD`, `SINGLE_TRANSFER_LIMIT_USD`
- Confirmation above `REQUIRE_CONFIRMATION_ABOVE_USD` (default $100)
- Never commit `.env` or private keys
- Update Mento token addresses from [Mento docs](https://docs.mento.org)

---

## Development of agent 

```bash
npm run dev          # One-shot agent message
npm run remifi       # Unified JSON CLI for OpenClaw
npm run serve        # Agent HTTP API
npm run register     # ERC-8004 on-chain registration
npm run build        # Compile TypeScript
npm run typecheck    # Type-check
```

---

## Built vs roadmap

| Capability | Status |
|------------|--------|
| Multilingual intent parsing (EN / ES / PT / FR) | ✅ |
| Mento quotes, fee comparison | ✅ |
| On-chain swap + transfer (`onchain.ts`) | ✅ |
| Agent HTTP API + web AI Pay wired | ✅ |
| OpenClaw remifi skill + Telegram | ✅ |
| Thirdweb auth (web) | ✅ UI; user-signed sends ⏳ |
| Contact wallet field (web) | ✅ |
| Claim escrow vault (phone-only recipients) | ⏳ |
| ERC-8004 registration on 8004scan | ⏳ submission |

---

## Collaborators

- **[Muhammad Lawan (Abu-Haneeph)](https://github.com/Abu-Haneeph)** — UI development (Next.js web app). Software developer focused on scalable blockchain applications and web solutions with React, Next.js, TypeScript, and Solidity.

## License

MIT
