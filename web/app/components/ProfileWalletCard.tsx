"use client";

import { useState } from "react";
import { ConnectWallet } from "./ConnectWallet";
import { useWallet, shortAddress } from "../context/WalletContext";

export function ProfileWalletCard() {
  const { address, isConnected, walletId } = useWallet();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  if (!isConnected) {
    return (
      <section className="mt-6">
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">No wallet connected</p>
          <p className="mt-1 text-xs text-muted">
            Connect a wallet to see your real Celo balance and send from your own
            address.
          </p>
          <div className="mt-3 [&_button]:w-full">
            <ConnectWallet label="Connect wallet" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-soft">
            Wallet address
          </span>
          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-600">
            {walletId === "inApp" ? "Embedded" : "Connected"}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="tnum mt-2 flex w-full items-center justify-between text-left font-semibold text-ink"
        >
          <span>{shortAddress(address)}</span>
          <span className="text-xs font-semibold text-brand-600">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
    </section>
  );
}
