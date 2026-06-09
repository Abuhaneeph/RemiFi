import { formatUnits, type Address } from "viem";
import type { Config } from "../config/index.js";
import type { RemittanceIntent } from "../types/index.js";
import { parseRemittanceIntent } from "../intent/parser.js";
import { prepareTransfer, getSpendingLimits } from "../transfers/executor.js";
import { compareFees, formatSavings } from "../fees/comparison.js";
import {
  cancelSchedule,
  listSchedules,
  scheduleRecurringTransfer,
  setScheduleActive,
  type ScheduleEntry,
} from "../transfers/scheduler.js";
import { RemitClawAgent } from "../agent/remitclaw-agent.js";
import {
  findRecentDuplicate,
  getDailySpentUsd,
  loadTransactions,
  saveTransaction,
} from "../history/store.js";
import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";
import {
  CELO_SEPOLIA_USDC,
  corridorDestinationDecimals,
  corridorSourceDecimals,
  loadCorridors,
  stableTokensForChain,
} from "../mento/client.js";
import type { Corridor } from "../types/index.js";
import {
  getAgentAccount,
  getNativeBalance,
  getTokenBalance,
} from "../wallet/client.js";
import { resolveContactContext } from "../contacts/resolve.js";
import {
  findContactByName,
  findContactByPhone,
  importPhoneContacts,
  loadContacts,
  syncContacts,
  upsertContact,
  deleteContact,
} from "../contacts/store.js";
import type { PhoneImportEntry } from "../contacts/types.js";
import type { StoredContact } from "../contacts/types.js";
import { executeEscrowRemittance, readEscrow, vaultConfigured } from "../escrow/client.js";
import { notifyClaimLink } from "../notifications/twilio.js";
import { executeRemittance } from "../transfers/onchain.js";

export interface QuoteResult {
  kind: "quote" | "schedule";
  intent: RemittanceIntent;
  summary: string;
  savings?: string;
  needsConfirmation?: boolean;
  recipientReceives?: number;
  destinationCurrency?: string;
  mentoFeeUsd?: number;
  estimatedGasUsd?: number;
  routeHops?: number;
  mentoPair?: string;
  scheduleNextRunAt?: string;
  deliveryMethod?: "wallet" | "escrow";
  matchedContact?: string;
  /** Live Mento implied rate: destination units per 1 source unit. */
  exchangeRate?: number;
  /** Pre-flight funding check — true when a send would have enough token + gas. */
  fundingOk?: boolean;
  /** Agent's available balance of the source token (human units). */
  agentSourceBalance?: number;
  /** How much more source token the agent needs to cover this send. */
  shortfall?: number;
  /** Whether the agent holds any native CELO for gas. */
  gasOk?: boolean;
  /** Remaining daily spend allowance (USD) after this transfer. */
  dailyRemainingUsd?: number;
  /** Human-readable blocker when fundingOk is false. */
  fundingHint?: string;
}

export interface AgentFunding {
  fundingOk: boolean;
  agentSourceBalance: number;
  shortfall: number;
  gasOk: boolean;
  fundingHint?: string;
}

/**
 * Pre-flight check: does the agent wallet hold enough source token + gas to
 * execute this transfer? Never throws — funding info is best-effort so a quote
 * still renders if an RPC read fails.
 */
export async function getAgentFunding(
  config: Config,
  corridor: Corridor,
  amountUsd: number
): Promise<AgentFunding | undefined> {
  let address: Address;
  try {
    address = getAgentAccount(config).address;
  } catch {
    return undefined;
  }

  try {
    const decimals = corridorSourceDecimals(corridor);
    const [rawToken, rawNative] = await Promise.all([
      getTokenBalance(config, corridor.sourceToken as Address, address),
      getNativeBalance(config, address),
    ]);
    const balance = Number(formatUnits(rawToken, decimals));
    const gasOk = rawNative > 0n;
    const hasFunds = balance >= amountUsd;
    const shortfall = hasFunds ? 0 : Number((amountUsd - balance).toFixed(6));

    let fundingHint: string | undefined;
    if (!hasFunds) {
      fundingHint = `Agent wallet needs ${shortfall} more ${corridor.sourceCurrency} (has ${balance}).`;
    } else if (!gasOk) {
      fundingHint = "Agent wallet has no CELO for gas — fund it before sending.";
    }

    return {
      fundingOk: hasFunds && gasOk,
      agentSourceBalance: balance,
      shortfall,
      gasOk,
      fundingHint,
    };
  } catch {
    return undefined;
  }
}

export interface ExecuteResult {
  status: "confirmed" | "failed";
  receiptId: string;
  txHash?: string;
  recipientReceives: number;
  destinationCurrency: string;
  summary: string;
  savings: string;
  deliveryMethod?: "wallet" | "escrow";
  claimUrl?: string;
  notificationSent?: boolean;
}

