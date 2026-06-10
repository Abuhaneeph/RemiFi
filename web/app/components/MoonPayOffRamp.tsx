"use client";

import { useState } from "react";
import { MoonPaySellWidget } from "../lib/moonpay-widgets";
import { useLanguage } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { fiatRampEnabled } from "../lib/ramp";
import {
  moonpayConfigured,
  moonpayPrefillWallet,
  moonpayRampEnabled,
  moonpaySandboxMode,
  moonpaySellCurrency,
  signMoonPayUrl,
} from "../lib/moonpay";

export function MoonPayOffRamp() {
  const { address, isConnected } = useWallet();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillWallet = moonpayPrefillWallet();
  const sellCurrency = moonpaySellCurrency();
  const enabled =
    moonpayRampEnabled(fiatRampEnabled()) && isConnected && moonpayConfigured();

  const handleGetSignature = async (url: string): Promise<string> => {
    try {
      return await signMoonPayUrl(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("withdraw.moonpayError");
      setError(message);
      setVisible(false);
      throw new Error(message);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-gradient btn-block"
        disabled={!enabled}
        onClick={() => {
          setError(null);
          setVisible(true);
        }}
      >
        {t("withdraw.cashOutMoonPay")}
      </button>

      {!moonpayConfigured() ? (
        <p className="mt-2 text-xs text-soft">{t("deposit.moonpayNotConfigured")}</p>
      ) : !fiatRampEnabled() && !moonpaySandboxMode() ? (
        <p className="mt-2 text-xs text-soft">{t("deposit.fiatMainnetOnly")}</p>
      ) : moonpaySandboxMode() ? (
        <p className="mt-2 text-xs text-muted">{t("deposit.moonpaySandboxHint")}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">{t("withdraw.moonpayHint")}</p>
      )}

      {error ? <p className="mt-2 text-xs text-brand-600">{error}</p> : null}

      {moonpayConfigured() ? (
        <MoonPaySellWidget
          variant="overlay"
          visible={visible}
          defaultBaseCurrencyCode={sellCurrency}
          quoteCurrencyCode="usd"
          {...(moonpaySandboxMode()
            ? {}
            : { showOnlyCurrencies: sellCurrency })}
          theme="light"
          colorCode="%234f46e5"
          {...(prefillWallet && address
            ? {
                refundWalletAddress: address,
                onUrlSignatureRequested: handleGetSignature,
              }
            : {})}
          onClose={async () => {
            setVisible(false);
          }}
        />
      ) : null}
    </>
  );
}
