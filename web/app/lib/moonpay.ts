/** MoonPay currency code for native USDC on Celo mainnet (production only). */
export const MOONPAY_CELO_USDC = "usdc_celo";

/** Sandbox only supports testnets — ETH Sepolia per MoonPay docs, not Celo USDC. */
export const MOONPAY_SANDBOX_CURRENCY = "eth";

export function moonpayBuyCurrency(): string {
  return moonpaySandboxMode() ? MOONPAY_SANDBOX_CURRENCY : MOONPAY_CELO_USDC;
}

export function moonpaySellCurrency(): string {
  return moonpaySandboxMode() ? MOONPAY_SANDBOX_CURRENCY : MOONPAY_CELO_USDC;
}

export const moonpayPublishableKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? "";

export function moonpayConfigured(): boolean {
  return Boolean(moonpayPublishableKey);
}

/** Sandbox uses pk_test_* — publishable key only, no secret key or URL signing. */
export function moonpaySandboxMode(): boolean {
  return moonpayPublishableKey.startsWith("pk_test");
}

/**
 * Production live keys pre-fill walletAddress, which requires server-side URL signing.
 * Sandbox follows the React SDK quick-start: apiKey + widget props only.
 */
export function moonpayPrefillWallet(): boolean {
  return moonpayPublishableKey.startsWith("pk_live");
}

/** MoonPay widget can open on testnet in sandbox; live ramps need Celo mainnet. */
export function moonpayRampEnabled(chainIsMainnet: boolean): boolean {
  if (!moonpayConfigured()) return false;
  return chainIsMainnet || moonpaySandboxMode();
}

/** Sign widget URLs server-side (production only, when walletAddress is pre-filled). */
export async function signMoonPayUrl(url: string): Promise<string> {
  const res = await fetch("/api/ramp/moonpay/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = (await res.json()) as { signature?: string; error?: string };
  if (!res.ok || !data.signature) {
    throw new Error(data.error ?? "MoonPay URL signing failed");
  }

  return data.signature;
}
