"use client";

import { AutoConnect, ThirdwebProvider } from "thirdweb/react";
import { AgentApiProvider } from "../context/AgentApiContext";
import { getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";
import { getRemifiWallets } from "../lib/thirdweb-wallets";
import { RemifiMoonPayProvider } from "./MoonPayProvider";

/** Wallet + agent API — one provider tree for onboarding and main app. */
export function Web3Providers({ children }: { children: React.ReactNode }) {
  const client = getThirdwebClient();
  const wallets = getRemifiWallets();

  return (
    <ThirdwebProvider>
      <RemifiMoonPayProvider>
        {thirdwebConfigured && client ? (
          <AutoConnect client={client} wallets={wallets} />
        ) : null}
        <AgentApiProvider>{children}</AgentApiProvider>
      </RemifiMoonPayProvider>
    </ThirdwebProvider>
  );
}