/** Optional contact fields from the web app (override parsed intent). */
export interface TransferContext {
  destinationCountry?: string;
  recipientWallet?: string;
  recipientPhone?: string;
  /** WhatsApp / channel sender — used to match contacts by phone. */
  senderPhone?: string;
}

function applyTransferContext(
  intent: RemittanceIntent,
  ctx?: TransferContext
): RemittanceIntent {
  if (!ctx) return intent;
  return {
    ...intent,
    destinationCountry: ctx.destinationCountry ?? intent.destinationCountry,
    recipientWallet: ctx.recipientWallet ?? intent.recipientWallet,
    recipientPhone: ctx.recipientPhone ?? intent.recipientPhone,
  };
}

/** Merge parsed intent with saved contacts and explicit caller context. */
export function resolveIntent(
  config: Config,
  message: string,
  ctx?: TransferContext
): { intent: RemittanceIntent; matchedContact?: string } {
  const parsed = parseRemittanceIntent(message);
  const contactCtx = resolveContactContext(
    config.dataDir,
    parsed.recipientName,
    ctx?.senderPhone
  );
  const matched =
    findContactByName(config.dataDir, parsed.recipientName ?? "") ??
    (ctx?.senderPhone
      ? findContactByPhone(config.dataDir, ctx.senderPhone)
      : undefined);
  const matchedContact = matched?.name;

  let intent = applyTransferContext(parsed, contactCtx);
  intent = applyTransferContext(intent, ctx);
  return { intent, matchedContact };
}

function deliveryHint(intent: RemittanceIntent, config: Config): {
  method: "wallet" | "escrow" | "demo" | "missing";
} {
  if (intent.recipientWallet) return { method: "wallet" };
  if (intent.recipientPhone && vaultConfigured(config)) return { method: "escrow" };
  if (config.demoRecipientAddress) return { method: "demo" };
  return { method: "missing" };
}

/** Parse a message and (for one-time sends) attach a live Mento quote + fee comparison. */
export async function quoteForMessage(
  config: Config,
  message: string,
  ctx?: TransferContext
): Promise<QuoteResult> {
  const { intent, matchedContact } = resolveIntent(config, message, ctx);

  if (intent.frequency !== "once") {
    const schedule = scheduleRecurringTransfer(config.dataDir, intent);
    return {
      kind: "schedule",
      intent,
      summary: `Scheduled ${intent.frequency} transfer of ${intent.amount} ${intent.sourceCurrency} to ${intent.destinationCountry}. Next run: ${schedule.nextRunAt}`,
      scheduleNextRunAt: schedule.nextRunAt,
      matchedContact,
    };
  }

  const { corridor, quote, needsConfirmation } = await prepareTransfer(
    config,
    intent
  );

  const corridorKey = `${corridor.sourceCurrency}-${corridor.destinationCountry.slice(0, 2)}`;
  const destDecimals = corridorDestinationDecimals(corridor);
  const recipientReceives = Number(formatUnits(quote.amountOut, destDecimals));
  const comparisons = compareFees(
    corridorKey,
    intent.amount,
    quote.mentoFeeUsd,
    recipientReceives
  );
  const savings = formatSavings(comparisons);
  const delivery = deliveryHint(intent, config);
  const destLabel =
    corridor.mentoPair.includes("USDC") ? "USDC" : corridor.destinationCurrency;

  const funding = await getAgentFunding(config, corridor, intent.amount);
  const limits = getSpendingLimits(config);
  const dailyRemainingUsd = Number(
    Math.max(0, limits.dailyLimitUsd - limits.dailySpentUsd).toFixed(2)
  );

  const deliveryLine =
    delivery.method === "escrow"
      ? "Delivery: claim link via SMS/WhatsApp (phone on file)"
      : delivery.method === "wallet"
        ? "Delivery: direct to wallet on file"
        : delivery.method === "demo"
          ? "Delivery: demo wallet (add phone or wallet on contact)"
          : "Delivery: add a wallet or phone on the contact to continue";

  const summary = [
    `Route: ${corridor.mentoPair} (${quote.routeHops} hop${quote.routeHops === 1 ? "" : "s"})`,
    `Send: ${intent.amount} ${intent.sourceCurrency}`,
    `Recipient receives: ~${recipientReceives.toFixed(2)} ${destLabel}`,
    `Mento fee: ~$${quote.mentoFeeUsd.toFixed(2)} | Gas: ~$${quote.estimatedGasUsd.toFixed(4)}`,
    deliveryLine,
    funding && !funding.fundingOk ? `⚠️ ${funding.fundingHint}` : null,
    savings,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    kind: "quote",
    intent,
    summary,
    savings,
    needsConfirmation,
    recipientReceives,
    destinationCurrency: destLabel,
    mentoFeeUsd: quote.mentoFeeUsd,
    estimatedGasUsd: quote.estimatedGasUsd,
    routeHops: quote.routeHops,
    mentoPair: corridor.mentoPair,
    deliveryMethod:
      delivery.method === "escrow"
        ? "escrow"
        : delivery.method === "wallet"
          ? "wallet"
          : undefined,
    matchedContact,
    exchangeRate:
      intent.amount > 0 ? recipientReceives / intent.amount : undefined,
    fundingOk: funding?.fundingOk,
    agentSourceBalance: funding?.agentSourceBalance,
    shortfall: funding?.shortfall,
    gasOk: funding?.gasOk,
    fundingHint: funding?.fundingHint,
    dailyRemainingUsd,
  };
}

