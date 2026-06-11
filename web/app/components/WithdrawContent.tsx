"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet, shortAddress } from "../context/WalletContext";
import { useLanguage } from "../context/LanguageContext";
import { ChevronLeftIcon } from "./icons";
import { OffRampPartners } from "./OffRampPartners";
import { ConnectWallet } from "./ConnectWallet";

export function WithdrawContent() {
  const { address, isConnected } = useWallet();
  const { t } = useLanguage();
  const [external, setExternal] = useState("");
  const [copied, setCopied] = useState(false);

  const copyWallet = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="mobile-only flex items-center px-5 pb-3 pt-5">
        <Link href="/home" className="icon-btn" aria-label={t("common.back")}>
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-[1.05rem] font-bold">
          {t("withdraw.title")}
        </h1>
        <span className="w-10" />
      </header>

      <div className="screen px-5 pb-8">
        <p className="text-sm text-muted">{t("withdraw.subtitle")}</p>

        {!isConnected || !address ? (
          <div className="mt-8">
            <ConnectWallet label={t("withdraw.connectFirst")} />
          </div>
        ) : (
          <>
            <OffRampPartners />

            <section className="mt-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("withdraw.externalTitle")}
              </p>
              <p className="mt-2 text-sm text-muted">{t("withdraw.externalHint")}</p>
              <input
                type="text"
                value={external}
                onChange={(e) => setExternal(e.target.value)}
                placeholder="0x…"
                className="form-field mt-3 w-full font-mono text-sm"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-soft">{t("withdraw.externalNote")}</p>
            </section>

            <section className="summary-card mt-6">
              <p className="text-sm font-semibold text-ink">{t("withdraw.yourWallet")}</p>
              <p className="mt-1 font-mono text-sm text-brand-700">{shortAddress(address)}</p>
              <button
                type="button"
                className="btn btn-outline mt-3 px-5"
                onClick={() => void copyWallet()}
              >
                {copied ? t("deposit.copied") : t("deposit.copy")}
              </button>
            </section>
          </>
        )}
      </div>
    </>
  );
}
