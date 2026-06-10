import { z } from "zod";

export const SupportedLocale = z.enum(["en", "es", "pt", "fr"]);
export type SupportedLocale = z.infer<typeof SupportedLocale>;

export const TransferFrequency = z.enum([
  "once",
  "weekly",
  "biweekly",
  "monthly",
]);
export type TransferFrequency = z.infer<typeof TransferFrequency>;

export const RemittanceIntentSchema = z.object({
  locale: SupportedLocale.default("en"),
  amount: z.number().positive(),
  sourceCurrency: z.string().length(3),
  destinationCountry: z.string(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  frequency: TransferFrequency.default("once"),
  startDate: z.string().datetime().optional(),
  rawMessage: z.string(),
});

export type RemittanceIntent = z.infer<typeof RemittanceIntentSchema>;

export interface Corridor {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  sourceToken: string;
  destinationToken: string;
  /** ERC-20 decimals (default 18 for Mento stables, 6 for USDC). */
  sourceDecimals?: number;
  destinationDecimals?: number;
  mentoPair: string;
}

export interface RouteQuote {
  corridorId: string;
  amountIn: bigint;
  amountOut: bigint;
  routeHops: number;
  estimatedGasUsd: number;
  mentoFeeUsd: number;
  tradable: boolean;
}

export interface FeeComparison {
  provider: "mento" | "western_union" | "wise";
  sendAmountUsd: number;
  feeUsd: number;
  recipientReceives: number;
  effectiveRate: number;
}

export type DeliveryMethod = "wallet" | "escrow";

export interface TransferRecord {
  id: string;
  intent: RemittanceIntent;
  txHash?: string;
  status: "pending" | "confirmed" | "failed" | "scheduled";
  createdAt: string;
  confirmedAt?: string;
  feeComparison?: FeeComparison[];
  deliveryMethod?: DeliveryMethod;
  claimId?: string;
  claimUrl?: string;
}

export interface SpendingLimits {
  dailyLimitUsd: number;
  singleTransferLimitUsd: number;
  confirmationThresholdUsd: number;
  dailySpentUsd: number;
}
