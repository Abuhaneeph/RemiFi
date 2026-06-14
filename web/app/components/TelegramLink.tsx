"use client";

import { telegramBotUrl, telegramReturnUrl } from "../lib/telegram";

type TelegramLinkProps = {
  telegramUserId?: string | null;
  label?: string;
  className?: string;
};

export function TelegramLink({
  telegramUserId,
  label = "Continue in Telegram",
  className = "btn btn-block border border-line bg-surface text-ink",
}: TelegramLinkProps) {
  const href = telegramUserId
    ? telegramReturnUrl(telegramUserId)
    : telegramBotUrl();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}
