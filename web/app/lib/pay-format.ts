import type { ConfirmationDetail } from "../components/ConfirmationModal";
import type { QuoteResponse } from "./api";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Pull ~$0.04 from backend savings string. */
export function savingsAmount(savings?: string): string | null {
  if (!savings) return null;
  const m = savings.match(/~\$([\d.]+)/);
  return m ? m[1] : null;
}

export function formatQuoteText(
  quote: QuoteResponse,
  recipientName: string,
  t: TFn
): string {
  if (quote.kind !== "quote") return quote.summary;

  const receives = quote.recipientReceives?.toFixed(2) ?? "—";
  const dest = quote.destinationCurrency ?? "USDC";
  const fee = ((quote.mentoFeeUsd ?? 0) + (quote.estimatedGasUsd ?? 0)).toFixed(2);

  const lines = [
    t("pay.quoteLine", {
      amount: quote.intent.amount,
      currency: quote.intent.sourceCurrency,
      name: recipientName,
    }),
    t("pay.receiveLine", {
      amount: receives,
      currency: dest,
      name: recipientName,
    }),
    t("pay.feeLine", { fee }),
  ];

  const saved = savingsAmount(quote.savings);
  if (saved) lines.push(t("pay.savingsLine", { amount: saved }));

  return lines.join("\n");
}

export function formatConfirmDetails(
  quote: QuoteResponse,
  recipientName: string,
  t: TFn
): ConfirmationDetail[] {
  if (quote.kind !== "quote") return [];

  const receives = quote.recipientReceives?.toFixed(2) ?? "—";
  const dest = quote.destinationCurrency ?? "USDC";
  const fee = ((quote.mentoFeeUsd ?? 0) + (quote.estimatedGasUsd ?? 0)).toFixed(2);

  const rows: ConfirmationDetail[] = [
    { label: t("pay.detailTo"), value: recipientName },
    {
      label: t("pay.detailSend"),
      value: `${quote.intent.amount} ${quote.intent.sourceCurrency}`,
    },
    {
      label: t("pay.detailReceive"),
      value: `~${receives} ${dest}`,
    },
    { label: t("pay.detailFee"), value: `~$${fee}` },
  ];

  const saved = savingsAmount(quote.savings);
  if (saved) rows.push({ label: t("pay.detailSavings"), value: `~$${saved}` });

  return rows;
}

export function formatSuccessText(
  amount: number,
  currency: string,
  recipientName: string,
  receives: number | undefined,
  destCurrency: string | undefined,
  savings: string | undefined,
  t: TFn
): string {
  const recv = receives != null ? receives.toFixed(2) : "—";
  const dest = destCurrency ?? "USDC";
  let text = t("pay.sentOk", {
    amount,
    currency,
    name: recipientName,
    receives: recv,
    dest,
  });
  const saved = savingsAmount(savings);
  if (saved) text += `\n${t("pay.savingsLine", { amount: saved })}`;
  return text;
}
