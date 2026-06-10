#!/usr/bin/env node
/**
 * Unified Remifi CLI for OpenClaw exec — always prints JSON.
 *
 * Usage:
 *   npx tsx src/cli/remifi.ts quote "Send $5 to Mom in the Philippines"
 *   npx tsx src/cli/remifi.ts send "Send $5 to Mom in the Philippines" --yes
 *   npx tsx src/cli/remifi.ts send "..." --to-wallet 0xRecipient --yes
 *   npx tsx src/cli/remifi.ts contacts
 *   npx tsx src/cli/remifi.ts contacts Mom
 *   npx tsx src/cli/remifi.ts contacts add --name "Aunt May" --country PH --wallet 0x… [--phone +…] [--favourite]
 *   npx tsx src/cli/remifi.ts contacts remove --name "Aunt May"
 *   npx tsx src/cli/remifi.ts balance
 *   npx tsx src/cli/remifi.ts history
 *   npx tsx src/cli/remifi.ts health
 */
import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";
import { loadConfig } from "../config/index.js";
import { explorerTxUrl } from "../utils/explorer.js";
import { findContactByName } from "../contacts/store.js";
import { CELO_SEPOLIA_USDC } from "../mento/client.js";
import {
  executeForMessage,
  getAgentAddress,
  getBalances,
  getContactByName,
  getHistory,
  listContacts,
  quoteForMessage,
  removeContact,
  saveContact,
  type TransferContext,
} from "../api/service.js";

interface Args {
  command?: string;
  message?: string;
  amount?: number;
  currency?: string;
  recipient?: string;
  country?: string;
  toWallet?: string;
  toPhone?: string;
  name?: string;
  wallet?: string;
  phone?: string;
  favourite?: boolean;
  yes: boolean;
}

const COUNTRY_PHRASES: Record<string, string> = {
  PH: "the Philippines",
  NG: "Nigeria",
  KE: "Kenya",
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { yes: false };
  const messageParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!args.command && !a.startsWith("-")) {
      args.command = a;
      continue;
    }
    if (a === "--to-wallet" && argv[i + 1]) args.toWallet = argv[++i];
    else if (a === "--to-phone" && argv[i + 1]) args.toPhone = argv[++i];
    else if (a === "--message" && argv[i + 1]) args.message = argv[++i];
    else if (a === "--amount" && argv[i + 1]) args.amount = Number(argv[++i]);
    else if (a === "--currency" && argv[i + 1]) args.currency = argv[++i];
    else if (a === "--recipient" && argv[i + 1]) args.recipient = argv[++i].trim();
    else if (a === "--country" && argv[i + 1]) args.country = argv[++i];
    else if (a === "--name" && argv[i + 1]) args.name = argv[++i].trim();
    else if (a === "--wallet" && argv[i + 1]) args.wallet = argv[++i].trim();
    else if (a === "--phone" && argv[i + 1]) args.phone = argv[++i].trim();
    else if (a === "--favourite" || a === "--favorite") args.favourite = true;
    else if (a === "--yes" || a === "-y") args.yes = true;
    else messageParts.push(a);
  }

  if (!args.message && messageParts.length) {
    args.message = messageParts.join(" ");
  }
  return args;
}

/** Validate a structured amount before building a message. Returns an error string if invalid. */
function validateAmount(amount: number | undefined): string | undefined {
  if (amount == null) return undefined;
  if (!Number.isFinite(amount)) return "Amount is not a number. Example: --amount 1";
  if (amount <= 0) return "Amount must be greater than 0.";
  if (amount > 1_000_000) return "Amount is unrealistically large — double-check it.";
  return undefined;
}

