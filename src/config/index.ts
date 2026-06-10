import "dotenv/config";
import { z } from "zod";
import {
  defaultIdentityRegistry,
  defaultReputationRegistry,
} from "../agent/registry-addresses.js";

const ConfigSchema = z
  .object({
  celoRpcUrl: z.string().url(),
  celoChainId: z.coerce.number().default(42220),
  agentPrivateKey: z.string().optional(),
  openclawGatewayUrl: z.string().url().default("http://127.0.0.1:18789"),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioWhatsappFrom: z.string().optional(),
  twilioSmsFrom: z.string().optional(),
  dailyTransferLimitUsd: z.coerce.number().default(500),
  singleTransferLimitUsd: z.coerce.number().default(200),
  requireConfirmationAboveUsd: z.coerce.number().default(100),
  slippageBps: z.coerce.number().default(50),
  dataDir: z.string().default("./data"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  agentApiPort: z.coerce.number().default(8787),
  agentApiKey: z.string().optional(),
  webOrigin: z.string().default("*"),
  demoRecipientAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  /** Deployed RemifiVault for phone-only claim escrow. */
  remifiVaultAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),

  // ── ERC-8004 agent identity ──
  identityRegistryAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  reputationRegistryAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  agentId: z.coerce.number().int().nonnegative().optional(),
  agentUri: z.string().optional(),
  agentName: z.string().default("Remifi"),
  agentDescription: z
    .string()
    .default(
      "Multilingual AI remittance agent on Celo (English, Spanish, Portuguese, French). Auto-detects language, parses send intent, quotes Mento routes, compares fees vs Western Union/Wise, executes on-chain stablecoin transfers. Telegram @remifi_bot, web, HTTP API, x402."
    ),
  agentImage: z.string().optional(),
  publicBaseUrl: z.string().url().optional(),
  publicAgentApiUrl: z.string().url().optional(),

  // ── x402 payments ──
  x402Enabled: z
    .preprocess(
      (v) => (typeof v === "string" ? /^(1|true|yes|on)$/i.test(v) : v),
      z.boolean()
    )
    .default(false),
  x402PriceUsd: z.coerce.number().nonnegative().default(0.01),
  x402Network: z.string().default("celo"),
  /** Settlement token for x402: USDC (default) or USDm. */
  x402Token: z.string().default("USDC"),
  /** thirdweb secret key — enables real x402 verify/settle via facilitator. */
  thirdwebSecretKey: z.string().optional(),
})
  .transform((raw) => ({
    ...raw,
    identityRegistryAddress:
      raw.identityRegistryAddress ??
      defaultIdentityRegistry(raw.celoChainId),
    reputationRegistryAddress:
      raw.reputationRegistryAddress ??
      defaultReputationRegistry(raw.celoChainId),
  }));

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    celoRpcUrl: process.env.CELO_RPC_URL,
    celoChainId: process.env.CELO_CHAIN_ID,
    agentPrivateKey: process.env.AGENT_PRIVATE_KEY,
    openclawGatewayUrl: process.env.OPENCLAW_GATEWAY_URL,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
    twilioSmsFrom: process.env.TWILIO_SMS_FROM,
    dailyTransferLimitUsd: process.env.DAILY_TRANSFER_LIMIT_USD,
    singleTransferLimitUsd: process.env.SINGLE_TRANSFER_LIMIT_USD,
    requireConfirmationAboveUsd: process.env.REQUIRE_CONFIRMATION_ABOVE_USD,
    slippageBps: process.env.SLIPPAGE_BPS,
    dataDir: process.env.DATA_DIR,
    logLevel: process.env.LOG_LEVEL,
    // Render and other PaaS set PORT; AGENT_API_PORT is the local/dev override.
    agentApiPort: process.env.PORT ?? process.env.AGENT_API_PORT,
    agentApiKey: process.env.AGENT_API_KEY,
    webOrigin: process.env.WEB_ORIGIN,
    demoRecipientAddress: process.env.DEMO_RECIPIENT_ADDRESS,
    remifiVaultAddress: process.env.REMIFI_VAULT_ADDRESS,

    identityRegistryAddress: process.env.IDENTITY_REGISTRY_ADDRESS,
    reputationRegistryAddress: process.env.REPUTATION_REGISTRY_ADDRESS,
    agentId: process.env.AGENT_ID?.trim() ? process.env.AGENT_ID : undefined,
    agentUri: process.env.AGENT_URI,
    agentName: process.env.AGENT_NAME,
    agentDescription: process.env.AGENT_DESCRIPTION,
    agentImage: process.env.AGENT_IMAGE,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    publicAgentApiUrl: process.env.PUBLIC_AGENT_API_URL,

    x402Enabled: process.env.X402_ENABLED,
    x402PriceUsd: process.env.X402_PRICE_USD,
    x402Network: process.env.X402_NETWORK,
    x402Token: process.env.X402_TOKEN,
    thirdwebSecretKey: process.env.THIRDWEB_SECRET_KEY,
  });
}
