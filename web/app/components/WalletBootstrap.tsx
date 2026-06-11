"use client";

import { AutoConnect } from "thirdweb/react";
import { CeloChainSync } from "./CeloChainSync";
import { celoChain, getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";
import { remitClawAppMetadata, remitClawWallets } from "../lib/wallets";

/** Restores wallet sessions and keeps the active wallet on the configured Celo chain. */
export function WalletBootstrap() {
  const client = getThirdwebClient();
  if (!thirdwebConfigured || !client) return null;

  return (
    <>
      <AutoConnect
        client={client}
        wallets={remitClawWallets}
        chain={celoChain}
        appMetadata={remitClawAppMetadata}
        timeout={10_000}
      />
      <CeloChainSync />
    </>
  );
}
