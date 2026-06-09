import type { Config } from "../config/index.js";
import type { RemittanceIntent, SpendingLimits } from "../types/index.js";
import { getOptimizedQuote, loadCorridors, resolveCorridor } from "../mento/client.js";
import { getDailySpentUsd } from "../history/store.js";

export function getSpendingLimits(config: Config): SpendingLimits {
  return {
    dailyLimitUsd: config.dailyTransferLimitUsd,
    singleTransferLimitUsd: config.singleTransferLimitUsd,
    confirmationThresholdUsd: config.requireConfirmationAboveUsd,
    dailySpentUsd: getDailySpentUsd(config.dataDir),
  };
}

export function validateTransferLimits(
  config: Config,
  intent: RemittanceIntent
): { ok: true } | { ok: false; reason: string } {
  const limits = getSpendingLimits(config);

  if (intent.amount > limits.singleTransferLimitUsd) {
    return {
      ok: false,
      reason: `Amount exceeds single transfer limit of $${limits.singleTransferLimitUsd}`,
    };
  }

  if (limits.dailySpentUsd + intent.amount > limits.dailyLimitUsd) {
    return {
      ok: false,
      reason: `Would exceed daily limit of $${limits.dailyLimitUsd} (spent: $${limits.dailySpentUsd})`,
    };
  }

  return { ok: true };
}

export function requiresConfirmation(
  config: Config,
  amountUsd: number
): boolean {
  return amountUsd >= config.requireConfirmationAboveUsd;
}

export async function prepareTransfer(
  config: Config,
  intent: RemittanceIntent
) {
  const corridors = loadCorridors(config.dataDir, config.celoChainId);
  const corridor = resolveCorridor(
    corridors,
    intent.sourceCurrency,
    intent.destinationCountry
  );

  if (!corridor) {
    throw new Error(
      `No corridor for ${intent.sourceCurrency} → ${intent.destinationCountry}`
    );
  }

  const limitCheck = validateTransferLimits(config, intent);
  if (!limitCheck.ok) {
    throw new Error(limitCheck.reason);
  }

  const quote = await getOptimizedQuote(config, corridor, intent.amount);

  if (!quote.tradable) {
    throw new Error(
      `Mento pair ${corridor.mentoPair} is not tradable (circuit breaker or limits)`
    );
  }

  return { corridor, quote, needsConfirmation: requiresConfirmation(config, intent.amount) };
}
