import type { TransferContext } from "./api";

const TG_KEY = "remifi.telegramUserId";

/** Identity fields for per-user agent API scoping. */
export function readUserScope(
  walletAddress?: string | null
): TransferContext {
  const ctx: TransferContext = {};
  if (walletAddress) ctx.senderWallet = walletAddress;
  if (typeof window !== "undefined") {
    const tg = sessionStorage.getItem(TG_KEY);
    if (tg) ctx.telegramUserId = tg;
  }
  return ctx;
}

export function scopeQuery(walletAddress?: string | null): string {
  const ctx = readUserScope(walletAddress);
  const params = new URLSearchParams();
  if (ctx.senderWallet) params.set("senderWallet", ctx.senderWallet);
  if (ctx.telegramUserId) params.set("telegramUserId", ctx.telegramUserId);
  const q = params.toString();
  return q ? `?${q}` : "";
}
