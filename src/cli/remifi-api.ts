#!/usr/bin/env node
/**
 * Remifi HTTP client for OpenClaw / VPS — talks to the agent on Render.
 * Same command surface as `npm run remifi`, but every call goes to
 * PUBLIC_AGENT_API_URL (e.g. https://api.remifi.xyz) with x-api-key.
 *
 * Usage:
 *   npm run remifi-api -- quote --amount 5 --recipient Mom
 *   npm run remifi-api -- send --amount 5 --recipient Mom --yes
 *   npm run remifi-api -- health
 */
import "dotenv/config";
import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";
import { CELO_SEPOLIA_USDC } from "../mento/client.js";
import { explorerTxUrl } from "../utils/explorer.js";
import type { TransferContext } from "../api/service.js";

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

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function apiBase(): string {
  const url = process.env.PUBLIC_AGENT_API_URL?.replace(/\/$/, "");
  if (!url) {
    fail(
      "PUBLIC_AGENT_API_URL is not set. Production VPS needs https://api.remifi.xyz in .env."
    );
  }
  return url;
}

function apiKey(): string | undefined {
  return process.env.AGENT_API_KEY?.trim() || undefined;
}

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

function validateAmount(amount: number | undefined): string | undefined {
  if (amount == null) return undefined;
  if (!Number.isFinite(amount)) return "Amount is not a number. Example: --amount 1";
  if (amount <= 0) return "Amount must be greater than 0.";
  if (amount > 1_000_000) return "Amount is unrealistically large — double-check it.";
  return undefined;
}

function buildMessage(args: Args): string | undefined {
  if (args.message?.trim()) return args.message.trim();
  if (args.amount == null || !args.recipient) return undefined;

  const currency = (args.currency ?? "USD").toUpperCase();
  const country = args.country?.toUpperCase();
  const where = country
    ? ` in ${COUNTRY_PHRASES[country] ?? country}`
    : "";
  return `Send ${args.amount} ${currency} to ${args.recipient}${where}`;
}

function transferContext(args: Args): TransferContext | undefined {
  const ctx: TransferContext = {};
  if (args.toWallet) ctx.recipientWallet = args.toWallet;
  if (args.toPhone) ctx.recipientPhone = args.toPhone;
  return Object.keys(ctx).length ? ctx : undefined;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = apiKey();
  if (key) h["x-api-key"] = key;
  return h;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const hint =
      res.status === 401
        ? " — check AGENT_API_KEY matches the Render API service"
        : "";
    throw new Error(
      ((data as { error?: string }).error ?? `Request failed (${res.status})`) +
        hint
    );
  }
  return data;
}

function ok(data: unknown) {
  console.log(JSON.stringify({ ok: true, ...((data as object) ?? {}) }, null, 2));
}