/** Map raw backend/on-chain errors to clear, user-facing guidance for Telegram. */
function friendlyError(raw: string): string {
  const e = raw.toLowerCase();
  if (e.includes("insufficient") && e.includes("balance"))
    return `${raw} Fund the agent wallet with USDC + CELO for gas, then retry.`;
  if (e.includes("could not parse transfer amount"))
    return "I couldn't read the amount. Try: send 1 to Mom (or --amount 1 --recipient Mom).";
  if (e.includes("destination country"))
    return "I couldn't tell where this is going. Name a saved contact (e.g. Mom) or add a country.";
  if (e.includes("no corridor"))
    return "That currency/country route isn't supported yet. Supported: USD→PH, EUR→NG, GBP→KE.";
  if (e.includes("not tradable") || e.includes("circuit breaker"))
    return "That route is temporarily unavailable (Mento circuit breaker). Try again shortly.";
  if (e.includes("exceeds") && e.includes("limit"))
    return raw; // already friendly from executor
  if (e.includes("insufficient funds") || e.includes("gas required"))
    return "Agent wallet has no CELO for gas. Fund it from the Celo Sepolia faucet, then retry.";
  if (e.includes("nonce") || e.includes("replacement") || e.includes("timeout"))
    return "Network hiccup while broadcasting. Check balance/history before retrying to avoid a double-send.";
  if (e.includes("private key") || e.includes("agent_private_key"))
    return "Agent signing key is not configured. Set AGENT_PRIVATE_KEY in .env.";
  return raw;
}

/** Build a parseable message without `$` (safe for PowerShell / OpenClaw exec on Windows). */
function buildMessage(args: Args, dataDir: string): string | undefined {
  if (args.message?.trim()) return args.message.trim();
  if (args.amount == null || !args.recipient) return undefined;

  const currency = (args.currency ?? "USD").toUpperCase();
  let country = args.country?.toUpperCase();
  if (!country) {
    const contact = findContactByName(dataDir, args.recipient);
    country = contact?.country?.toUpperCase();
  }
  const where = country
    ? ` in ${COUNTRY_PHRASES[country] ?? country}`
    : "";
  return `Send ${args.amount} ${currency} to ${args.recipient}${where}`;
}

function ok(data: unknown) {
  console.log(JSON.stringify({ ok: true, ...((data as object) ?? {}) }, null, 2));
}

function fail(error: string, extra?: Record<string, unknown>): never {
  console.log(JSON.stringify({ ok: false, error, ...extra }, null, 2));
  process.exit(1);
  throw new Error(error);
}

/** Stable id from a contact name: "Aunt May" → "aunt-may". */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function transferContext(args: Args): TransferContext | undefined {
  const ctx: TransferContext = {};
  if (args.toWallet) ctx.recipientWallet = args.toWallet;
  if (args.toPhone) ctx.recipientPhone = args.toPhone;
  return Object.keys(ctx).length ? ctx : undefined;
}

