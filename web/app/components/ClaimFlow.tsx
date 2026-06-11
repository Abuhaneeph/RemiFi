"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { prepareContractCall, sendTransaction, getContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import type { Address } from "thirdweb";
import { ConnectWallet } from "./ConnectWallet";
import { LanguageSelector } from "./LanguageSelector";
import { useWallet, shortAddress } from "../context/WalletContext";
import { useLanguage } from "../context/LanguageContext";
import { fetchClaimInfo, type ClaimInfoResponse } from "../lib/api";
import { celoChain, getThirdwebClient } from "../lib/thirdweb";
import { ESCROW_STATUS_ACTIVE, REMIFI_VAULT_ABI } from "../lib/vault";

export function ClaimFlow() {
  const searchParams = useSearchParams();
  const claimId = searchParams.get("c") ?? searchParams.get("claimId");
  const secret = searchParams.get("s") ?? searchParams.get("secret");
  const { address, isConnected } = useWallet();
  const account = useActiveAccount();
  const { t } = useLanguage();

  const [info, setInfo] = useState<ClaimInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  useEffect(() => {
    if (!claimId) {
      setLoading(false);
      setError(t("claim.missingLink"));
      return;
    }
    void (async () => {
      try {
        const data = await fetchClaimInfo(claimId);
        setInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load claim");
      } finally {
        setLoading(false);
      }
    })();
  }, [claimId, t]);

  const handleClaim = async () => {
    if (!claimId || !secret || !info?.vaultAddress || !account?.address) return;

    const client = getThirdwebClient();
    if (!client) {
      setError(t("claim.walletConfig"));
      return;
    }

    setClaiming(true);
    setError(null);

    try {
      const contract = getContract({
        client,
        chain: celoChain,
        address: info.vaultAddress as Address,
        abi: REMIFI_VAULT_ABI,
      });

      const tx = prepareContractCall({
        contract,
        method: "claim",
        params: [
          claimId as `0x${string}`,
          secret as `0x${string}`,
          account.address as Address,
        ],
      });

      const result = await sendTransaction({ transaction: tx, account });
      setSuccessTx(result.transactionHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const alreadyClaimed = info != null && info.status !== ESCROW_STATUS_ACTIVE;

  return (
    <div className="screen px-6 pb-10 pt-8">
      <div className="mobile-only flex justify-end">
        <LanguageSelector variant="compact" />
      </div>

      <h1 className="text-[1.6rem] font-bold text-ink">{t("claim.title")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{t("claim.subtitle")}</p>

      {loading ? <p className="mt-8 text-sm text-soft">{t("claim.loading")}</p> : null}

      {error ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {info && !error ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <p className="text-sm text-muted">{t("claim.amountWaiting")}</p>
          <p className="tnum mt-1 text-2xl font-bold text-ink">
            ~{Number(info.amountFormatted).toFixed(2)}
          </p>
          <p className="mt-3 text-xs text-soft">
            {info.status === ESCROW_STATUS_ACTIVE
              ? t("claim.statusReady")
              : alreadyClaimed
                ? t("claim.statusClaimed")
                : `Status ${info.status}`}
          </p>
        </div>
      ) : null}

      {successTx ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
          <p className="font-semibold">{t("claim.claimed")}</p>
          <p className="mt-1 break-all text-xs">Tx: {successTx}</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {!isConnected ? (
            <ConnectWallet label={t("claim.createWallet")} />
          ) : (
            <>
              <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-center text-sm">
                <p className="text-muted">{t("claim.claimingTo")}</p>
                <p className="tnum mt-1 font-semibold text-ink">
                  {shortAddress(address)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-gradient btn-block"
                disabled={
                  claiming ||
                  !secret ||
                  !info ||
                  info.status !== ESCROW_STATUS_ACTIVE ||
                  alreadyClaimed
                }
                onClick={() => void handleClaim()}
              >
                {claiming ? t("claim.claiming") : t("claim.claimButton")}
              </button>
              {!secret ? (
                <p className="text-center text-xs text-soft">
                  {t("claim.missingSecret")}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
