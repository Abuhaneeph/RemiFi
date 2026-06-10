import type { Config } from "../config/index.js";

export const REMIFI_MCP_TOOLS = [
  "natural_language_parsing",
  "mento_quote",
  "fee_comparison",
  "stablecoin_transfer",
  "mento_swap",
  "contact_resolution",
  "balance_lookup",
  "transfer_history",
  "claim_escrow",
  "sms_notification",
  "whatsapp_notification",
  "multilingual_intent",
  "spending_limits",
  "x402_payments",
] as const;

export const REMIFI_MCP_PROMPTS = [
  "send_money",
  "get_quote",
  "check_balance",
  "view_contacts",
  "transfer_history",
  "confirm_send",
  "cancel_transfer",
  "add_recipient",
] as const;

export const REMIFI_MCP_RESOURCES = [
  "parse_intent",
  "get_quote",
  "execute_transfer",
  "list_contacts",
  "resolve_contact",
  "sync_contacts",
  "import_phone_contacts",
  "get_balance",
  "get_history",
  "get_claim",
  "health_check",
  "agent_info",
  "premium_quote",
] as const;

/** Public MCP discovery document for 8004scan and MCP clients (no API key). */
export function buildMcpManifest(config: Config) {
  const api = (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");

  return {
    protocolVersion: "2025-06-18",
    serverInfo: { name: config.agentName, version: "1.0.0" },
    transport: { type: "http", url: api },
    capabilities: { tools: {}, prompts: {}, resources: {} },
    tools: REMIFI_MCP_TOOLS.map((name) => ({
      name,
      description: `Remifi ${name.replace(/_/g, " ")}`,
    })),
    prompts: REMIFI_MCP_PROMPTS.map((name) => ({ name })),
    resources: REMIFI_MCP_RESOURCES.map((name) => ({
      name,
      uri: `${api}/api/${name.replace(/_/g, "-")}`,
    })),
    authentication: {
      type: "api-key",
      header: "x-api-key",
      note: "Quotes and transfers require x-api-key. Discovery endpoints are public.",
    },
  };
}

/** Root service index — 8004scan HTTP/MCP probes hit GET / without credentials. */
export function buildApiIndex(config: Config, walletAddress?: string | null) {
  const api = (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");
  const web = config.publicBaseUrl?.replace(/\/$/, "");

  return {
    name: config.agentName,
    status: "ok",
    version: "1.0.0",
    chainId: config.celoChainId,
    agentId: config.agentId ?? null,
    wallet: walletAddress ?? null,
    x402Support: true,
    x402: {
      info: `${api}/api/x402/info`,
      premiumQuote: `${api}/api/x402/premium-quote`,
      enabled: config.x402Enabled,
      priceUsd: config.x402PriceUsd,
      network: config.x402Network,
      token: config.x402Token,
    },
    endpoints: {
      health: `${api}/api/health`,
      agent: `${api}/api/agent`,
      agentCard: `${api}/.well-known/agent.json`,
      mcp: `${api}/.well-known/mcp.json`,
      web: web ?? null,
    },
    auth: {
      type: "api-key",
      header: "x-api-key",
      publicRoutes: [
        "/",
        "/api/health",
        "/api/agent",
        "/.well-known/agent.json",
        "/.well-known/mcp.json",
        "/api/x402/info",
        "/api/x402/premium-quote",
      ],
    },
  };
}
