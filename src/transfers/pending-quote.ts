import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/index.js";
import type { RemittanceIntent } from "../types/index.js";
import type { TransferContext } from "../api/transfer-context.js";
import type { UnsignedTransaction } from "./prepare-user.js";
import { confirmPayUrl } from "../users/links.js";
import { pendingQuotesPath } from "../users/paths.js";

const TTL_MS = 5 * 60 * 1000;

export type PendingQuote = {
  token: string;
  userId: string;
  message: string;
  ctx?: TransferContext;
  intent: RemittanceIntent;
  walletAddress: string;
  receiptId: string;
  deliveryMethod: "wallet" | "escrow";
  recipientReceives: number;
  destinationCurrency: string;
  summary: string;
  savings: string;
  transactions: UnsignedTransaction[];
  claimUrl?: string;
  claimId?: string;
  claimSecret?: string;
  createdAt: string;
  expiresAt: string;
  confirmUrl: string;
};

type Store = { quotes: PendingQuote[] };

function ensureDir(config: Config): void {
  const dir = join(config.dataDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadStore(config: Config): Store {
  ensureDir(config);
  const path = pendingQuotesPath(config);
  if (!existsSync(path)) return { quotes: [] };
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Store;
  } catch {
    return { quotes: [] };
  }
}

function saveStore(config: Config, store: Store): void {
  ensureDir(config);
  writeFileSync(pendingQuotesPath(config), JSON.stringify(store, null, 2));
}

function prune(store: Store): PendingQuote[] {
  const now = Date.now();
  return store.quotes.filter((q) => new Date(q.expiresAt).getTime() > now);
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

export function createPendingQuote(
  config: Config,
  input: Omit<PendingQuote, "token" | "createdAt" | "expiresAt" | "confirmUrl">
): PendingQuote {
  const store = loadStore(config);
  const quotes = prune(store).filter((q) => q.userId !== input.userId);
  const now = new Date();
  const token = newToken();
  const quote: PendingQuote = {
    ...input,
    token,
    walletAddress: input.walletAddress.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    confirmUrl: confirmPayUrl(config, token),
  };
  quotes.push(quote);
  saveStore(config, { quotes });
  return quote;
}

export function getPendingQuote(
  config: Config,
  token: string
): PendingQuote | undefined {
  const store = loadStore(config);
  const quotes = prune(store);
  if (quotes.length !== store.quotes.length) {
    saveStore(config, { quotes });
  }
  return quotes.find((q) => q.token === token);
}

export function getPendingQuoteForUser(
  config: Config,
  userId: string
): PendingQuote | undefined {
  const store = loadStore(config);
  const quotes = prune(store);
  if (quotes.length !== store.quotes.length) {
    saveStore(config, { quotes });
  }
  return quotes.find((q) => q.userId === userId);
}

export function consumePendingQuote(
  config: Config,
  token: string
): PendingQuote | undefined {
  const store = loadStore(config);
  const quotes = prune(store);
  const idx = quotes.findIndex((q) => q.token === token);
  if (idx < 0) {
    saveStore(config, { quotes });
    return undefined;
  }
  const [quote] = quotes.splice(idx, 1);
  saveStore(config, { quotes });
  return quote;
}
