"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { PROFILE } from "../data/people";
import { useLanguage } from "../context/LanguageContext";
import { Avatar } from "./Avatar";
import { LanguageSelector } from "./LanguageSelector";
import { ProfileSettings } from "./ProfileSettings";
import { ChevronLeftIcon } from "./icons";

const ProfileWalletCard = dynamic(
  () => import("./ProfileWalletCard").then((m) => m.ProfileWalletCard),
  {
    loading: () => (
      <div className="mt-6 h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle" />
    ),
  }
);

const WalletAssets = dynamic(
  () => import("./WalletAssets").then((m) => m.WalletAssets),
  {
    loading: () => (
      <div className="mt-7 h-40 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle" />
    ),
  }
);

export function ProfileContent() {
  const { t } = useLanguage();

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
          <Avatar name={PROFILE.name} src={PROFILE.avatar} size={88} ring />
          <h2 className="mt-4 text-xl font-bold text-ink">{PROFILE.name}</h2>
          <p className="mt-1 text-sm text-muted">{t("profile.walletSubtitle")}</p>
        </div>

        <ProfileWalletCard />
        <WalletAssets />

        <ProfileSettings />

        <Link href="/people" className="btn btn-gradient btn-block mt-8">
          {t("profile.manageContacts")}
        </Link>
      </div>
    </>
  );
}
