# Remifi — Celo Onchain Agents Hackathon Win Plan

**Hackathon:** Onchain Agents — Real World Payments & Everyday Applications  
**Dates:** May 22 – June 15, 2026 · Submissions close June 15, 9 AM GMT · Winners June 17  
**Prize pool:** $5K CELO across 3 tracks  

---

## Prize tracks

| Track | Prize | How to win |
|-------|-------|------------|
| **Track 1: Best Agent on Celo** | $2,500 / $1,000 / $500 | Mission fit + real utility + live demo + polish |
| **Track 2: Most Activity** | $500 | Most onchain txs during hackathon (can combine) |
| **Track 3: Highest 8004scan rank** | $500 | Healthy ERC-8004 endpoints + probes (can combine) |

---

## What judges are looking for (final decision-maker lens)

The brief is **not** “cool agent demo.” It is **real-world payments on Celo with provable onchain agency.**

| Weight | What wins |
|--------|-----------|
| **Mission fit** | Global remittance / everyday payments — not DeFi toys |
| **Agent identity** | ERC-8004 registered, discoverable on 8004scan, MCP/A2A endpoints that respond |
| **Economic agency** | Agent wallet signs txs; real stablecoin movement via Mento |
| **Distribution** | Multiple surfaces (web, Telegram, MCP) — ideally MiniPay-adjacent |
| **Proof, not slides** | Live txs during hackathon, celoscan links, reproducible demo |
| **Ecosystem stack** | x402, Self Agent ID, OpenClaw — bonus when **working**, not just listed |
| **Anti-sybil** | Organic activity; manual review will discard wash volume |

**Judges:** Lena Hierzi (DevRel), Viral Sangani (AI Lead), Marek Olszewski (Celo/Self CEO)

---

## Current score (before final push)

| Track | Standing | Notes |
|-------|----------|-------|
| **Best Agent** | Top 5 contender | Strong story + real stack; loses to cleaner live demos |
| **Most Activity** | Unranked | Infrastructure exists; volume not shown yet |
| **8004scan rank** | Competitive | agentId 9237, probes, MCP manifest — keep endpoints green |

**To win 1st ($2,500):** one flawless live demo + ecosystem checklist complete.  
**To also take Activity ($500):** deliberate organic tx campaign during the window.  
**To lock 8004scan ($500):** all service endpoints healthy 24/7 through June 15.

---

## What Remifi has already done ✅

### Strong — scores well

**1. Real use case aligned with Celo’s thesis**  
Cross-border remittance in EN/ES/PT/FR, Mento routes, fee comparison vs Western Union/Wise.

**2. ERC-8004 is real, not cosmetic**
- Registered **agentId `9237`** on Celo mainnet (`42220`)
- Public registration: `https://remifi.xyz/.well-known/agent.json`
- Agent wallet: `0xB98cFAC37b8bD7f549789718aC17F8aEE7cE0c37`
- Endpoints: HTTP, MCP, A2A, x402, wallet
- Server handles **8004scan HEAD/GET probes** (Track 3)
- 8004scan: `https://8004scan.io/agent/eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/9237`

**3. Genuine agent economic agency**  
Agent owns signing (`AGENT_PRIVATE_KEY` on Render), Mento swap + transfer, spending limits, history/contacts.

**4. Multi-channel architecture (correct pattern)**
```
remifi.xyz (Vercel)       ──┐
Telegram @remifi_bot (VPS) ──┼──► api.remifi.xyz (Render) ──► Celo
External MCP clients      ──┘
```
Thin clients, one brain.

**5. OpenClaw + remifi skill**  
Production skill calls `remifi-api` → Render. Telegram bot `@remifi_bot` configured.

**6. Web app is production-minded**  
Mobile-first UI, Thirdweb wallet, Pay chat, contacts, deposit/withdraw, i18n (4 locales).

**7. x402 implemented in code**  
`/api/x402/premium-quote` — 402 → pay → retry flow (needs to be enabled for demo).

**8. Other features built**
- Multilingual intent parsing (`src/intent/locales/`)
- Mento quotes & on-chain swaps
- Fee comparison vs WU/Wise
- Spending limits & confirmation threshold
- Recurring transfer scheduling
- Twilio SMS/WhatsApp notifications
- Claim escrow (vault)
- Transaction history
- MCP tools + prompts for external agents

---

## Gaps — what makes judges hesitate ⚠️

