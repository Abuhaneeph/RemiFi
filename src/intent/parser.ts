import type { RemittanceIntent, SupportedLocale } from "../types/index.js";
import { RemittanceIntentSchema } from "../types/index.js";
import { detectLocale, localePatterns } from "./locales/index.js";

function parseAmount(message: string, locale: SupportedLocale): number | null {
  const { amountPattern } = localePatterns[locale];
  const match = message.match(amountPattern);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? "").replace(/,/g, "");
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function parseSourceCurrency(message: string): string {
  if (/€|EUR|euro/i.test(message)) return "EUR";
  if (/£|GBP|pound/i.test(message)) return "GBP";
  return "USD";
}

function parseCountry(message: string, locale: SupportedLocale): string | null {
  const lower = message.toLowerCase();
  const { countryAliases } = localePatterns[locale];

  for (const [alias, code] of Object.entries(countryAliases)) {
    if (lower.includes(alias)) return code;
  }
  return null;
}

function parseFrequency(message: string, locale: SupportedLocale): RemittanceIntent["frequency"] {
  const { recurringVerbs } = localePatterns[locale];
  const lower = message.toLowerCase();

  if (recurringVerbs.some((re) => re.test(lower))) {
    if (/week|semana|semaine/i.test(lower)) return "weekly";
    return "monthly";
  }
  return "once";
}

function parseRecipientWallet(message: string): string | undefined {
  const match = message.match(/0x[a-fA-F0-9]{40}/);
  return match?.[0];
}

function parseRecipientName(message: string): string | undefined {
  const patterns = [
    /(?:to|para|à|pour)\s+(?:my\s+)?(\w+)/i,
    /(?:mom|mother|mamá|mãe|mère|brother|hermano|irmão|frère)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return undefined;
}

export function parseRemittanceIntent(
  message: string,
  localeOverride?: SupportedLocale
): RemittanceIntent {
  const locale = localeOverride ?? detectLocale(message);
  const amount = parseAmount(message, locale);
  const recipientName = parseRecipientName(message);
  const destinationCountry =
    parseCountry(message, locale) ?? undefined;

  if (amount === null) {
    throw new Error("Could not parse transfer amount from message");
  }
  if (!destinationCountry && !recipientName) {
    throw new Error(
      "Could not determine destination country from message (name a contact or include a country)"
    );
  }

  const intent = RemittanceIntentSchema.parse({
    locale,
    amount,
    sourceCurrency: parseSourceCurrency(message),
    destinationCountry: destinationCountry ?? "",
    recipientName,
    recipientWallet: parseRecipientWallet(message),
    frequency: parseFrequency(message, locale),
    rawMessage: message,
  });

  return intent;
}
