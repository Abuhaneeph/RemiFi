import type { Config } from "../config/index.js";
import { agentRegistryId } from "./registry-addresses.js";

/** Celo docs endpoint entry (`type` + `url`, optional wallet fields). */
export interface AgentEndpoint {
  type: string;
  url?: string;
  address?: string;
  chainId?: number;
}

/** EIP-8004 `services` entry (Jan 2026+; also indexed by 8004scan). */
export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
}

/**
 * ERC-8004 agent registration file.
 *
 * Includes both shapes for broad tooling compatibility:
 * - Celo docs: `type: "Agent"` + `endpoints[]` with wallet / HTTP / x402
 * - EIP-8004: `registration-v1` type + `services[]`
 */
export interface AgentCard {
  type: "Agent" | "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description: string;
  image?: string;
  endpoints: AgentEndpoint[];
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: { agentId: number; agentRegistry: string }[];
  supportedTrust: string[];
}

export { agentRegistryId };

/** Public base URL of the agent HTTP API. */
function apiBaseUrl(config: Config): string {
  return (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");
}

/**
 * Build the registration file per Celo ERC-8004 docs + EIP-8004 registration-v1.
 *
 * @param walletAddress Agent's on-chain wallet (shown in the `wallet` endpoint).
 */
export function buildAgentCard(
  config: Config,
  walletAddress?: string | null
): AgentCard {
  const api = apiBaseUrl(config);
  const web = config.publicBaseUrl?.replace(/\/$/, "");
  const premiumQuote = `${api}/api/x402/premium-quote`;

  const endpoints: AgentEndpoint[] = [];
  if (web) {
    endpoints.push({
      type: "a2a",
      url: `${web}/.well-known/agent.json`,
    });
  }
  endpoints.push({ type: "http", url: api });
  endpoints.push({ type: "x402", url: premiumQuote });
  if (walletAddress) {
    endpoints.push({
      type: "wallet",
      address: walletAddress,
      chainId: config.celoChainId,
    });
  }

  const services: AgentService[] = [];
  if (web) services.push({ name: "web", endpoint: web });
  services.push({ name: "HTTP", endpoint: api, version: "1.0.0" });
  services.push({ name: "x402", endpoint: premiumQuote, version: "1.0.0" });

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: config.agentName,
    description: config.agentDescription,
    image:
      config.agentImage ??
      "https://remifi.xyz/assets/remifi-agent.png",
    endpoints,
    services,
    x402Support: true,
    active: true,
    registrations:
      config.agentId != null
        ? [{ agentId: config.agentId, agentRegistry: agentRegistryId(config) }]
        : [],
    supportedTrust: ["reputation", "validation", "tee"],
  };
}

/**
 * Resolve the `agentURI` passed to `IdentityRegistry.register(agentURI)`.
 *
 * 1. Explicit `AGENT_URI` env
 * 2. Hosted `{PUBLIC_BASE_URL}/.well-known/agent.json` (recommended for 8004scan)
 * 3. Agent API `/.well-known/agent.json` when `PUBLIC_AGENT_API_URL` is set
 * 4. On-chain `data:` URI (no hosting required — good for testnet demos)
 */
export function resolveAgentUri(config: Config): string {
  if (config.agentUri) return config.agentUri;
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/.well-known/agent.json`;
  }
  const api = config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`;
  if (config.publicAgentApiUrl) {
    return `${api.replace(/\/$/, "")}/.well-known/agent.json`;
  }
  const json = JSON.stringify(buildAgentCard(config));
  const base64 = Buffer.from(json, "utf-8").toString("base64");
  return `data:application/json;base64,${base64}`;
}

/** x402 settlement tokens on Celo (docs.celo.org x402 page). */
export const CELO_X402_TOKENS = {
  USDC: {
    symbol: "USDC",
    address: "0xcebA9300f2b948710d2653dDD7B07f33A8B32118C",
    decimals: 6,
  },
  USDm: {
    symbol: "USDm",
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
} as const;

export function x402Asset(config: Config): {
  symbol: string;
  address: string;
  decimals: number;
} {
  const token = config.x402Token.toUpperCase();
  if (token === "USDM") return CELO_X402_TOKENS.USDm;
  return CELO_X402_TOKENS.USDC;
}
