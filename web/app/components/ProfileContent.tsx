"use client";

import Link from "next/link";
import { useLanguage } from "../context/LanguageContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { Avatar } from "./Avatar";
import { LanguageSelector } from "./LanguageSelector";
import { LogoutButton } from "./LogoutButton";
import { ProfileSettings } from "./ProfileSettings";
import { ProfileWalletCard } from "./ProfileWalletCard";
import { TelegramLink } from "./TelegramLink";
import { WalletAssets } from "./WalletAssets";
import { ChevronLeftIcon } from "./icons";

export function ProfileContent() {
  const { t } = useLanguage();
  const { displayName, subtitle, avatarSrc, walletLabel, profilesLoading, isConnected } =
    useUserProfile();

  const name = displayName ?? t("profile.guest");
  const detail =
    subtitle ??
    (isConnected ? t("profile.walletSubtitle") : t("profile.connectHint"));

  return (
    <>
      <header className="mobile-only flex items-center px-5 pb-3 pt-5">
        <Link href="/home" className="icon-btn" aria-label={t("common.back")}>
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-[1.05rem] font-bold">
          {t("profile.title")}
        </h1>
        <LanguageSelector variant="compact" />
      </header>

      <div className="screen px-5 pb-8">
        <div className="flex flex-col items-center pt-4 text-center">
          <Avatar name={name} src={avatarSrc} size={88} ring />
          <h2 className="mt-4 text-xl font-bold text-ink">
            {profilesLoading ? "…" : name}
          </h2>
          <p className="mt-1 text-sm text-muted">{detail}</p>
          {walletLabel ? (
            <p className="mt-0.5 text-xs font-medium text-soft">{walletLabel}</p>
          ) : null}
        </div>

        <ProfileWalletCard />
        <WalletAssets />

        <ProfileSettings />
        <LogoutButton />

        <Link href="/people" className="btn btn-gradient btn-block mt-8">
          {t("profile.manageContacts")}
        </Link>

        <div className="mt-3">
          <TelegramLink label="Chat with Remifi on Telegram" />
        </div>
      </div>
    </>
  );
}
