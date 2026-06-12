"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "../context/LanguageContext";
import { TelegramLink } from "./TelegramLink";

export function AIPayBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();

  return (
    <div
      className={
        compact ? "ai-pay-banner-wrap ai-pay-banner-compact" : "ai-pay-banner-wrap mt-7"
      }
    >
      <Link href="/pay" className="ai-pay-banner">
        <div className="relative z-10 min-w-0 py-1 pr-36">
          <p className="text-[1.08rem] font-bold leading-tight text-ink-900">
            {t("home.tryAiPay")}
          </p>
          <p className="mt-1 max-w-[11rem] text-[0.85rem] font-medium leading-snug text-ink-900/70">
            {t("home.tryAiPayHint")}
          </p>
        </div>
        <Image
          src="/assets/img1.png"
          alt=""
          width={320}
          height={220}
          priority
          loading="eager"
          fetchPriority="high"
          sizes="216px"
          aria-hidden
          className="ai-pay-coins pointer-events-none"
        />
      </Link>
      <div className="mt-3">
        <TelegramLink
          label="Or chat on Telegram"
          className="btn btn-block border border-line bg-surface text-sm font-semibold text-ink"
        />
      </div>
    </div>
  );
}
