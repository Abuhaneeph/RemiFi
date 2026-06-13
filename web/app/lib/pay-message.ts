import { getCountryLabel } from "../data/countries";
import type { Person } from "../data/people";

const HAS_CURRENCY =
  /(?:\$|€|£|USD|EUR|GBP|USDm|dollars?|euros?|pounds?|dólares?)/i;

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
  if (lower.includes("not tradable") || lower.includes("circuit breaker")) {
    return "The on-chain swap route may be paused — try again later or a different amount.";
  }
  return "Check api.remifi.xyz/api/health or try: Send $50 to Mom.";
}

/** Avoid doubling the error prefix when the API already returned a full sentence. */
export function formatPayError(
  reason: string,
  errorPrefix: string
): string {
  const trimmed = reason.trim();
  if (trimmed.startsWith(errorPrefix) || trimmed.includes(errorPrefix)) {
    const hint = payErrorHint(trimmed);
    return hint && !trimmed.includes(hint) ? `${trimmed} ${hint}` : trimmed;
  }
  return `${errorPrefix} ${trimmed}. ${payErrorHint(trimmed)}`;
}