export function getSchedules(config: Config): ScheduleEntry[] {
  return listSchedules(config.dataDir);
}

export function removeSchedule(config: Config, id: string): boolean {
  return cancelSchedule(config.dataDir, id);
}

export function toggleSchedule(
  config: Config,
  id: string,
  active: boolean
): ScheduleEntry | null {
  return setScheduleActive(config.dataDir, id, active);
}

/**
 * Execute a transfer derived from a natural-language message.
 * Wallet → direct on-chain send. Phone only → escrow vault + claim link.
 */
export async function executeForMessage(
  config: Config,
  message: string,
  ctx?: TransferContext
): Promise<ExecuteResult> {
  const { intent } = resolveIntent(config, message, ctx);
  const { corridor, quote } = await prepareTransfer(config, intent);
  const corridorKey = `${corridor.sourceCurrency}-${corridor.destinationCountry.slice(0, 2)}`;
  const destDecimals = corridorDestinationDecimals(corridor);
  const recipientReceives = Number(formatUnits(quote.amountOut, destDecimals));
  const destLabelExec =
    corridor.mentoPair.includes("USDC") ? "USDC" : corridor.destinationCurrency;

  // Idempotency: refuse to re-send an identical transfer within 90s.
  const duplicate = findRecentDuplicate(config.dataDir, intent);
  if (duplicate && duplicate.status === "confirmed") {
    return {
      status: "confirmed",
      receiptId: duplicate.id,
      txHash: duplicate.txHash,
      recipientReceives,
      destinationCurrency: destLabelExec,
      summary: `Duplicate ignored — an identical ${intent.amount} ${intent.sourceCurrency} transfer just completed (receipt ${duplicate.id}).`,
      savings: "",
      deliveryMethod: duplicate.deliveryMethod,
      claimUrl: duplicate.claimUrl,
    };
  }
  const destLabel = destLabelExec;
  const comparisons = compareFees(
    corridorKey,
    intent.amount,
    quote.mentoFeeUsd,
    recipientReceives
  );
  const savings = formatSavings(comparisons);

  const delivery = deliveryHint(intent, config);

  if (delivery.method === "escrow" && intent.recipientPhone) {
    const escrow = await executeEscrowRemittance(
      config,
      corridor,
      quote,
      intent.recipientPhone
    );

    const record = {
      id: crypto.randomUUID(),
      intent: { ...intent, recipientPhone: intent.recipientPhone },
      txHash: escrow.txHash,
      status: "confirmed" as const,
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      feeComparison: comparisons,
      deliveryMethod: "escrow" as const,
      claimId: escrow.claim.claimId,
      claimUrl: escrow.claim.claimUrl,
    };
    saveTransaction(config.dataDir, record);

    const notification = await notifyClaimLink(
      config,
      intent,
      escrow.claim.claimUrl,
      recipientReceives,
      corridor.destinationCurrency
    );

    return {
      status: "confirmed",
      receiptId: record.id,
      txHash: escrow.txHash,
      recipientReceives,
      destinationCurrency: corridor.destinationCurrency,
      summary: `Sent ${intent.amount} ${intent.sourceCurrency} → ~${recipientReceives.toFixed(2)} ${corridor.destinationCurrency} (claim link)`,
      savings,
      deliveryMethod: "escrow",
      claimUrl: escrow.claim.claimUrl,
      notificationSent: Boolean(notification?.sid),
    };
  }

  const recipient =
    intent.recipientWallet || config.demoRecipientAddress;

  if (!recipient) {
    throw new Error(
      "No recipient wallet or phone. Save a contact with a phone number (for claim escrow) or wallet address."
    );
  }
  intent.recipientWallet = recipient;

  const agent = new RemitClawAgent(config);
  const record = await agent.executeTransfer(intent, corridor, quote, comparisons);

  return {
    status: record.status === "confirmed" ? "confirmed" : "failed",
    receiptId: record.id,
    txHash: record.txHash,
    recipientReceives,
    destinationCurrency: destLabel,
    summary: `Sent ${intent.amount} ${intent.sourceCurrency} → ~${recipientReceives.toFixed(2)} ${destLabel}`,
    savings,
    deliveryMethod: "wallet",
  };
}

