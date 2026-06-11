"use client";

import Link from "next/link";
import { useState } from "react";
import type { Address } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { useWallet } from "../context/WalletContext";
import { useLanguage } from "../context/LanguageContext";
import { isValidWalletAddress, parseWalletFromQr } from "../lib/qr";
import { sendUsdcFromWallet } from "../lib/wallet-send";
import { ChevronLeftIcon } from "./icons";
import { ConnectWallet } from "./ConnectWallet";
import { MoonPayOffRamp } from "./MoonPayOffRamp";

export function WithdrawContent() {
  const { address, isConnected } = useWallet();
  const account = useActiveAccount();
  const { t } = useLanguage();
  const [external, setExternal] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const recipient = external.trim();
  const canSend =
    isValidWalletAddress(recipient) &&
    Number(amount) > 0 &&
    !sending &&
    Boolean(account);

  const handleSend = async () => {
    if (!account || !canSend) return;
    if (recipient.toLowerCase() === address?.toLowerCase()) {
      setError(t("withdraw.sameWallet"));
      return;
    }

    setSending(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await sendUsdcFromWallet(
        account,
        recipient as Address,
        amount
      );
      setTxHash(hash);
      setAmount("");
      setExternal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("withdraw.sendFailed"));
    } finally {
      setSending(false);
    }
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
        {!isConnected || !address ? (
          <div className="mt-8">
            <ConnectWallet label={t("withdraw.connectFirst")} />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <MoonPayOffRamp />
            </div>

            <p className="my-5 text-center text-xs text-soft">
              {t("withdraw.orSendWallet")}
            </p>

            <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-ink">{t("withdraw.externalTitle")}</p>
              <input
                type="text"
                value={external}
                onChange={(e) => {
                  setExternal(e.target.value);
                  setError(null);
                  setTxHash(null);
                }}
                onBlur={() => {
                  const parsed = parseWalletFromQr(external);
                  if (parsed) setExternal(parsed);
                }}
                onPaste={(e) => {
                  const parsed = parseWalletFromQr(e.clipboardData.getData("text"));
                  if (parsed) {
                    e.preventDefault();
                    setExternal(parsed);
                  }
                }}
                placeholder="0x…"
                className="form-field mt-3 w-full font-mono text-sm"
                spellCheck={false}
              />
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                  setTxHash(null);
                }}
                placeholder={t("withdraw.amountPlaceholder")}
                className="form-field mt-3 w-full text-sm"
              />
              <button
                type="button"
                className="btn btn-gradient btn-block mt-4"
                disabled={!canSend}
                onClick={() => void handleSend()}
              >
                {sending ? t("withdraw.sending") : t("withdraw.send")}
              </button>
              {error ? (
                <p className="mt-2 text-center text-xs text-brand-600">{error}</p>
              ) : null}
              {txHash ? (
                <p className="mt-2 text-center text-xs text-accent-600">
                  {t("withdraw.sent")}
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </>
  );
}
