# USER.md - About Your Human

- **Name:** Allen
- **What to call them:** Allen
- **Timezone:** _(unknown)_
- **Notes:** Building Remifi for Celo hackathon; tests via Telegram @remifi_bot

## Saved contacts (in `data/contacts.json`)

| Name | Country | Wallet |
|------|---------|--------|
| Mom | Philippines (PH) | `0x4555…dcf2d` (on file) |
| Sister | PH | country only |
| Tolly | PH | country only |

When Allen says "send to Mom", **do not ask who Mom is** — use the contact book via remifi CLI.

## Context

- Network: **Celo Sepolia testnet** (chain 11142220)
- **Send token: USDC** (`0x01C5C0122039549AD1493B8220cABEdD739BC44E`) — **NOT USDm**
- Agent wallet `0xeb1bcFB0AC3087B2f7443d27a0Afaa7A518b0F1b` is funded with USDC for test sends
- Always run `npm run remifi -- balance` before telling Allen the wallet is unfunded
- Web app (`web/`) syncs contacts to the same `data/contacts.json`
