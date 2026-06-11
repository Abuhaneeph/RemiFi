"use client";

import { useLanguage } from "../context/LanguageContext";
import { MoonPayOffRamp } from "./MoonPayOffRamp";

const REGIONAL_METHODS = [
  { id: "gcash", name: "GCash", region: "Philippines" },
  { id: "mpesa", name: "M-Pesa", region: "Kenya" },
  { id: "pix", name: "Pix", region: "Brazil" },
  { id: "sepa", name: "SEPA", region: "Europe" },
];

export function OffRampPartners() {
  const { t } = useLanguage();

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t("withdraw.cashOut")}
      </p>
      <p className="mt-1 text-sm text-muted">{t("withdraw.cashOutHint")}</p>

      <div className="mt-4">
        <MoonPayOffRamp />
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("withdraw.regionalMethods")}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {REGIONAL_METHODS.map((p) => (
          <div key={p.id} className="asset-row">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="text-xs text-muted">{p.region}</p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-700">
              {t("withdraw.viaMoonPay")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
