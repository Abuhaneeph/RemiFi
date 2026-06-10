import { keccak256, toBytes } from "viem";
import type { Config } from "../config/index.js";
import {
  MCP_PROTOCOL_VERSION,
  mcpDiscoveryUrl,
  mcpTransportUrl,
  REMIFI_MCP_PROMPTS,
  REMIFI_MCP_TOOLS,
} from "./mcp-manifest.js";
import { agentRegistryId } from "./registry-addresses.js";
import {
  agentCardUrl,
  a2aJsonRpcUrl,
  buildRemifiServices,
  OASF_REPOSITORY,
  OASF_VERSION,
  REMIFI_OASF_SKILLS,
} from "./services.js";

export {
  OASF_REPOSITORY,
  OASF_VERSION,
  REMIFI_OASF_SKILLS,
} from "./services.js";

export const REMIFI_AGENT_DESCRIPTION =
  "AI agent for cross-border remittances on Celo using stablecoins. Quote Mento routes, compare fees vs banks, and settle on chain in seconds. Multilingual (EN / ES / PT / FR).";

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
  description?: string;
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
  a2aSkills?: string[];
  skills?: string[];
  domains?: string[];
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
  tags?: string[];
  image?: string;
  endpoints: AgentEndpoint[];
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: { agentId: number; agentRegistry: string }[];
  supportedTrust: string[];
}

export const REMIFI_AGENT_TAGS = [
  "multilingual",
  "remittance",
  "celo",
  "mento",
  "stablecoin",
  "telegram",
  "x402",
  "english",
  "spanish",
  "portuguese",
  "french",
] as const;

/** A2A skill entry (Toppa-style card for 8004scan). */
export interface A2aSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

/** A2A v0.3+ discovery card (/.well-known/agent-card.json). */
export interface A2aAgentCard {
  name: string;
  description: string;
  url: string;
  provider: { organization: string; url: string };
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    extendedAgentCard: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2aSkill[];
  extensions?: {
    x402?: Record<string, unknown>;
    mcp?: Record<string, unknown>;
  };
}

/** Ten OASF-aligned A2A skills (matches Toppa 8004scan display). */
export const REMIFI_A2A_SKILLS: readonly A2aSkill[] = [
  {
    id: "natural_language_processing_natural_language_generation_text_generation",
    name: "Text Generation",
    description:
      "Multilingual remittance confirmations, quotes, and transfer receipts in EN / ES / PT / FR",
    tags: [
      "natural-language-processing",
      "natural-language-generation",
      "text-generation",
    ],
  },
  {
    id: "natural_language_processing_natural_language_understanding_contextual_comprehension",
    name: "Contextual Comprehension",
    description:
      "Understands recipient names, amounts, corridors, and currencies from natural language",
    tags: [
      "natural-language-processing",
      "natural-language-understanding",
      "contextual-comprehension",
    ],
  },
  {
    id: "natural_language_processing_conversation_chatbot",
    name: "Chatbot",
    description:
      "Conversational remittance flows via Telegram, WhatsApp, and web chat",
    tags: ["natural-language-processing", "conversation", "chatbot"],
  },
  {
    id: "natural_language_processing_information_retrieval_synthesis_search",
    name: "Search",
    description:
      "Find contacts, corridors, Mento routes, and fee comparisons across corridors",
    tags: [
      "natural-language-processing",
      "information-retrieval-synthesis",
      "search",
    ],
  },
  {
    id: "tool_interaction_automation_workflow_automation",
    name: "Workflow Automation",
    description:
      "End-to-end quote → confirm → transfer workflows with spending limits",
    tags: ["tool-interaction", "automation", "workflow-automation"],
  },
  {
    id: "problem_solving",
    name: "Problem Solving",
    description:
      "Resolve routing, slippage, contact matching, and transfer issues",
    tags: [
      "natural-language-processing",
      "analytical-and-logical-reasoning",
      "problem-solving",
    ],
  },
  {
    id: "question_answering",
    name: "Question Answering",
    description:
      "Answer questions on fees, delivery time, balances, and claim status",
    tags: [
      "natural-language-processing",
      "information-retrieval-and-synthesis",
      "question-answering",
    ],
  },
  {
    id: "cryptocurrency",
    name: "Cryptocurrency",
    description:
      "Stablecoin remittances via USDC on Celo with Mento FX routes",
    tags: ["technology", "blockchain", "cryptocurrency"],
  },
  {
    id: "smart_contracts",
    name: "Smart Contracts",
    description:
      "On-chain identity (ERC-8004), Mento swaps, and escrow vault claims",
    tags: ["technology", "blockchain", "smart-contracts"],
  },
  {
    id: "digital_payments",
    name: "Digital Payments",
    description:
      "Cross-border digital remittance with x402 micropayments on Celo",
    tags: ["finance-and-business", "finance", "digital-payments"],
  },
];

