import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";
import type { Config } from "../config/index.js";
import type { Corridor, RouteQuote } from "../types/index.js";

const CELO_MAINNET_TOKENS = {
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  EURm: "0x10c826A163F5c566a514aFC6a0a7CA779128f0e0",
  BRLm: "0xE918F7BB3D25d8936De17cCF579613649F1E5974",
  PHPm: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
  NGNm: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
  COPm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  XOFm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
} as const;

/** Circle USDC on Celo Sepolia (6 decimals). */
export const CELO_SEPOLIA_USDC =
  "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as const;

const CELO_SEPOLIA_TOKENS = {
  USDC: CELO_SEPOLIA_USDC,
  USDm: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b",
  EURm: "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a",
  BRLm: "0x2294298942fdc79417DE9E0D740A4957E0e7783a",
  PHPm: "0x0352976d940a2C3FBa0C3623198947Ee1d17869E",
  NGNm: "0x3d5ae86F34E2a82771496D140daFAEf3789dF888",
  COPm: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
  XOFm: "0x5505b70207aE3B826c1A7607F19F3Bf73444A082",
} as const;

export type StableTokens = Record<string, string>;

export function stableTokensForChain(chainId: number): StableTokens {
  return chainId === CELO_SEPOLIA_CHAIN_ID
    ? CELO_SEPOLIA_TOKENS
    : CELO_MAINNET_TOKENS;
}

export function loadCorridors(dataDir: string, chainId = 42220): Corridor[] {
  const file =
    chainId === CELO_SEPOLIA_CHAIN_ID
      ? "corridors.sepolia.json"
      : "corridors.json";
  const path = join(dataDir, file);
  return JSON.parse(readFileSync(path, "utf-8")) as Corridor[];
}

export function resolveCorridor(
  corridors: Corridor[],
  sourceCurrency: string,
  destinationCountry: string
): Corridor | undefined {
  return corridors.find(
    (c) =>
      c.sourceCurrency === sourceCurrency.toUpperCase() &&
      c.destinationCountry === destinationCountry.toUpperCase()
  );
}

export async function createMentoClient(config: Config) {
  const { Mento, ChainId } = await import("@mento-protocol/mento-sdk");
  const chainId =
    config.celoChainId === 11142220 ? ChainId.CELO_SEPOLIA : ChainId.CELO;
  return Mento.create(chainId, config.celoRpcUrl);
}

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function corridorSourceDecimals(corridor: Corridor): number {
  return corridor.sourceDecimals ?? 18;
}

export function corridorDestinationDecimals(corridor: Corridor): number {
  return corridor.destinationDecimals ?? corridor.sourceDecimals ?? 18;
}

export async function getOptimizedQuote(
  config: Config,
  corridor: Corridor,
  amountUsd: number
): Promise<RouteQuote> {
  const { parseUnits } = await import("viem");
  const sourceDecimals = corridorSourceDecimals(corridor);
  const amountIn = parseUnits(amountUsd.toString(), sourceDecimals);

  // Same-token corridors skip Mento (direct ERC-20 transfer on execution).
  if (sameToken(corridor.sourceToken, corridor.destinationToken)) {
    return {
      corridorId: corridor.id,
      amountIn,
      amountOut: amountIn,
      routeHops: 0,
      estimatedGasUsd: 0.001,
      mentoFeeUsd: 0,
      tradable: true,
    };
  }

  const mento = await createMentoClient(config);
  const tradable = await mento.trading.isPairTradable(
    corridor.sourceToken,
    corridor.destinationToken
  );

  let amountOut = 0n;
  let routeHops = 0;

  if (tradable) {
    try {
      const route = await mento.routes.findRoute(
        corridor.sourceToken,
        corridor.destinationToken
      );
      routeHops = route.path.length;
      amountOut = await mento.quotes.getAmountOut(
        corridor.sourceToken,
        corridor.destinationToken,
        amountIn
      );
    } catch {
      return {
        corridorId: corridor.id,
        amountIn,
        amountOut: 0n,
        routeHops: 0,
        estimatedGasUsd: 0.001,
        mentoFeeUsd: amountUsd * 0.001,
        tradable: false,
      };
    }
  }

  return {
    corridorId: corridor.id,
    amountIn,
    amountOut,
    routeHops,
    estimatedGasUsd: 0.001,
    mentoFeeUsd: amountUsd * 0.001,
    tradable,
  };
}

export { CELO_MAINNET_TOKENS, CELO_SEPOLIA_TOKENS };
