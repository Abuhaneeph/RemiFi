const BOT =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || "remifi_bot";

export function telegramBotUrl(startPayload?: string): string {
  if (!startPayload) return `https://t.me/${BOT}`;
  return `https://t.me/${BOT}?start=${encodeURIComponent(startPayload)}`;
}

export function telegramReturnUrl(telegramUserId: string): string {
  return telegramBotUrl(`back_${telegramUserId}`);
}

export function authUrlWithTelegram(telegramUserId: string): string {
  return `/auth?tg=${encodeURIComponent(telegramUserId)}`;
}

export function depositUrlWithTelegram(telegramUserId: string): string {
  return `/deposit?tg=${encodeURIComponent(telegramUserId)}`;
}
