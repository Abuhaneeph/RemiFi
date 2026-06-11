---
name: celo-builders
description: >-
  Celo Builders hackathon — discover rules, connect Google account, draft and
  publish submission for celo-onchain-agents. Read win.md for Remifi checklist.
user-invocable: true
metadata:
  {
    "openclaw":
      {
        "emoji": "🟡",
        "requires": { "env": [] },
      },
  }
---

# Celo Builders

Base URL: `https://celobuilders.xyz`

Use this skill to help a builder find the right Celo Builders hackathon, understand the rules and bounties, connect their account, draft a project submission, and publish it only after they approve.

**Remifi workspace:** also read `win.md` for checklist, demo script, and pre-filled project links. Progress through intake → connect → draft → review → publish in order.

## Remifi project defaults (this repo)

Use these when drafting unless the builder overrides:

| Field | Value |
|-------|-------|
| `hackathonId` | `celo-onchain-agents` |
| `projectName` | Remifi |
| `tagline` | Multilingual AI remittance agent on Celo — Mento swaps, real txs, Telegram + web + MCP |
| `githubUrl` | Builder's repo (e.g. `https://github.com/alexnjoya/remifi`) |
| `demoUrl` | `https://remifi.xyz` |
| `celoNetwork` | `celo-mainnet` |
| `contractAddresses` | Identity registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`; agent wallet `0xB98cFAC37b8bD7f549789718aC17F8aEE7cE0c37` |
| ERC-8004 / 8004scan | `https://8004scan.io/agent/eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/9237` |
| Telegram | `@remifi_bot` |

**Track slugs** (`trackIds`): `best-agent`, `most-activity`, `8004scan-rank`

**Bounty slugs** (`bountyIds`): `best-agent-1st`, `most-activity-1st`, `8004scan-rank-1st`

**Windows:** use `curl.exe` for all API calls below (PowerShell `curl` is an alias and breaks JSON).

**Connection token:** after `/auth/google/claim`, save the bearer token to `data/celo-builders.connection` (one line, no quotes). Read it for authenticated requests; never commit or paste in chat.

## Agent Behavior

- Talk to the builder in plain language. Keep connection details internal unless they explicitly ask.
- Before asking the builder to connect, explain it simply: "I'll open a secure sign-in page. After you finish, paste the short code here so I can continue."
- Never invent dates, rules, bounties, tracks, FAQs, or judging criteria.
- Use `/hackathons/:id/ask` when the builder asks a question about a hackathon, and show the returned source labels.
- Ask before collecting personal or project information.
- Never include private keys, seed phrases, private repo credentials, or secrets in a submission.
- Treat drafts as private. Publish only after the builder confirms the final version.

## Discover Hackathons

List hackathons:

```bash
curl https://celobuilders.xyz/hackathons
```

Fetch details for the selected hackathon. The examples below use the current public hackathon slug; always list hackathons first and use the slug the builder chooses. Check `metadata.submissionFields` on the selected hackathon before collecting project details.

```bash
curl https://celobuilders.xyz/hackathons/celo-onchain-agents
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/timeline
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/rules
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/tracks
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/bounties
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/judging-criteria
curl https://celobuilders.xyz/hackathons/celo-onchain-agents/faqs
```

Ask a hackathon question:

```bash
curl -X POST https://celobuilders.xyz/hackathons/celo-onchain-agents/ask \
  -H "Content-Type: application/json" \
  -d '{ "question": "What are the bounties and submission deadline?" }'
```

## Submission Intake Checklist

Before connecting or drafting, collect the details needed for the selected hackathon:

- Builder name, email, social handle, team name, and agent name
- Project name, one-line tagline, short description, track targets, and bounty targets
- GitHub repository URL
- Demo URL, if available
- Ask whether they have a video URL; use `videoUrl` if they do, otherwise leave it out
- Celo network, using exactly one of: `celo-mainnet`, `celo-sepolia`, `not-applicable`
- Contract addresses, if applicable
- How the agent helped build the project
- Any configured fields from `metadata.submissionFields`