async function main() {
  const args = parseArgs();
  const config = loadConfig();

  switch (args.command) {
    case "health": {
      const address = getAgentAddress(config);
      const balances = address ? await getBalances(config, address) : [];
      const onSepolia = config.celoChainId === CELO_SEPOLIA_CHAIN_ID;
      const sendToken = onSepolia ? "USDC" : "USDm";
      const sendBalance =
        balances.find((b) => b.symbol === sendToken)?.balance ?? 0;
      ok({
        chainId: config.celoChainId,
        network: onSepolia ? "celo-sepolia" : "celo-mainnet",
        executionReady: Boolean(config.agentPrivateKey),
        agentAddress: address,
        sendToken,
        sendTokenAddress: onSepolia ? CELO_SEPOLIA_USDC : null,
        sendBalance,
        sendReady: sendBalance > 0,
        balances,
        demoRecipient: config.demoRecipientAddress ?? null,
        vaultAddress: config.remifiVaultAddress ?? null,
        apiPort: config.agentApiPort,
        contactsCount: listContacts(config).length,
      });
      return;
    }

    case "contacts": {
      const tokens = (args.message ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = tokens[0]?.toLowerCase();

      // contacts add --name "Aunt May" --country PH --wallet 0x.. [--phone +..] [--favourite]
      if (sub === "add" || sub === "save" || sub === "new" || sub === "update") {
        const name = args.name ?? tokens.slice(1).join(" ").trim();
        if (!name) {
          fail(
            'Usage: remifi contacts add --name "Aunt May" --country PH --wallet 0x… [--phone +…] [--favourite]'
          );
        }
        const wallet = args.wallet ?? args.toWallet;
        const phone = args.phone ?? args.toPhone;
        if (wallet && !WALLET_RE.test(wallet)) {
          fail("Wallet must be a 0x-prefixed 40-hex address.");
        }
        const country = args.country?.toUpperCase();
        if (country && country.length !== 2) {
          fail("Country must be a 2-letter code (e.g. PH, NG, KE).");
        }
        if (!wallet && !phone) {
          fail(
            "Add a --wallet 0x… (direct send) or --phone +… (claim link) so the contact is sendable."
          );
        }
        const existing = getContactByName(config, name);
        const contact = saveContact(config, {
          id: existing?.id ?? slugifyName(name),
          name,
          country: country ?? existing?.country,
          walletAddress: wallet ?? existing?.walletAddress,
          phone: phone ?? existing?.phone,
          favourite: args.favourite || existing?.favourite,
          source: existing?.source ?? "manual",
        });
        ok({ action: existing ? "updated" : "added", contact });
        return;
      }

      // contacts remove --name X  |  contacts rm X
      if (sub === "remove" || sub === "rm" || sub === "delete") {
        const name = args.name ?? tokens.slice(1).join(" ").trim();
        if (!name) fail('Usage: remifi contacts remove --name "Aunt May"');
        const contact = getContactByName(config, name);
        if (!contact) fail(`No contact matching "${name}".`);
        const removed = removeContact(config, contact.id);
        ok({ action: removed ? "removed" : "not_found", contact });
        return;
      }

      // contacts <name>  → lookup a single contact
      const lookup = args.name ?? args.message;
      if (lookup) {
        const contact = getContactByName(config, lookup);
        if (!contact) fail(`No contact matching "${lookup}"`);
        ok({ contact });
        return;
      }

      ok({ contacts: listContacts(config) });
      return;
    }

    case "balance": {
      const address = getAgentAddress(config);
      if (!address) fail("AGENT_PRIVATE_KEY not set — cannot read agent balance.");
      const items = await getBalances(config, address as string);
      ok({ address, items });
      return;
    }

    case "history": {
      ok({ items: getHistory(config) });
      return;
    }

    case "quote": {
      const amountError = validateAmount(args.amount);
      if (amountError) fail(amountError);
      const message = buildMessage(args, config.dataDir);
      if (!message) {
        fail(
          "Usage: remifi quote --amount 1 --recipient Mom | remifi quote --message \"Send 1 USD to Mom in the Philippines\""
        );
      }
      const quote = await quoteForMessage(
        config,
        message,
        transferContext(args)
      );
      ok({ quote, message });
      return;
    }

    case "send": {
      const amountError = validateAmount(args.amount);
      if (amountError) fail(amountError);
      const message = buildMessage(args, config.dataDir);
      if (!message) {
        fail(
          "Usage: remifi send --amount 1 --recipient Mom --yes | remifi send --message \"Send 1 USD to Mom\" --yes"
        );
      }
      const ctx = transferContext(args);
      const quote = await quoteForMessage(config, message, ctx);

      // Pre-flight: block clearly underfunded sends with actionable guidance
      // instead of letting them fail with a raw on-chain revert.
      if (quote.fundingOk === false) {
        ok({
          status: "insufficient_funds",
          quote,
          hint:
            quote.fundingHint ??
            "Agent wallet is underfunded. Fund USDC + CELO for gas, then retry.",
        });
        return;
      }

      if (quote.needsConfirmation && !args.yes) {
        ok({
          status: "needs_confirmation",
          quote,
          hint: `Amount ≥ $${config.requireConfirmationAboveUsd}. Confirm with the user, then re-run with --yes.`,
        });
        return;
      }
      const result = await executeForMessage(config, message, ctx);
      ok({
        result,
        explorerUrl: result.txHash
          ? explorerTxUrl(config.celoChainId, result.txHash)
          : null,
      });
      return;
    }

    default:
      fail(
        "Unknown command. Use: quote | send | contacts | contacts add | contacts remove | balance | history | health"
      );
  }
}

main().catch((err) => {
  const raw = err instanceof Error ? err.message : String(err);
  fail(friendlyError(raw));
});
