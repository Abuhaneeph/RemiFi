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
| `TELEGRAM_BOT_USERNAME` | `remifi_bot` (auth/deposit deep links) |
| `MIN_SEND_BALANCE_USD` | `1` (min balance before Telegram send) |
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

**Vercel project settings (required):**

| Setting | Value |
|---------|-------|
| **Root Directory** | `web` |
| **Framework** | Next.js (auto) |
| **Build Command** | *(leave default — do not override)* |
| **Install Command** | *(leave default)* |

Do **not** add `web/vercel.json` or custom Build/Output overrides — they break post-build output.

The `web` build runs `scripts/vercel-link-next-output.mjs` on Vercel to symlink `web/.next` and `web/node_modules` to the repo root (workaround for [vercel#15937](https://github.com/vercel/vercel/issues/15937)).

If ENOENT errors persist after a settings fix, **delete and recreate** the Vercel project (cached `rootDirectory` metadata) or contact Vercel support.

Set in Vercel env (see `web/.env.production.example`):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_AGENT_API_URL` | `https://api.remifi.xyz` |
| `NEXT_PUBLIC_AGENT_API_KEY` | Same as Render `AGENT_API_KEY` |
| `NEXT_PUBLIC_CELO_CHAIN_ID` | Match Render |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Wallet auth (add `remifi.xyz` + `localhost` in thirdweb dashboard) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `remifi_bot` |

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

3. **Critical:** OpenClaw must use the repo config and workspace (not `~/.openclaw/workspace`).

Add to `.env` (see `.env.vps.example`):

```bash
OPENCLAW_CONFIG_PATH=/var/projects/RemiFi/openclaw.json
```

Without this, Telegram routes to the default `main` agent and never loads `AGENTS.md`, `SOUL.md`, or the `remifi` skill from the git checkout.

4. Run:

```bash
openclaw onboard   # first time only (channels + env refs)
openclaw config file   # must print .../RemiFi/openclaw.json
openclaw config get agents.list   # must show id "remifi", default true
openclaw doctor
openclaw gateway run
```

5. Keep alive with systemd — see example in `.env.vps.example` comments.

### VPS troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bot ignores remittance rules / asks for wallet | Workspace is `~/.openclaw/workspace` | Set `OPENCLAW_CONFIG_PATH` to repo `openclaw.json`, restart |
| `openclaw config file` → `~/.openclaw/openclaw.json` | Gateway not using repo config | Add `OPENCLAW_CONFIG_PATH` to `.env` + systemd `EnvironmentFile` |
| `Gateway start blocked: missing gateway.mode` (exit 78) | Repo config predates OpenClaw 2026.6+ guard | Ensure `openclaw.json` has `"gateway": { "mode": "local" }`, or run `openclaw config set gateway.mode local` |
| `curl` to `:18789` returns `HTTP:000` | Gateway not running or not listening | `sudo systemctl status openclaw`; `ss -tlnp \| grep 18789` |
| Chat completions 404 / unavailable | Endpoint disabled by default in OpenClaw 2026.6+ | `openclaw config set gateway.http.endpoints.chatCompletions.enabled true` then restart |
| Doctor shows agent `main` on telegram | Stale onboard config | Same as above; `agents.list` should be `remifi` |
| `git pull` blocked by `package-lock.json` | Local npm install on VPS | `git stash` then `git pull` (as you did) |

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

## Push `allusers` to production

### 1. Git (local)

```bash
git checkout allusers
git pull origin allusers
# commit is prepared on this branch — then:
git push origin allusers
```

Merge to `main` when ready (Render/Vercel usually track `main`):

```bash
git checkout main
git pull origin main
git merge allusers
git push origin main
```

### 2. Render (`api.remifi.xyz`)

- **Manual deploy** or auto-deploy on push to tracked branch.
- Confirm env: `WEB_ORIGIN=https://remifi.xyz`, `TELEGRAM_BOT_USERNAME`, `AGENT_API_KEY`, `PUBLIC_AGENT_API_URL`.
- After deploy: `curl https://api.remifi.xyz/api/health` → `executionReady: true`.

### 3. Vercel (`remifi.xyz`)

- Redeploy after merge; set vars from `web/.env.production.example`.
- Add `https://remifi.xyz` to thirdweb **Allowed domains**.

### 4. VPS (Telegram — optional for web-only demo)

```bash
git pull
sudo systemctl restart openclaw
```

Pass `--telegram-id` on remifi-api calls (see `skills/remifi/SKILL.md`).

## Unified checklist

- [ ] Render healthy, wallet funded
- [ ] Web wallet connect + profile shows user email/address
- [ ] Web Pay prepare/confirm flow (`/api/transfer/prepare` + user signs)
- [ ] Contact added on web appears in `GET /api/contacts?name=Mom`
- [ ] Telegram "send to Mom" uses same quote (via `remifi-api --telegram-id`)
- [ ] Telegram send returns `confirmUrl` (user signs on web)
- [ ] Per-user data under `/data/users/` on Render (not in git)
