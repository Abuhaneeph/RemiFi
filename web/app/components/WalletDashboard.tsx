"use client";

import dynamic from "next/dynamic";
import { ActionButtons } from "./ActionButtons";
import { BalanceSection } from "./BalanceSection";

const WalletAssets = dynamic(
  () => import("./WalletAssets").then((m) => m.WalletAssets),
  {
    loading: () => (
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle" />
    ),
  }
);

export function WalletDashboard() {
  return (
    <div className="dashboard-stack">
      <BalanceSection />
      <ActionButtons />
      <WalletAssets />
    </div>
  );
}
