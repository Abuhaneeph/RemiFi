"use client";

import { useEffect, useRef } from "react";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import { celoChain } from "../lib/thirdweb";

/** Prompts the active wallet to switch to the configured Celo network after connect. */
export function CeloChainSync() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const switching = useRef(false);

  useEffect(() => {
    if (!account || switching.current) return;
    if (activeChain?.id === celoChain.id) return;

    switching.current = true;
    void switchChain(celoChain)
      .catch(() => {
        // User may reject the network switch; allow retry on the next effect run.
      })
      .finally(() => {
        switching.current = false;
      });
  }, [account, activeChain?.id, switchChain]);

  return null;
}
