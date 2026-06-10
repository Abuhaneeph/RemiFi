import type { Config } from "../config/index.js";
import { MCP_PROTOCOL_VERSION, mcpDiscoveryUrl } from "./mcp-manifest.js";

/** OASF taxonomy repo (8004scan lists as OASF service). */
export const OASF_REPOSITORY = "https://github.com/agntcy/oasf/";
export const OASF_VERSION = "v0.8.0";

/**
 * OASF skill slugs — aligned with Toppa / 8004scan A2A capability display.
 * (8004scan maps these to Skill: lines on the Services tab.)
 */
export const REMIFI_OASF_SKILLS = [
  "natural_language_processing/natural_language_generation/text_generation",
  "natural_language_processing/natural_language_understanding/contextual_comprehension",
  "natural_language_processing/conversation/chatbot",
  "natural_language_processing/information_retrieval_and_synthesis/search",
  "natural_language_processing/information_retrieval_and_synthesis/question_answering",
  "natural_language_processing/analytical_and_logical_reasoning/problem_solving",
  "tool_interaction/automation/workflow_automation",
  "technology/blockchain/cryptocurrency",
  "technology/blockchain/smart_contracts",
  "finance_and_business/finance/digital_payments",
] as const;

export const REMIFI_OASF_DOMAINS = [
  "technology/blockchain/cryptocurrency",
  "technology/blockchain/smart_contracts",
  "finance_and_business/finance",
  "technology/blockchain",
  "commerce/retail/online_retail",
] as const;

export interface AgentServiceEntry {
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

function apiBase(config: Config): string {
  return (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");
}

function webBase(config: Config): string | undefined {
  return config.publicBaseUrl?.replace(/\/$/, "");
}

/** Kebab-case custom services (8004scan "Custom" group — mirrors Toppa). */
export function buildRemifiCustomServices(config: Config): AgentServiceEntry[] {
  const api = apiBase(config);
  const web = webBase(config);
  const services: AgentServiceEntry[] = [];

  if (web) {
    services.push({
      name: "web",
      endpoint: web,
      description: "Web interface for Remifi remittance agent",
    });
  }

  services.push(
    {
      name: "send-money",
      endpoint: `${api}/api/transfer`,
      description:
        "Send cross-border stablecoin remittance on Celo via Mento",
    },
    {
      name: "get-quote",
      endpoint: `${api}/api/intent`,
      description:
        "Get live Mento route quote with fee comparison vs banks",
    },
    {
      name: "check-balance",
      endpoint: `${api}/api/balance`,
      description: "Check on-chain USDC and stablecoin balances on Celo",
    },
    {
      name: "list-contacts",
      endpoint: `${api}/api/contacts`,
      description: "List saved remittance recipients and wallets",
    },
    {
      name: "get-history",
      endpoint: `${api}/api/history`,
      description: "Transfer history and transaction status",
    },
    {
      name: "claim-transfer",
      endpoint: `${api}/api/claim`,
      description: "Look up and claim phone-only escrow transfers",
    },
    {
      name: "premium-quote",
      endpoint: `${api}/api/x402/premium-quote`,
      description: "x402-gated premium Mento quote with detailed fee analysis",
    },
    {
      name: "sync-contacts",
      endpoint: `${api}/api/contacts/sync`,
      description: "Sync recipient contacts for remittances",
    },
    {
      name: "import-contacts",
      endpoint: `${api}/api/contacts/import-phone`,
      description: "Import phone contacts as remittance recipients",
    },
    {
      name: "compare-fees",
      endpoint: `${api}/api/x402/info`,
      description: "Compare Remifi fees and savings vs traditional remittance",
    },
    {
      name: "telegram",
      endpoint: "https://t.me/remifi_bot",
      description:
        "Telegram bot for multilingual remittances on Celo (EN / ES / PT / FR)",
    },
    {
      name: "api",
      endpoint: api,
    }
  );

  return services;
}

/** Full `services[]` for ERC-8004 registration (16 endpoints like Toppa). */
export function buildRemifiServices(
  config: Config,
  opts?: { mcpTools?: readonly string[]; mcpPrompts?: readonly string[] }
): AgentServiceEntry[] {
  const api = apiBase(config);
  const agentCardUrl = `${api}/.well-known/agent-card.json`;
  const mcpTools = opts?.mcpTools ?? [];
  const mcpPrompts = opts?.mcpPrompts ?? [];

  return [
    ...buildRemifiCustomServices(config),
    {
      name: "MCP",
      endpoint: mcpDiscoveryUrl(config),
      version: MCP_PROTOCOL_VERSION,
      mcpTools: [...mcpTools],
      mcpPrompts: [...mcpPrompts],
    },
    {
      name: "A2A",
      endpoint: agentCardUrl,
      version: "0.3.0",
      a2aSkills: [...REMIFI_OASF_SKILLS],
    },
    {
      name: "OASF",
      endpoint: OASF_REPOSITORY,
      version: OASF_VERSION,
      skills: [...REMIFI_OASF_SKILLS],
      domains: [...REMIFI_OASF_DOMAINS],
    },
  ];
}

export function agentCardUrl(config: Config): string {
  return `${apiBase(config)}/.well-known/agent-card.json`;
}

export function a2aJsonRpcUrl(config: Config): string {
  return `${apiBase(config)}/mcp`;
}
