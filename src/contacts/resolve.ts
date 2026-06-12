import type { TransferContext } from "../api/transfer-context.js";
import { findContactByName, findContactByPhone } from "./store.js";
import type { StoredContact } from "./types.js";

export function contactToTransferContext(
  contact: StoredContact
): TransferContext {
  const ctx: TransferContext = {};
  if (contact.country) ctx.destinationCountry = contact.country;
  if (contact.walletAddress) ctx.recipientWallet = contact.walletAddress;
  if (contact.phone) ctx.recipientPhone = contact.phone;
  return ctx;
}

export function resolveContactContext(
  dataDir: string,
  recipientName?: string,
  senderPhone?: string
): TransferContext | undefined {
  const contact =
    (recipientName?.trim()
      ? findContactByName(dataDir, recipientName)
      : undefined) ??
    (senderPhone?.trim()
      ? findContactByPhone(dataDir, senderPhone)
      : undefined);

  if (!contact) return undefined;
  const ctx = contactToTransferContext(contact);
  return Object.keys(ctx).length ? ctx : undefined;
}
