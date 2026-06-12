/** Optional contact / identity fields from channels and the web app. */
export interface TransferContext {
  destinationCountry?: string;
  recipientWallet?: string;
  recipientPhone?: string;
  /** WhatsApp / channel sender — used to match contacts by phone. */
  senderPhone?: string;
  /** Telegram user id — scopes contacts/history and onboarding. */
  telegramUserId?: string;
  /** Connected Thirdweb wallet — user-signed sends and balance checks. */
  senderWallet?: string;
  /** Resolved internal user id (optional). */
  userId?: string;
}

export function transferContextFromBody(
  body: Record<string, unknown>
): TransferContext | undefined {
  const ctx: TransferContext = {};
  if (body.destinationCountry) {
    ctx.destinationCountry = String(body.destinationCountry).toUpperCase();
  }
  if (
    body.recipientWallet &&
    /^0x[a-fA-F0-9]{40}$/.test(String(body.recipientWallet))
  ) {
    ctx.recipientWallet = String(body.recipientWallet);
  }
  if (body.recipientPhone) ctx.recipientPhone = String(body.recipientPhone);
  if (body.senderPhone) ctx.senderPhone = String(body.senderPhone);
  if (body.telegramUserId) ctx.telegramUserId = String(body.telegramUserId);
  if (
    body.senderWallet &&
    /^0x[a-fA-F0-9]{40}$/.test(String(body.senderWallet))
  ) {
    ctx.senderWallet = String(body.senderWallet);
  }
  if (body.userId) ctx.userId = String(body.userId);
  return Object.keys(ctx).length ? ctx : undefined;
}
