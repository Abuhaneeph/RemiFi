"use client";

import { Suspense, useMemo } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { AgentApiProvider } from "../context/AgentApiContext";
import { getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";
import { remitClawAppMetadata } from "../lib/wallets";
import { celoChain } from "../lib/thirdweb";
import { getRemifiWallets } from "../lib/thirdweb-wallets";
import { CeloChainSync } from "./CeloChainSync";
import { RemifiMoonPayProvider } from "./MoonPayProvider";
import { SafeAutoConnect } from "./SafeAutoConnect";
import { TelegramWalletLink } from "./TelegramWalletLink";

/** Wallet + agent API — one provider tree for onboarding and main app. */
export function Web3Providers({ children }: { children: React.ReactNode }) {
  const client = getThirdwebClient();
  const wallets = useMemo(() => getRemifiWallets(), []);

  return (
    <ThirdwebProvider>
      <RemifiMoonPayProvider>
        {thirdwebConfigured && client ? (
          <>
            <SafeAutoConnect
              client={client}
              wallets={wallets}
              chain={celoChain}
              appMetadata={remitClawAppMetadata}
              timeout={10_000}
            />
            <CeloChainSync />
          </>
        ) : null}
        <AgentApiProvider>
          <Suspense fallback={null}>
            <TelegramWalletLink />
          </Suspense>
          {children}
        </AgentApiProvider>
      </RemifiMoonPayProvider>
    </ThirdwebProvider>
  );
}