| Gap | Impact |
|-----|--------|
| **Production coherence messy** | Render mainnet vs VPS Sepolia vs local env mismatches; Vercel build failures; OpenClaw gateway on `127.0.0.1` |
| **x402 declared but not live** | `X402_ENABLED=false` in `.env` while registration says `x402Support: true` |
| **No Self Agent ID** | Marek co-founded Self — visible absence vs competitors |
| **No MiniPay angle** | Hackathon mentions 15M+ MiniPay users; Remifi uses Thirdweb + Telegram only |
| **Onchain activity unproven** | Track 2 needs celoscan links / volume during hackathon window |
| **Demo risk** | Telegram just fixed; web Pay chat needs VPS OpenClaw exposed for production |
| **Registration checklist incomplete** | Quote-tweet, Celo Builders submission, tagged tweet with agentId |

---

## The winning narrative (use this everywhere)

**Don't say:** “We built an AI chatbot for remittances.”

**Do say:**

> **Remifi is ERC-8004 agent #9237 on Celo** — a multilingual remittance operator with its own wallet, discoverable via MCP/A2A, executing Mento stablecoin swaps for real cross-border payments. Talk on **Telegram, web, or MCP**. Every send is onchain. Every quote can be x402-gated. Built on OpenClaw; deployed at remifi.xyz.

Hits: real world payments, agent framework, ERC-8004, x402, OpenClaw, onchain, global.

---

## 72-hour action plan (prioritized)

### Tier 1 — Required for 1st place

- [ ] **One canonical production story (mainnet for demo)**  
  Render `api.remifi.xyz` + `remifi.xyz` + Telegram VPS. Align all env vars. Fix Vercel deploy. No Sepolia in demo.

- [ ] **90-second demo video — open with a tx hash**  
  Script: “Send $5 to Mom in the Philippines” → Telegram or web → Mento quote + fee savings → confirm → **celoscan tx** → history → 8004scan agent page.

- [ ] **Submit proof bundle**
  - ERC-8004: `https://8004scan.io/agent/eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/9237`
  - 3–5 celoscan tx links from hackathon period
  - `@remifi_bot` live screenshot
  - `curl https://api.remifi.xyz/api/health` → `executionReady: true`

- [ ] **Official registration tweet**
  ```
  Building for @CeloDevs Agent Hackathon 🟡
  Remifi — multilingual AI remittance on Celo via Mento
  Registered → https://8004scan.io/agent/eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/9237
  #CeloAgents @Celo
  ```

- [ ] **Submit via Celo Builders skill**
  ```bash
  npx skills add https://celobuilders.xyz
  ```
  Then ask agent: *“Help me submit my project to the Celo Onchain Agents Hackathon.”*  
  Choose: `celo-onchain-agents` → connect → answer questions → review → publish.

- [ ] **Join hackathon Telegram group** for updates and support.

---

### Tier 2 — Differentiators vs similar agents

- [ ] **Enable x402 for demo**  
  Set `X402_ENABLED=true` on Render. Demo: `GET /api/x402/premium-quote` → 402 → pay $0.01 USDC → premium quote.

- [ ] **Self Agent ID**  
  Verify agent if Self works in your region. If not: screenshot of unsupported country + note in submission (judges accept this).

- [ ] **MiniPay hook (even lightweight)**  
  Slide or 30s segment: “Remifi agent wallet + Mento corridors → MiniPay users receive PHPm/NGNm locally.” Or deep link / CTA on claim flow.

- [ ] **External MCP call on video**  
  Show Cursor or another client calling `https://api.remifi.xyz/mcp` → `quote` tool → real response.

- [ ] **Expose OpenClaw gateway for production web Pay** (optional but impressive)  
  Vercel env: `OPENCLAW_GATEWAY_URL` + `OPENCLAW_GATEWAY_TOKEN` from VPS OpenClaw (not local token).

---

### Tier 3 — Track 2 (Most Activity) without sybil

- [ ] **Remifi Remittance Relay** during hackathon  
  10–20 real micro-sends ($0.50–$2) across corridors (USD→PHP, EUR→NGN).  
  Document on public page or gist. Invite Telegram users in hackathon group.

- [ ] **One scheduled recurring send** fires on-chain during the window.

- [ ] **Do NOT** wash txs — judges manually review for sybil.

---

## Production env checklist (single mainnet story)

