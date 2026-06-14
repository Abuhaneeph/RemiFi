"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ConnectWallet } from "./ConnectWallet";
import { LanguageSelector } from "./LanguageSelector";
import { TelegramLink } from "./TelegramLink";
import { TelegramWalletLink } from "./TelegramWalletLink";
import { useWallet, shortAddress } from "../context/WalletContext";
import { useLanguage } from "../context/LanguageContext";
import { markUserAuthStarted } from "../lib/api";
import { useTelegramDeepLink } from "../hooks/useTelegramDeepLink";

export function AuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useWallet();
  const { t } = useLanguage();
  const { telegramUserId } = useTelegramDeepLink();

  useEffect(() => {
    if (telegramUserId) {
      void markUserAuthStarted(telegramUserId).catch(() => {});
    }
  }, [telegramUserId]);

  useEffect(() => {
    if (!isConnected) return;
    const next =
      searchParams.get("tg") && searchParams.get("tg") !== "linked"
        ? "/home?tg=linked"
        : "/home";
    const timer = setTimeout(() => router.push(next), 1200);
    return () => clearTimeout(timer);
  }, [isConnected, router, searchParams]);

  return (
      <div className="screen px-7 pb-8 pt-6">
        <div className="flex justify-end">
          <LanguageSelector variant="compact" />
        </div>

        <div className="relative mt-2 flex flex-1 items-center justify-center">
          <div className="bg-hero-glow absolute inset-x-0 top-6 mx-auto h-64 w-64 rounded-full blur-2xl" />
          <Image
            src="/assets/img1.png"
            alt="RemitClaw wallet"
            width={520}
            height={360}
            priority
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 440px) 78vw, 300px"
            className="animate-coin-bob relative w-[78%] max-w-[300px] drop-shadow-2xl"
          />
        </div>

        <div className="animate-float-in mt-2 text-center">
          <h1 className="text-[2.2rem] leading-[1.1] text-ink">
            {t("auth.title1")}
            <br />
            {t("auth.title2")}
          </h1>
          <p className="mx-auto mt-4 max-w-[19rem] text-[0.95rem] leading-6 text-muted">
            {t("auth.subtitle")}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          {isConnected ? (
            <div className="w-full rounded-[var(--radius-lg)] border border-accent-200 bg-accent-50 p-4 text-center">
              <p className="text-sm font-semibold text-accent-700">
                {t("auth.connected")}
              </p>
              <p className="tnum mt-1 text-sm text-muted">
                {shortAddress(address)}
              </p>
              <p className="mt-2 text-xs text-soft">{t("auth.takingHome")}</p>
            </div>
          ) : (
            <ConnectWallet label={t("auth.continue")} />
          )}

          {telegramUserId ? (
            <TelegramLink
              telegramUserId={telegramUserId}
              className="text-sm font-semibold text-brand-600"
              label="Return to Telegram after setup"
            />
          ) : (
            <Link href="/home" className="text-sm font-semibold text-muted">
              {t("auth.skip")}
            </Link>
          )}
        </div>
        <TelegramWalletLink />
      </div>
  );
}