export function listContacts(config: Config): StoredContact[] {
  return loadContacts(config.dataDir);
}

export function getContactByName(
  config: Config,
  name: string
): StoredContact | undefined {
  return findContactByName(config.dataDir, name);
}

export function saveContact(
  config: Config,
  contact: StoredContact
): StoredContact {
  return upsertContact(config.dataDir, contact);
}

export function bulkSyncContacts(
  config: Config,
  contacts: StoredContact[]
): StoredContact[] {
  return syncContacts(config.dataDir, contacts);
}

/** Import device address-book entries into the agent contact store. */
export function importContactsFromPhone(
  config: Config,
  entries: PhoneImportEntry[]
): StoredContact[] {
  return importPhoneContacts(config.dataDir, entries);
}

export function removeContact(config: Config, id: string): boolean {
  return deleteContact(config.dataDir, id);
}

export async function getClaimInfo(config: Config, claimId: string) {
  return readEscrow(config, claimId as `0x${string}`);
}

/**
 * The agent's own on-chain address (Model A wallet). Returned to the web app so
 * it can show real balances before per-user wallets land in Phase 3.
 */
export function getAgentAddress(config: Config): string | null {
  if (!config.agentPrivateKey) return null;
  try {
    return getAgentAccount(config).address;
  } catch {
    return null;
  }
}

export type ProfileCorridor = {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  label: string;
};

export function getProfileInfo(config: Config) {
  const limits = getSpendingLimits(config);
  const corridors: ProfileCorridor[] = loadCorridors(
    config.dataDir,
    config.celoChainId
  ).map((c) => ({
    id: c.id,
    sourceCurrency: c.sourceCurrency,
    destinationCurrency: c.destinationCurrency,
    destinationCountry: c.destinationCountry,
    label: `${c.sourceCurrency}m → ${c.destinationCurrency}`,
  }));

  return {
    limits: {
      dailyLimitUsd: limits.dailyLimitUsd,
      singleTransferLimitUsd: limits.singleTransferLimitUsd,
      dailySpentUsd: limits.dailySpentUsd,
      confirmationThresholdUsd: limits.confirmationThresholdUsd,
    },
    corridors,
    defaultCorridorId: corridors[0]?.id ?? "usd-php",
  };
}

export interface HistoryItem {
  id: string;
  status: string;
  amount: number;
  sourceCurrency: string;
  destinationCountry: string;
  recipientName?: string;
  txHash?: string;
  createdAt: string;
  deliveryMethod?: string;
  claimUrl?: string;
}

export function getHistory(config: Config): HistoryItem[] {
  return loadTransactions(config.dataDir)
    .map((r) => ({
      id: r.id,
      status: r.status,
      amount: r.intent.amount,
      sourceCurrency: r.intent.sourceCurrency,
      destinationCountry: r.intent.destinationCountry,
      recipientName: r.intent.recipientName,
      txHash: r.txHash,
      createdAt: r.createdAt,
      deliveryMethod: r.deliveryMethod,
      claimUrl: r.claimUrl,
    }))
    .reverse();
}

export interface BalanceItem {
  symbol: string;
  address: string;
  balance: number;
}

/** Read on-chain stablecoin balances for an address across the known Celo tokens. */
export async function getBalances(
  config: Config,
  address: string
): Promise<BalanceItem[]> {
  const stables = stableTokensForChain(config.celoChainId);
  const tokens: Array<{ symbol: string; address: string; decimals: number }> =
    config.celoChainId === CELO_SEPOLIA_CHAIN_ID
      ? [
          { symbol: "USDC", address: CELO_SEPOLIA_USDC, decimals: 6 },
          { symbol: "USDm", address: stables.USDm, decimals: 18 },
          { symbol: "EURm", address: stables.EURm, decimals: 18 },
          { symbol: "PHPm", address: stables.PHPm, decimals: 18 },
          { symbol: "NGNm", address: stables.NGNm, decimals: 18 },
        ]
      : [
          { symbol: "USDm", address: stables.USDm, decimals: 18 },
          { symbol: "EURm", address: stables.EURm, decimals: 18 },
          { symbol: "BRLm", address: stables.BRLm, decimals: 18 },
          { symbol: "PHPm", address: stables.PHPm, decimals: 18 },
          { symbol: "NGNm", address: stables.NGNm, decimals: 18 },
        ];

  const results = await Promise.all(
    tokens.map(async (token) => {
      try {
        const raw = await getTokenBalance(
          config,
          token.address as Address,
          address as Address
        );
        return {
          symbol: token.symbol,
          address: token.address,
          balance: Number(formatUnits(raw, token.decimals)),
        };
      } catch {
        return { symbol: token.symbol, address: token.address, balance: 0 };
      }
    })
  );

  return results;
}
