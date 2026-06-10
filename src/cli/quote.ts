#!/usr/bin/env node
import { loadConfig } from "../config/index.js";
import { loadCorridors, resolveCorridor, getOptimizedQuote } from "../mento/client.js";
import { compareFees, formatSavings } from "../fees/comparison.js";
import { formatUnits } from "viem";

function parseArgs(): { from: string; to: string; amount: number } {
  const args = process.argv.slice(2);
  let from = "USD";
  let to = "PH";
  let amount = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) from = args[++i].toUpperCase();
    if (args[i] === "--to" && args[i + 1]) to = args[++i].toUpperCase();
    if (args[i] === "--amount" && args[i + 1]) amount = parseFloat(args[++i]);
  }

  return { from, to, amount };
}

async function main() {
  const { from, to, amount } = parseArgs();
  const config = loadConfig();
  const corridors = loadCorridors(config.dataDir, config.celoChainId);
  const corridor = resolveCorridor(corridors, from, to);

  if (!corridor) {
    console.error(`No corridor: ${from} → ${to}`);
    process.exit(1);
  }

  const quote = await getOptimizedQuote(config, corridor, amount);
  const recipientReceives = Number(formatUnits(quote.amountOut, 18));
  const corridorKey = `${from}-${to.slice(0, 2)}`;
  const comparisons = compareFees(corridorKey, amount, quote.mentoFeeUsd, recipientReceives);

  console.log(JSON.stringify({ quote, comparisons, savings: formatSavings(comparisons) }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
