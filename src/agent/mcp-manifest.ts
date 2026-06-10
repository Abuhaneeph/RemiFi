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

export type McpResourceName = (typeof REMIFI_MCP_RESOURCES)[number];

/** MCP protocol + service version (8004scan expects 2025-06-18). */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/** Kebab-case public paths for MCP resource probes (8004scan health checks). */
export const MCP_RESOURCE_PATHS: Record<McpResourceName, string> = {
  health_check: "/api/health",
  agent_info: "/api/agent",
  get_quote: "/api/x402/info",
  premium_quote: "/api/x402/info",
  get_claim: "/api/claim",
  get_history: "/api/history",
  get_balance: "/api/balance",
  list_contacts: "/api/contacts",
  resolve_contact: "/api/contacts",
  parse_intent: "/api/intent",
  execute_transfer: "/api/transfer",
  sync_contacts: "/api/contacts/sync",
  import_phone_contacts: "/api/contacts/import-phone",
};

export function mcpResourceKebabPath(name: McpResourceName): string {
  return MCP_RESOURCE_PATHS[name];
}

/** Resolve MCP resource name from an API path (first match). */
export function mcpResourceForPath(path: string): McpResourceName | undefined {
  return REMIFI_MCP_RESOURCES.find((name) => MCP_RESOURCE_PATHS[name] === path);
}

export function mcpResourceUri(config: Config, name: McpResourceName): string {
  const api = (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");
  return `${api}${MCP_RESOURCE_PATHS[name]}`;
}

/** Descriptor returned for auth-gated MCP resources (probe-friendly, no API key). */
export function buildMcpResourceDescriptor(
  config: Config,
  name: McpResourceName
) {
  const path = MCP_RESOURCE_PATHS[name];
  const publicGet = new Set([
    "/api/health",
    "/api/agent",
    "/api/x402/info",
    "/api/claim",
  ]);
  const method = path.includes("contacts/sync") ||
    path.includes("import-phone") ||
    path === "/api/intent" ||
    path === "/api/transfer"
    ? "POST"
    : "GET";

  return {
    resource: name,
    path,
    method,
    public: publicGet.has(path),
    auth: publicGet.has(path) ? null : { type: "api-key", header: "x-api-key" },
    agentId: config.agentId ?? null,
    chainId: config.celoChainId,
  };
}

/** Public MCP discovery document for 8004scan and MCP clients (no API key). */
export function buildMcpManifest(config: Config) {
  const api = (
    config.publicAgentApiUrl ?? `http://localhost:${config.agentApiPort}`
  ).replace(/\/$/, "");

  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: { name: config.agentName, version: MCP_PROTOCOL_VERSION },
    transport: { type: "http", url: api },
    capabilities: { tools: {}, prompts: {}, resources: {} },
    tools: REMIFI_MCP_TOOLS.map((name) => ({
      name,
      description: `Remifi ${name.replace(/_/g, " ")}`,
    })),
    prompts: REMIFI_MCP_PROMPTS.map((name) => ({ name })),
    resources: REMIFI_MCP_RESOURCES.map((name) => ({
      name,
      uri: mcpResourceUri(config, name),
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
      agentCard: web ? `${web}/.well-known/agent.json` : `${api}/.well-known/agent.json`,
      a2aCard: web ? `${web}/.well-known/agent-card.json` : null,
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
        "/.well-known/agent-registration.json",
        "/.well-known/mcp.json",
        "/api/x402/info",
        "/api/x402/premium-quote",
        "/api/claim",
        ...REMIFI_MCP_RESOURCES.map((name) => MCP_RESOURCE_PATHS[name]),
      ],
    },
  };
}
