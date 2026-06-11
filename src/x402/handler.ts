import { parseUnits } from "viem";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "../config/index.js";
import { getAgentAddress } from "../api/service.js";
import { x402Asset } from "../agent/agent-card.js";
import { isCeloSepolia } from "../agent/registry-addresses.js";

export interface PaymentRequirement {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; decimals: number };
}

export interface PaymentRequirements {
  x402Version: 1;
  accepts: PaymentRequirement[];
  error?: string;
}

export interface SettleResult {
  ok: boolean;
  status: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
}

/** Read x402 payment header (`X-PAYMENT` or `PAYMENT-SIGNATURE` per Celo/thirdweb docs). */
export function extractPaymentHeader(req: IncomingMessage): string | null {
  const raw =
    req.headers["x-payment"] ??
    req.headers["payment-signature"];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Public HTTPS URL for x402 payment requirements (never use internal http:// origin). */
export function x402ResourceUrl(config: Config, path: string): string {
  const base =
    config.publicAgentApiUrl?.replace(/\/$/, "") ??
    config.publicBaseUrl?.replace(/\/$/, "") ??
    "";
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function isX402Ready(config: Config): boolean {
  return Boolean(
    config.x402Enabled &&
      config.thirdwebSecretKey?.trim() &&
      getAgentAddress(config)
  );
}

/** Manual 402 body when thirdweb facilitator is not configured. */
export function buildPaymentRequirements(
  config: Config,
  resourceUrl: string,
  error?: string
): PaymentRequirements {
  const asset = x402Asset(config);
  const payTo =
    getAgentAddress(config) ?? "0x0000000000000000000000000000000000000000";

  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: config.x402Network,
        maxAmountRequired: parseUnits(
          config.x402PriceUsd.toString(),
          asset.decimals
        ).toString(),
        resource: resourceUrl,
        description: `Remifi agent service fee ($${config.x402PriceUsd} USD)`,
        mimeType: "application/json",
        payTo,
        maxTimeoutSeconds: 60,
        asset: asset.address,
        extra: { name: asset.symbol, decimals: asset.decimals },
      },
    ],
    error,
  };
}

/**
 * Settle an x402 payment using thirdweb's facilitator when `THIRDWEB_SECRET_KEY`
 * is configured (recommended — matches docs.celo.org x402 guide).
 *
 * Falls back to a structural header check when the facilitator is unavailable.
 */
export async function settleX402Payment(
  config: Config,
  req: IncomingMessage,
  resourceUrl: string,
  method: "GET" | "POST"
): Promise<SettleResult> {
  const paymentData = extractPaymentHeader(req);
  const payTo = getAgentAddress(config);

  if (config.thirdwebSecretKey && payTo) {
    try {
      const { createThirdwebClient } = await import("thirdweb");
      const { settlePayment, facilitator } = await import("thirdweb/x402");
      const { celo, celoSepolia } = await import("thirdweb/chains");

      const client = createThirdwebClient({
        secretKey: config.thirdwebSecretKey,
      });
      const network = isCeloSepolia(config.celoChainId) ? celoSepolia : celo;
      const thirdwebFacilitator = facilitator({
        client,
        serverWalletAddress: payTo,
      });

      const result = await settlePayment({
        resourceUrl,
        method,
        paymentData: paymentData ?? undefined,
        payTo,
        network,
        price: `$${config.x402PriceUsd}`,
        facilitator: thirdwebFacilitator,
        routeConfig: {
          description: "Remifi agent premium quote (x402)",
          mimeType: "application/json",
        },
      });

      return {
        ok: result.status === 200,
        status: result.status,
        responseBody: result.responseBody,
        responseHeaders: result.responseHeaders as Record<string, string>,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "x402 settlement failed";
      return {
        ok: false,
        status: 402,
        responseBody: buildPaymentRequirements(config, resourceUrl, reason),
      };
    }
  }

  // Fallback: no facilitator — require a well-formed X-PAYMENT payload.
  if (!paymentData) {
    return {
      ok: false,
      status: 402,
      responseBody: buildPaymentRequirements(
        config,
        resourceUrl,
        "Payment required — retry with X-PAYMENT header (set THIRDWEB_SECRET_KEY for real settlement)"
      ),
    };
  }

  try {
    const decoded = Buffer.from(paymentData, "base64").toString("utf-8");
    JSON.parse(decoded);
    return { ok: true, status: 200 };
  } catch {
    return {
      ok: false,
      status: 402,
      responseBody: buildPaymentRequirements(
        config,
        resourceUrl,
        "Malformed X-PAYMENT payload"
      ),
    };
  }
}

/** Apply x402 response headers returned by thirdweb settlePayment. */
export function applySettleHeaders(
  res: ServerResponse,
  headers?: Record<string, string>
): void {
  if (!headers) return;
  for (const [key, value] of Object.entries(headers)) {
    if (value != null) res.setHeader(key, value);
  }
}
