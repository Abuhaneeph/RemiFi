"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ActionButtons } from "./ActionButtons";
import { AIPayBanner } from "./AIPayBanner";
import { BalanceSection } from "./BalanceSection";
import { HomeContacts } from "./HomeContacts";

const AddContactAutoOpen = dynamic(
  () =>
    import("./AddContactAutoOpen").then((m) => m.AddContactAutoOpen),
  { ssr: false }
);

const WalletAssets = dynamic(
  () => import("./WalletAssets").then((m) => m.WalletAssets),
  {
    loading: () => (
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle" />
    ),
  }
);

export function HomeDashboard() {
  return (
    <>
      <Suspense fallback={null}>
        <AddContactAutoOpen />
      </Suspense>
      <div className="dashboard-stack">
        <BalanceSection />
        <ActionButtons />
        <HomeContacts />
        <WalletAssets limit={4} showMoreLink />
        <AIPayBanner />
      </div>
    </>
  );
}
