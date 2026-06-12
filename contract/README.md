# Remifi contracts

Foundry project for Remifi on-chain escrow.

## RemifiVault

Phone-first claim escrow for recipients without a wallet at send time.

| Function | Who calls | Purpose |
|----------|-----------|---------|
| `computeClaimId(phoneHash, secret)` | Off-chain / view | Derive escrow key |
| `deposit(claimId, token, amount, phoneHash)` | Sender / agent | Lock stablecoins |
| `claim(claimId, secret, recipient)` | Recipient wallet | Withdraw to new `0x` |
| `refund(claimId)` | Original depositor | Reclaim after 30-day window |

### Off-chain claim setup

```ts
import { keccak256, encodePacked, randomBytes } from "viem";

const phoneHash = keccak256(encodePacked(["string"], [normalizeE164(phone)]));
const secret = keccak256(randomBytes(32));
const claimId = keccak256(encodePacked(["bytes32","bytes32","bytes32"], [DOMAIN, phoneHash, secret]));
// SMS link: https://remifi.xyz/claim?c=<claimId>&s=<secret>
```

`DOMAIN` must match `RemifiVault.DOMAIN_SEPARATOR` on-chain (`REMIFI_VAULT_V1`).

### Commands (use Git Bash on Windows)

PowerShell breaks `forge`. Open **Git Bash** and run:

```bash
cd contract

# Tests
./scripts/test.sh
# or: forge test -vv

# Deploy (reads CELO_RPC_URL + AGENT_PRIVATE_KEY from repo .env)
./scripts/deploy.sh

# Dry run (no broadcast)
CLAIM_PERIOD_SECONDS=2592000 forge script script/RemifiVault.s.sol:RemifiVaultScript --rpc-url $CELO_RPC_URL
```

After deploy, copy the logged address into `REMIFI_VAULT_ADDRESS` on Render.

Default claim period: **30 days** (`CLAIM_PERIOD_SECONDS=2592000`). Min 1 day, max 90 days.