### Render (`api.remifi.xyz`)
| Variable | Value |
|----------|-------|
| `CELO_CHAIN_ID` | `42220` |
| `PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `AGENT_ID` | `9237` |
| `X402_ENABLED` | `true` (for demo) |
| `AGENT_PRIVATE_KEY` | Render only — funded with USDC + CELO |

### Vercel (`remifi.xyz`)
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `NEXT_PUBLIC_CELO_CHAIN_ID` | `42220` |
| `NEXT_PUBLIC_AGENT_API_KEY` | Same as Render |
| `OPENCLAW_GATEWAY_URL` | VPS public URL (if web Pay chat) |
| `OPENCLAW_GATEWAY_TOKEN` | VPS OpenClaw token (not local) |

### VPS (OpenClaw + Telegram)
| Variable | Value |
|----------|-------|
| `PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `AGENT_API_KEY` | Same as Render |
| `TELEGRAM_BOT_TOKEN` | From @BotFather → `@remifi_bot` |
| `ANTHROPIC_API_KEY` | Claude for OpenClaw |

**Do NOT set on VPS:** `AGENT_PRIVATE_KEY`, `CELO_RPC_URL`, `DATA_DIR`

---

## Demo script (90 seconds)

1. Open Telegram → `@remifi_bot`
2. Send: *“Send $5 to Mom in the Philippines”*
3. Bot quotes Mento route + fee savings vs bank
4. Confirm → tx executes
5. Show **celoscan tx hash** (full screen, 5 seconds)
6. Cut to `8004scan.io` agent #9237 page
7. Cut to `remifi.xyz` web app → same history
8. Optional: MCP tool call from terminal/Cursor
9. Optional: x402 pay-per-quote flow

---

## Key links (copy-paste)

| Resource | URL |
|----------|-----|
| Web app | https://remifi.xyz |
| Agent API | https://api.remifi.xyz |
| Agent registration | https://remifi.xyz/.well-known/agent.json |
| MCP manifest | https://api.remifi.xyz/.well-known/mcp.json |
| 8004scan agent | https://8004scan.io/agent/eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/9237 |
| Telegram bot | https://t.me/remifi_bot |
| Health check | https://api.remifi.xyz/api/health |

---

## Brutally honest bottom line

**You are building the right thing.** Architecture, registration, Mento execution, and multi-channel design are genuinely competitive for **Best Agent**.

**What separates 1st from 3rd is not more code — it is:**

1. One clean live demo with tx proof  
2. Ecosystem boxes checked (8004scan, tweet, submission, x402 demo)  
3. Visible onchain activity during the window  
4. Production that works when a judge tries it at 2 AM  

**If you do only one thing before June 15:**  
Make `@remifi_bot` send $1 on mainnet on video, show the celoscan link, and submit with agentId **9237** front and center.

---

## Official hackathon checklist

- [ ] Quote-tweet announcement tagging @CeloDevs + @Celo with ERC-8004 link
- [ ] Join hackathon Telegram group
- [ ] Tweet with agentId, tag @Celo + @CeloDevs
- [ ] Submit via Celo Builders skill (`celo-onchain-agents`)
- [ ] Self Agent ID OR screenshot if unsupported in your country
- [ ] Demo video with live tx
- [ ] 3–5 celoscan links from hackathon period

---

## Judge gaps — what they mean + fix plan

### What those warnings meant

| Warning | Plain English |
|---------|----------------|
| **Telegram only if VPS OpenClaw is up** | `@remifi_bot` is just a Telegram shell. Messages go to **OpenClaw on your VPS**. If `openclaw gateway run` is stopped, the bot is silent — judges get no reply. |
| **Web Pay AI chat broken** | `remifi.xyz` Pay tab calls `/api/pay-agent` → needs `OPENCLAW_GATEWAY_URL` on **Vercel**. Yours is unset, so it returns `available: false`. The web app does **not** talk to Telegram; it needs its own path to OpenClaw. |
| **x402: 402 yes, settlement no** | API correctly returns HTTP 402 “pay $0.01”. But **Render is missing `THIRDWEB_SECRET_KEY`**, so thirdweb cannot verify/settle the payment. Judges see a paywall with no way through. |
| **Self / MiniPay not there** | Optional ecosystem bonus. Self = verified agent credentials (Marek). MiniPay = 15M mobile wallets on Celo — you have no story or link yet. |

---

### Fix 1: x402 (full pay flow) — ~30 min

**Code fix (done in repo):** x402 `resource` URL now uses `PUBLIC_AGENT_API_URL` (HTTPS) instead of internal `http://`. Health shows `x402Ready` + `x402Enabled`.

**You do on Render dashboard** (`api.remifi.xyz`):