function fail(error: string, extra?: Record<string, unknown>): never {
  console.log(JSON.stringify({ ok: false, error, ...extra }, null, 2));
  process.exit(1);
  throw new Error(error);
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const args = parseArgs();

  switch (args.command) {
    case "health": {
      const health = await apiFetch<{
        ok: boolean;
        chainId: number;
        executionReady: boolean;
        contactsCount?: number;
        vaultConfigured?: boolean;
      }>("/api/health");
      const agent = await apiFetch<{
        address: string | null;
        chainId: number;
        agentId?: number | null;
      }>("/api/agent");
      const onSepolia = health.chainId === CELO_SEPOLIA_CHAIN_ID;
      const sendToken = onSepolia ? "USDC" : "USDm";
      let balances: { symbol: string; balance: number }[] = [];
      let sendBalance = 0;
      if (agent.address) {
        const bal = await apiFetch<{
          address: string;
          items: { symbol: string; balance: number }[];
        }>(`/api/balance?address=${encodeURIComponent(agent.address)}`);
        balances = bal.items ?? [];
        sendBalance =
          balances.find((b) => b.symbol === sendToken)?.balance ?? 0;
      }
      ok({
        agentApi: apiBase(),
        chainId: health.chainId,
        network: onSepolia ? "celo-sepolia" : "celo-mainnet",
        executionReady: health.executionReady,
        agentAddress: agent.address,
        agentId: agent.agentId ?? null,
        sendToken,
        sendTokenAddress: onSepolia ? CELO_SEPOLIA_USDC : null,
        sendBalance,
        sendReady: sendBalance > 0,
        balances,
        vaultConfigured: health.vaultConfigured ?? false,
        contactsCount: health.contactsCount ?? 0,
      });
      return;
    }

    case "contacts": {
      const tokens = (args.message ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = tokens[0]?.toLowerCase();

      if (sub === "add" || sub === "save" || sub === "new" || sub === "update") {
        const name = args.name ?? tokens.slice(1).join(" ").trim();
        if (!name) {
          fail(
            'Usage: remifi-api contacts add --name "Aunt May" --country PH --wallet 0x… [--phone +…]'
          );
        }
        const wallet = args.wallet ?? args.toWallet;
        const phone = args.phone ?? args.toPhone;
        if (wallet && !WALLET_RE.test(wallet)) {
          fail("Wallet must be a 0x-prefixed 40-hex address.");
        }
        if (!wallet && !phone) {
          fail("Add --wallet 0x… or --phone +… so the contact is sendable.");
        }
        let existing: { id: string } | undefined;
        try {
          const lookup = await apiFetch<{ contact: { id: string } }>(
            `/api/contacts?name=${encodeURIComponent(name)}`
          );
          existing = lookup.contact;
        } catch {
          /* new contact */
        }
        const body = {
          id: existing?.id ?? slugifyName(name),
          name,
          country: args.country?.toUpperCase(),
          walletAddress: wallet,
          phone,
          favourite: args.favourite,
          source: "manual" as const,
        };
        const saved = await apiFetch<{ contact: unknown }>("/api/contacts", {
          method: "POST",
          body: JSON.stringify(body),
        });
        ok({ action: existing ? "updated" : "added", contact: saved.contact });
        return;
      }

      if (sub === "remove" || sub === "rm" || sub === "delete") {
        const name = args.name ?? tokens.slice(1).join(" ").trim();
        if (!name) fail('Usage: remifi-api contacts remove --name "Aunt May"');
        const lookup = await apiFetch<{ contact: { id: string; name: string } }>(
          `/api/contacts?name=${encodeURIComponent(name)}`
        );
        await apiFetch(`/api/contacts/${encodeURIComponent(lookup.contact.id)}`, {
          method: "DELETE",
        });
        ok({ action: "removed", contact: lookup.contact });
        return;
      }

      const lookup = args.name ?? args.message;
      if (lookup) {
        const data = await apiFetch<{ contact: unknown }>(
          `/api/contacts?name=${encodeURIComponent(lookup)}`
        );
        ok({ contact: data.contact });
        return;
      }

      const data = await apiFetch<{ contacts: unknown[] }>("/api/contacts");
      ok({ contacts: data.contacts });
      return;
    }

    case "balance": {
      const agent = await apiFetch<{ address: string | null }>("/api/agent");
      if (!agent.address) fail("Agent wallet not configured on the API.");
      const data = await apiFetch<{
        address: string;
        items: { symbol: string; balance: number }[];
      }>(`/api/balance?address=${encodeURIComponent(agent.address)}`);
      ok({ address: data.address, items: data.items });
      return;
    }

    case "history": {
      const data = await apiFetch<{ items: unknown[] }>("/api/history");
      ok({ items: data.items });
      return;
    }

    case "quote": {
      const amountError = validateAmount(args.amount);
      if (amountError) fail(amountError);
      const message = buildMessage(args);
      if (!message) {
        fail(
          "Usage: remifi-api quote --amount 1 --recipient Mom | remifi-api quote --message \"Send 1 USD to Mom\""
        );
      }
      const quote = await apiFetch<Record<string, unknown>>("/api/intent", {
        method: "POST",
        body: JSON.stringify({ message, ...transferContext(args) }),
      });
      ok({ quote, message });
      return;
    }

    case "send": {
      const amountError = validateAmount(args.amount);
      if (amountError) fail(amountError);
      const message = buildMessage(args);
      if (!message) {
        fail(
          "Usage: remifi-api send --amount 1 --recipient Mom --yes | remifi-api send --message \"Send 1 USD to Mom\" --yes"
        );
      }
      const ctx = transferContext(args);
      const quote = await apiFetch<{
        needsConfirmation?: boolean;
        fundingOk?: boolean;
        fundingHint?: string;
      }>("/api/intent", {
        method: "POST",
        body: JSON.stringify({ message, ...ctx }),
      });

      if (quote.fundingOk === false) {
        ok({
          status: "insufficient_funds",
          quote,
          hint:
            quote.fundingHint ??
            "Agent wallet is underfunded. Fund USDC + CELO for gas on the Render agent wallet.",
        });
        return;
      }

      if (quote.needsConfirmation && !args.yes) {
        ok({
          status: "needs_confirmation",
          quote,
          hint: "Amount requires confirmation. Get an explicit yes from the user, then re-run with --yes.",
        });
        return;
      }

      const result = await apiFetch<{
        status: string;
        txHash?: string;
        receiptId: string;
      }>("/api/transfer", {
        method: "POST",
        body: JSON.stringify({ message, ...ctx }),
      });

      const health = await apiFetch<{ chainId: number }>("/api/health");
      ok({
        result,
        explorerUrl: result.txHash
          ? explorerTxUrl(health.chainId, result.txHash)
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
  fail(err instanceof Error ? err.message : String(err));
});