export { agentRegistryId };

function apiBaseUrl(config: Config): string {
  return (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");
}

/**
 * Build the registration file per Celo ERC-8004 docs + EIP-8004 registration-v1.
 *
 * Service layout mirrors Toppa: 13 custom + MCP + A2A + OASF = 16 endpoints.
 */
export function buildAgentCard(
  config: Config,
  walletAddress?: string | null
): AgentCard {
  const api = apiBaseUrl(config);
  const premiumQuote = `${api}/api/x402/premium-quote`;
  const cardUrl = agentCardUrl(config);

  const endpoints: AgentEndpoint[] = [
    { type: "a2a", url: cardUrl },
    { type: "http", url: api },
    { type: "mcp", url: mcpDiscoveryUrl(config) },
    { type: "x402", url: premiumQuote },
  ];
  if (walletAddress) {
    endpoints.push({
      type: "wallet",
      address: walletAddress,
      chainId: config.celoChainId,
    });
  }

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: config.agentName,
    description: config.agentDescription,
    tags: [...REMIFI_AGENT_TAGS],
    image:
      config.agentImage ?? "https://remifi.xyz/assets/remifi-agent.png",
    endpoints,
    services: buildRemifiServices(config, {
      mcpTools: REMIFI_MCP_TOOLS,
      mcpPrompts: REMIFI_MCP_PROMPTS,
    }),
    x402Support: true,
    active: true,
    registrations:
      config.agentId != null
        ? [{ agentId: config.agentId, agentRegistry: agentRegistryId(config) }]
        : [],
    supportedTrust: ["reputation", "crypto-economic", "tee-attestation"],
  };
}

/** A2A agent card — Toppa format, hosted on API `/.well-known/agent-card.json`. */
export function buildA2aAgentCard(
  config: Config,
  walletAddress?: string | null
): A2aAgentCard {
  const api = apiBaseUrl(config);
  const payTo = walletAddress ?? null;

  return {
    name: config.agentName,
    description: config.agentDescription,
    url: a2aJsonRpcUrl(config),
    provider: { organization: config.agentName, url: api },
    version: "2.0.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: REMIFI_A2A_SKILLS.map((s) => ({ ...s, tags: [...s.tags] })),
    extensions: {
      x402: {
        spec: "https://github.com/coinbase/x402",
        currency: config.x402Token,
        chain: "Celo",
        network: config.x402Network,
        priceUsd: config.x402PriceUsd,
        ...(payTo ? { payTo } : {}),
        description:
          "Premium quotes use x402 micropayments on Celo. Discovery and health endpoints are free.",
      },
      mcp: {
        endpoint: mcpTransportUrl(config),
        discovery: mcpDiscoveryUrl(config),
        transport: "Streamable HTTP",
        description: `MCP endpoint for direct tool invocation (${REMIFI_MCP_TOOLS.length} tools)`,
      },
    },
  };
}

/** keccak256 of canonical agent registration JSON (8004scan agentHash extension). */
export function computeAgentMetadataHash(card: AgentCard): `0x${string}` {
  return keccak256(toBytes(JSON.stringify(card)));
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