1. Open [thirdweb dashboard](https://thirdweb.com/dashboard) → same project as `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
2. **Settings → API Keys → Secret key** → copy (never commit)
3. Render → Environment → add/update:

| Variable | Value |
|----------|-------|
| `THIRDWEB_SECRET_KEY` | `sk_...` from thirdweb |
| `X402_ENABLED` | `true` |
| `X402_PRICE_USD` | `0.01` |
| `X402_NETWORK` | `celo` |
| `X402_TOKEN` | `USDC` |

4. Redeploy Render service

**Verify:**

```powershell
curl.exe -s https://api.remifi.xyz/api/health
# expect: "x402Enabled": true, "x402Ready": true

curl.exe -s https://api.remifi.xyz/api/x402/info
# expect: resource starts with https://api.remifi.xyz/...
```

**Demo for judges:** `GET /api/x402/info` → 402 on `/api/x402/premium-quote` → pay $0.01 USDC with x402 client → retry with `X-PAYMENT` → quote returned.

---

### Fix 2: Telegram (@remifi_bot) — ~1 hour

**Architecture:**
```
User → Telegram → @remifi_bot → OpenClaw (VPS) → npm run remifi-api → api.remifi.xyz
```

**VPS `.env` must have:**

```env
PUBLIC_AGENT_API_URL=https://api.remifi.xyz
AGENT_API_KEY=<same as Render>
TELEGRAM_BOT_TOKEN=<from BotFather>
ANTHROPIC_API_KEY=<claude>
```

**On VPS:**

```bash
cd /opt/remifi   # or your clone path
openclaw gateway run   # or: sudo systemctl restart openclaw
```

**Verify:**

```powershell
curl.exe -s "https://api.telegram.org/bot<TOKEN>/getMe"
# ok: true, username: remifi_bot
```

Then message `@remifi_bot`: *"Send $1 to Mom"* → quote → confirm.

**Judge test:** If OpenClaw is down at 2 AM, they see a dead bot. Keep systemd running 24/7 through June 15.

---

### Fix 3: Web Pay AI chat — ~2 hours (optional but impressive)

**Why broken:** Vercel `/api/pay-agent` needs to reach OpenClaw gateway, not localhost.

**Option A — Expose OpenClaw on VPS (recommended for demo):**

1. On VPS, find OpenClaw gateway token (from `openclaw onboard` or `~/.openclaw/` config)
2. Bind gateway to `0.0.0.0:18789` or put nginx in front, e.g. `https://openclaw.yourdomain.com`
3. **Vercel env:**

| Variable | Value |
|----------|-------|
| `OPENCLAW_GATEWAY_URL` | `https://openclaw.yourdomain.com` (not 127.0.0.1) |
| `OPENCLAW_GATEWAY_TOKEN` | Token from **VPS** OpenClaw (not your local `.env.local` token) |

4. Redeploy Vercel

**Verify:**

```powershell
curl.exe -s https://remifi.xyz/api/pay-agent
# expect: "available": true, "reachable": true
```

**Option B — Skip for hackathon:** Demo via **Telegram + API + MCP** only. Mention in submission: “Web Pay chat requires OpenClaw gateway; Telegram and MCP are primary demo surfaces.”

---

### Fix 4: Self Agent ID — ~30 min (optional)

1. Install Self app / follow [Self Agent ID](https://docs.celo.org) docs for your region
2. Verify agent #9237 or your builder identity
3. Add verification link or screenshot to submission
4. **If unsupported in your country:** Screenshot the Self app message + note in submission (judges accept this)

---

### Fix 5: MiniPay angle — ~1 hour (lightweight, no full integration)

You do **not** need full MiniPay SDK by June 15. Pick one:

- **Demo video voiceover:** “Recipients can receive PHPm/NGNm locally via Celo stablecoins — MiniPay-compatible corridors through Mento.”
- **One line on claim/deposit UI:** “Works with Celo stablecoins — compatible with MiniPay wallets.”
- **Submission description:** Tie Remifi corridors to MiniPay’s 15M users receiving local stablecoins

---

## Judge-ready checklist (run before submission)

```
[ ] curl api.remifi.xyz/api/health → executionReady + x402Ready true
[ ] curl remifi.xyz/api/pay-agent → reachable true (OR skip and demo Telegram)
[ ] @remifi_bot responds to "Send $1 to Mom"
[ ] x402: 402 then paid quote works with THIRDWEB_SECRET_KEY set
[ ] Self screenshot OR verification link (optional)
[ ] MiniPay mentioned in video/submission text (optional)
```

---

*Last updated: June 11, 2026*
