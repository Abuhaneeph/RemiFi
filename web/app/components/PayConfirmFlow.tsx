"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { ConnectWallet } from "./ConnectWallet";
import { TelegramLink } from "./TelegramLink";
import { useLanguage } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import {
  confirmTransfer,
  prepareTransfer,
  type PrepareTransferResponse,
} from "../lib/api";
import { signPreparedTransfer } from "../lib/transfer-sign";
import { useTelegramDeepLink } from "../hooks/useTelegramDeepLink";

export function PayConfirmFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quoteToken = searchParams.get("t")?.trim() ?? "";
  const { t } = useLanguage();
  const { isConnected } = useWallet();
  const account = useActiveAccount();
  const { telegramUserId } = useTelegramDeepLink();

  const [prepared, setPrepared] = useState<PrepareTransferResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteToken || !account?.address) {
      if (!quoteToken) setError("Missing quote link.");
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await prepareTransfer({
          quoteToken,
          senderWallet: account.address,
        });
        setPrepared(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load quote");
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteToken, account?.address]);

  const handleConfirm = async () => {
    if (!prepared || !account?.address || !quoteToken) return;
    setConfirming(true);
    setError(null);
    try {
      const hash = await signPreparedTransfer(account, prepared);
      const result = await confirmTransfer({
        quoteToken,
        receiptId: prepared.receiptId,
        txHash: hash,
        senderWallet: account.address,
        telegramUserId: telegramUserId ?? undefined,
      });
      setTxHash(result.txHash ?? hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="screen px-6 pb-10 pt-8">
      <h1 className="text-[1.6rem] font-bold text-ink">Confirm send</h1>
      <p className="mt-2 text-sm text-muted">Review and approve this transfer.</p>

      {loading ? (
        <p className="mt-8 text-sm text-soft">{t("claim.loading")}</p>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {prepared && !txHash ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <p className="text-sm text-muted">{prepared.summary}</p>
          <p className="mt-2 text-xs text-soft">{prepared.savings}</p>
          {prepared.deliveryMethod === "escrow" && prepared.claimUrl ? (
            <p className="mt-3 text-xs text-soft break-all">
              {t("pay.claimLink")}: {prepared.claimUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      {txHash ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
          <p className="font-semibold">{t("pay.confirmSuccess")}</p>
          <p className="mt-1 break-all text-xs">Tx: {txHash}</p>
          <div className="mt-4 flex flex-col gap-3">
            <TelegramLink telegramUserId={telegramUserId} />
            <button
              type="button"
              className="btn btn-block border border-line bg-surface"
              onClick={() => router.push("/home")}
            >
              {t("common.back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {!isConnected ? (
            <ConnectWallet label={t("auth.continue")} />
          ) : (
            <button
              type="button"
              className="btn btn-gradient btn-block"
              disabled={confirming || !prepared}
              onClick={() => void handleConfirm()}
            >
              {confirming ? t("pay.sending") : "Confirm send"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