For `celo-onchain-agents`, ask for the real Twitter/X registration post link up front. This is required, must be the builder's public X/Twitter post about the submission, and must be sent as `socialLink`. Never use a placeholder for `socialLink`.

Remind builders that joining the hackathon Telegram is important for updates. The link is on the hackathon page at `https://celobuilders.xyz/`.

## Connect Builder

After the intake details are ready, start the connection flow:

```bash
curl -X POST https://celobuilders.xyz/auth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "hackathonId": "celo-onchain-agents",
    "human": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "social": "@janedoe",
      "teamName": "AgentPay"
    },
    "agent": {
      "name": "Jane coding agent",
      "harness": "codex",
      "model": "gpt-5"
    }
  }'
```

Ask the builder to open the returned sign-in link. When the browser shows a short code, ask them to paste it back.

Finish the connection:

```bash
curl -X POST https://celobuilders.xyz/auth/google/claim \
  -H "Content-Type: application/json" \
  -d '{ "claimCode": "CELO-ABCD-2345" }'
```

Store the returned connection credential in `data/celo-builders.connection` (gitignored) and use it silently for authenticated requests:

```bash
# After claim — save token (replace TOKEN with value from claim response)
# PowerShell: Set-Content -NoNewline data/celo-builders.connection TOKEN

# Use in requests:
curl.exe https://celobuilders.xyz/submissions/me -H "Authorization: Bearer $(Get-Content data/celo-builders.connection)"
```

## Builder Profile

View the connected builder:

```bash
curl https://celobuilders.xyz/participants/me \
  -H "Authorization: Bearer <connection>"
```

Update optional profile fields:

```bash
curl -X PUT https://celobuilders.xyz/participants/me \
  -H "Authorization: Bearer <connection>" \
  -H "Content-Type: application/json" \
  -d '{ "teamName": "AgentPay", "socialHandle": "@janedoe" }'
```

## Project Submission

Before saving a draft, make sure all required fields are present, including any hackathon-specific fields from `metadata.submissionFields`. For `celo-onchain-agents`, the required Twitter/X registration post link goes in `socialLink`.

Create or update the draft:

```bash
curl -X PUT https://celobuilders.xyz/submissions/me \
  -H "Authorization: Bearer <connection>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Remifi",
    "tagline": "Multilingual AI remittance agent on Celo — Mento swaps, real txs, Telegram + web + MCP",
    "description": "ERC-8004 agent #9237. Natural-language remittance in EN/ES/PT/FR via OpenClaw (Telegram), web app, and MCP. Agent wallet signs Mento stablecoin swaps on Celo mainnet. x402 premium quotes, 8004scan discovery, fee comparison vs banks.",
    "trackIds": ["best-agent", "most-activity", "8004scan-rank"],
    "bountyIds": ["best-agent-1st", "most-activity-1st", "8004scan-rank-1st"],
    "githubUrl": "https://github.com/alexnjoya/remifi",
    "demoUrl": "https://remifi.xyz",
    "videoUrl": "https://youtu.be/REPLACE_WITH_DEMO",
    "socialLink": "https://x.com/YOUR_HANDLE/status/REPLACE_WITH_REAL_POST",
    "celoNetwork": "celo-mainnet",
    "contractAddresses": [
      "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      "0xB98cFAC37b8bD7f549789718aC17F8aEE7cE0c37"
    ],
    "agentContributionNotes": "Cursor + OpenClaw agents built intent parsing, Mento execution, ERC-8004 registration, web UI, Telegram skill, MCP server, and this submission draft."
  }'
```

Review the draft:

```bash
curl https://celobuilders.xyz/submissions/me \
  -H "Authorization: Bearer <connection>"
```

Publish only after clear builder approval:

```bash
curl -X POST https://celobuilders.xyz/submissions/me/publish \
  -H "Authorization: Bearer <connection>" \
  -H "Content-Type: application/json" \
  -d '{ "confirm": true }'
```

## Error Handling

- `400`: ask the builder to fix missing or invalid information.
- `401` or `403`: ask the builder to reconnect or confirm they have access.
- `404`: the hackathon or draft was not found.
- `409`: the draft may already be published.
- `429`: wait before trying again.
