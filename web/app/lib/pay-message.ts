import { getCountryLabel } from "../data/countries";
import type { Person } from "../data/people";

export type PayChatKind =
  | "greeting"
  | "thanks"
  | "help"
  | "need_amount"
  | "confirm_hint"
  | "remittance";

const HAS_CURRENCY =
  /(?:\$|€|£|USD|EUR|GBP|USDm|dollars?|euros?|pounds?|dólares?)/i;

const SEND_VERB =
  /\b(?:send|transfer|pay|enviar|transferir|envoyer|pagar|mandar)\b/i;

const TO_RECIPIENT = /\b(?:to|para|à|pour)\b/i;

/** Decide whether to call the agent API or reply conversationally. */
export function classifyPayMessage(message: string): PayChatKind {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (
    /^(?:hi|hello|hey|hola|bonjour|olá|ola|salut|good morning|good evening|good afternoon)\b/i.test(
      lower
    )
  ) {
    return "greeting";
  }
  if (/^(?:thanks|thank you|gracias|merci|obrigado|obrigada)\b/i.test(lower)) {
    return "thanks";
  }
  if (/^(?:yes|yeah|yep|si|sí|oui|confirm|ok|okay)$/i.test(lower)) {
    return "confirm_hint";
  }
  if (
    /\b(?:help|how does|what can you|who are you|how do i|what is remifi)\b/i.test(
      lower
    )
  ) {
    return "help";
  }

  const hasAmount =
    HAS_CURRENCY.test(trimmed) ||
    /\b(?:send|transfer|pay|enviar|transferir|envoyer)\s+[\d,]+(?:\.\d+)?\s+(?:to|para|à|pour)\b/i.test(
      trimmed
    );

  if (hasAmount && (SEND_VERB.test(trimmed) || TO_RECIPIENT.test(trimmed))) {
    return "remittance";
  }
  if (hasAmount) return "remittance";

  if (SEND_VERB.test(trimmed) && TO_RECIPIENT.test(trimmed)) {
    return "need_amount";
  }
  if (SEND_VERB.test(trimmed)) return "need_amount";

  return "help";
}

/** i18n key under `pay.*` for conversational replies (no agent API call). */
export function payChatReplyKey(kind: PayChatKind): string {
  switch (kind) {
    case "greeting":
      return "pay.chatGreeting";
    case "thanks":
      return "pay.chatThanks";
    case "help":
      return "pay.chatHelp";
    case "need_amount":
      return "pay.chatNeedAmount";
    case "confirm_hint":
      return "pay.chatConfirmHint";
    default:
      return "pay.chatHelp";
  }
}

/** Normalize free-text Pay input into a message the agent parser understands. */
export function normalizePayMessage(message: string, contact?: Person): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;

  let normalized = trimmed;

  if (!HAS_CURRENCY.test(normalized)) {
    const bare = normalized.match(
      /^(?:send|transfer|pay)?\s*([\d]+(?:\.\d+)?)\s+to\s+(.+)$/i
    );
    if (bare) {
      normalized = `Send $${bare[1]} to ${bare[2].trim()}`;
    }
  }

  if (contact?.country) {
    const label = getCountryLabel(contact.country);
    const lower = normalized.toLowerCase();
    if (
      !lower.includes(label.toLowerCase()) &&
      !lower.includes(contact.country.toLowerCase())
    ) {
      normalized = `${normalized} in ${label}`;
    }
  }

  return normalized;
}

/** User-facing hint when the agent rejects a message shape. */
export function payErrorHint(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("could not parse transfer amount")) {
    return 'Include an amount like "$50" or "50 USD" — e.g. Send $50 to Mom.';
  }
  if (lower.includes("could not determine destination")) {
    return "Name a saved contact or include a country — e.g. Send $50 to Mom in the Philippines.";
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Check NEXT_PUBLIC_AGENT_API_KEY on Vercel matches AGENT_API_KEY on Render, then redeploy.";
  }
  if (lower.includes("cannot find module") && lower.includes("mento")) {
    return "The agent API is up but Mento quotes failed on the server — redeploy the API after the latest fix.";
  }
  return "Check api.remifi.xyz/api/health or try: Send $50 to Mom.";
}
