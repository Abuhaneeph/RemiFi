# TOOLS.md - Remifi CLI (Telegram / OpenClaw)

**Working directory:** `C:\Users\allen\Desktop\RemitClaw` (workspace root)

## Windows / PowerShell — use these (no `$` in shell)

```bash
npm run remifi -- health
npm run remifi -- quote --amount 1 --recipient Mom
npm run remifi -- send --amount 1 --recipient Mom --yes
```

Map from user message: *"send $1 to mom"* → `--amount 1 --recipient Mom`

## Other commands

```bash
npm run remifi -- contacts
npm run remifi -- contacts Mom
npm run remifi -- balance
npm run remifi -- history
```

## Rules

- **Never** use `"Send $1 to Mom"` in shell — PowerShell eats `$1`
- **Never** ask Allen for Mom's wallet — she's in contacts
- **Quote works with zero balance** — only `send` needs USDC + CELO
- **Never say unfunded** without running `npm run remifi -- balance` — use USDC row, ignore USDm
- Parse JSON: `"ok": true|false`
- Explorer: `celo-sepolia.blockscout.com` on testnet

## Optional HTTP API (if `npm run serve` is running)

- `POST http://localhost:8787/api/intent` — quote (no PowerShell `$` issue)
- `POST http://localhost:8787/api/transfer` — execute

Prefer `--amount`/`--recipient` CLI on Windows.
