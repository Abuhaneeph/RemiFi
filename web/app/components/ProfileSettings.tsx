"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { useWallet, shortAddress } from "../context/WalletContext";
import { useWalletPreferences } from "../context/WalletPreferencesContext";
import { fetchProfile, type ProfileCorridor } from "../lib/api";
import { CheckIcon } from "./icons";
import { MobileSheet } from "./MobileSheet";

const FALLBACK_LIMITS = {
  dailyLimitUsd: 500,
  singleTransferLimitUsd: 200,
  dailySpentUsd: 0,
};

const FALLBACK_CORRIDORS: ProfileCorridor[] = [
  {
    id: "usd-php",
    sourceCurrency: "USD",
    destinationCurrency: "PHP",
    destinationCountry: "PH",
    label: "USDm → PHP",
  },
];

function formatUsd(amount: number): string {
  return `$${amount} USD`;
}

export function ProfileSettings() {
  const { t } = useLanguage();
  const { isConnected, address } = useWallet();
  const { displayName, subtitle, authLabel } = useUserProfile();
  const { defaultCorridorId, setDefaultCorridorId } = useWalletPreferences();
  const [limits, setLimits] = useState(FALLBACK_LIMITS);
  const [corridors, setCorridors] = useState<ProfileCorridor[]>(FALLBACK_CORRIDORS);
  const [loading, setLoading] = useState(true);
  const [corridorOpen, setCorridorOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchProfile()
      .then((data) => {
        if (cancelled) return;
        setLimits(data.limits);
        if (data.corridors.length > 0) {
          setCorridors(data.corridors);
          setDefaultCorridorId((current) =>
            data.corridors.some((c) => c.id === current)
              ? current
              : data.defaultCorridorId
          );
        }
      })
      .catch(() => {
        /* keep fallback limits when agent API is offline */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setDefaultCorridorId]);

  const selectedCorridor =
    corridors.find((c) => c.id === defaultCorridorId) ?? corridors[0];

  const accountValue = !isConnected
    ? t("profile.notConnected")
    : displayName ?? t("profile.verified");
  const accountHint = isConnected
    ? subtitle ?? (authLabel ? `${authLabel} · ${shortAddress(address)}` : shortAddress(address))
    : undefined;

  const rows = [
    {
      key: "account",
      label: t("profile.accountDetails"),
      value: accountValue,
      hint: accountHint,
      interactive: false,
    },
    {
      key: "daily",
      label: t("profile.dailyLimit"),
      value: formatUsd(limits.dailyLimitUsd),
      hint:
        limits.dailySpentUsd > 0
          ? t("profile.dailySpent", { amount: limits.dailySpentUsd })
          : undefined,
      interactive: false,
    },
    {
      key: "single",
      label: t("profile.singleLimit"),
      value: formatUsd(limits.singleTransferLimitUsd),
      interactive: false,
    },
    {
      key: "corridor",
      label: t("profile.defaultCorridor"),
      value: selectedCorridor?.label ?? "USDm → PHP",
      interactive: true,
    },
  ];

  return (
    <>
      <div className="mt-8 flex flex-col gap-2">
        {rows.map((row) => {
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{row.label}</p>
                {row.hint ? (
                  <p className="mt-0.5 text-xs font-medium text-soft">{row.hint}</p>
                ) : null}
              </div>
              <p
                className={`text-sm font-semibold ${
                  row.key === "account" && isConnected
                    ? "text-emerald-600"
                    : "text-brand-600"
                }`}
              >
                {loading && row.key !== "corridor" ? "…" : row.value}
              </p>
            </>
          );

          if (row.interactive) {
            return (
              <button
                key={row.key}
                type="button"
                className="asset-row text-left"
                onClick={() => setCorridorOpen(true)}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={row.key} className="asset-row">
              {content}
            </div>
          );
        })}
      </div>

      <MobileSheet
        open={corridorOpen}
        onClose={() => setCorridorOpen(false)}
        title={t("profile.selectCorridor")}
        subtitle={t("profile.selectCorridorHint")}
        stacked
        size="list"
      >
        <div className="sheet-list">
          <div className="sheet-options">
            {corridors.map((item) => {
              const selected = item.id === defaultCorridorId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sheet-option ${selected ? "sheet-option-active" : ""}`}
                  onClick={() => {
                    setDefaultCorridorId(item.id);
                    setCorridorOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="text-xs font-medium text-soft">
                      {item.sourceCurrency} → {item.destinationCountry}
                    </span>
                  </span>
                  {selected ? (
                    <CheckIcon className="h-5 w-5 shrink-0 text-brand-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </MobileSheet>
    </>
  );
}
