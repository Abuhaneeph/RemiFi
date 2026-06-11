"use client";

import { useState } from "react";
import { MoonPayBuyWidget } from "../lib/moonpay-widgets";
import { useLanguage } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { fiatRampEnabled } from "../lib/ramp";
import {
  moonpayBuyCurrency,
  moonpayConfigured,
  moonpayPrefillWallet,
  moonpayRampEnabled,
  moonpaySandboxMode,
  signMoonPayUrl,
} from "../lib/moonpay";

export function MoonPayOnRamp() {
  const { address, isConnected } = useWallet();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillWallet = moonpayPrefillWallet();
  const buyCurrency = moonpayBuyCurrency();
  const enabled =
    moonpayRampEnabled(fiatRampEnabled()) && isConnected && moonpayConfigured();

  const handleGetSignature = async (url: string): Promise<string> => {
    try {
      return await signMoonPayUrl(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("deposit.moonpayError");
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
        {t("deposit.buyWithCard")}
      </button>

      {!moonpayConfigured() ? (
        <p className="mt-2 text-center text-xs text-soft">{t("deposit.moonpayNotConfigured")}</p>
      ) : !fiatRampEnabled() && !moonpaySandboxMode() ? (
        <p className="mt-2 text-center text-xs text-soft">{t("deposit.fiatMainnetOnly")}</p>
      ) : null}

      {error ? <p className="mt-2 text-center text-xs text-brand-600">{error}</p> : null}

      {moonpayConfigured() ? (
        <MoonPayBuyWidget
          variant="overlay"
          visible={visible}
          baseCurrencyCode="usd"
          baseCurrencyAmount="25"
          defaultCurrencyCode={buyCurrency}
          {...(moonpaySandboxMode()
            ? {}
            : { currencyCode: buyCurrency, showOnlyCurrencies: buyCurrency })}
          theme="light"
          colorCode="%234f46e5"
          {...(prefillWallet && address
            ? {
                walletAddress: address,
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
