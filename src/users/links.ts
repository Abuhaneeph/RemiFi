import type { Config } from "../config/index.js";

function webBase(config: Config): string {
  return config.publicBaseUrl?.replace(/\/$/, "") ?? "https://remifi.xyz";
}

function botUsername(config: Config): string {
  return config.telegramBotUsername ?? "remifi_bot";
}

export function authUrl(config: Config, telegramUserId: string): string {
  const base = webBase(config);
  return `${base}/auth?tg=${encodeURIComponent(telegramUserId)}`;
}

export function depositUrl(config: Config, telegramUserId: string): string {
  const base = webBase(config);
  return `${base}/deposit?tg=${encodeURIComponent(telegramUserId)}`;
}

export function peopleUrl(config: Config, telegramUserId: string): string {
  const base = webBase(config);
  return `${base}/people?tg=${encodeURIComponent(telegramUserId)}`;
}

export function confirmPayUrl(config: Config, quoteToken: string): string {
  const base = webBase(config);
  return `${base}/pay/confirm?t=${encodeURIComponent(quoteToken)}`;
}

export function telegramBotUrl(config: Config, startPayload?: string): string {
  const bot = botUsername(config);
  if (!startPayload) return `https://t.me/${bot}`;
  return `https://t.me/${bot}?start=${encodeURIComponent(startPayload)}`;
}

export function telegramReturnUrl(
  config: Config,
  telegramUserId: string
): string {
  return telegramBotUrl(config, `back_${telegramUserId}`);
}
