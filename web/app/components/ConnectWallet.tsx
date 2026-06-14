"use client";

import { useMemo } from "react";
import { useConnectModal } from "thirdweb/react";
import { useWallet } from "../context/WalletContext";
import { remitClawTheme } from "../lib/thirdweb-theme";
import { celoChain, getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";
import { getRemifiWallets } from "../lib/thirdweb-wallets";

/**
 * Opens thirdweb's connect modal via a native app button.
 * Avoids ConnectButton's connected-state details modal (invalid nested buttons).
 */
export function ConnectWallet({ label }: { label?: string }) {
  const { isConnected } = useWallet();
  const { connect, isConnecting } = useConnectModal();
  const client = getThirdwebClient();

  const wallets = useMemo(() => getRemifiWallets(), []);

  if (isConnected) return null;

  if (!thirdwebConfigured || !client) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">
        Wallet login needs a thirdweb client ID. Add{" "}
        <code className="text-brand-600">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> to{" "}
        <code className="text-brand-600">web/.env.local</code> to enable sign-in.
      </div>
    );
  }

  const openConnect = () => {
    void connect({
      client,
      wallets,
      chain: celoChain,
      theme: remitClawTheme,
      size: "compact",
      title: "Connect to RemitClaw",
      showThirdwebBranding: false,
      appMetadata: {
        name: "RemitClaw",
        description: "Send stablecoins across borders, as easy as a message.",
        url: "https://remifi.xyz",
      },
    }).catch(() => {
      /* user closed modal or auth failed */
    });
  };

  return (
    <button
      type="button"
      className="btn btn-gradient btn-block"
      onClick={openConnect}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting…" : (label ?? "Continue with wallet")}
    </button>
  );
}
