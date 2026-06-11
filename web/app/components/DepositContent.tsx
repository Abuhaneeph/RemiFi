"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useWallet, shortAddress } from "../context/WalletContext";
import { useLanguage } from "../context/LanguageContext";
import { celoChain } from "../lib/thirdweb";
import { ChevronLeftIcon } from "./icons";
import { ConnectWallet } from "./ConnectWallet";
import { MoonPayOnRamp } from "./MoonPayOnRamp";

export function DepositContent() {
  const { address, isConnected } = useWallet();
  const { t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(address, {
      margin: 1,
      width: 200,
      color: { dark: "#0f0f14", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [address]);

  const copyAddress = async () => {
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
          {t("deposit.title")}
        </h1>
        <span className="w-10" />
      </header>

      <div className="screen px-5 pb-8">
        {!isConnected || !address ? (
          <div className="mt-8">
            <ConnectWallet label={t("deposit.connectFirst")} />
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              <MoonPayOnRamp />
            </section>

            <p className="my-5 text-center text-xs text-soft">
              {t("deposit.orSendCrypto")}
            </p>

            <section className="flex flex-col items-center rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={t("deposit.qrAlt")}
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              ) : (
                <div className="h-[200px] w-[200px] animate-pulse rounded-lg bg-surface-subtle" />
              )}
              <p className="mt-4 text-center font-mono text-sm font-semibold text-ink">
                {shortAddress(address)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("deposit.network", { chain: celoChain.name ?? "Celo" })}
              </p>
              <button
                type="button"
                className="btn btn-outline mt-4 px-6"
                onClick={() => void copyAddress()}
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
