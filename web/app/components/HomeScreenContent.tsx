"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ActionButtons } from "./ActionButtons";
import { AIPayBanner } from "./AIPayBanner";
import { AppHeader } from "./AppHeader";
import { BalanceSection } from "./BalanceSection";
import { HomeContacts } from "./HomeContacts";

const WalletAssets = dynamic(
  () => import("./WalletAssets").then((m) => m.WalletAssets),
  {
    loading: () => (
      <div className="mt-7 h-40 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle" />
    ),
  }
);

const AddContactAutoOpen = dynamic(
  () =>
    import("./AddContactAutoOpen").then((m) => m.AddContactAutoOpen),
  { ssr: false }
);

export function HomeScreenContent() {
  return (
    <>
      <Suspense fallback={null}>
        <AddContactAutoOpen />
      </Suspense>
      <div className="screen screen-has-nav min-h-0 flex-1 px-5 pt-5">
        <AppHeader />
        <BalanceSection />
        <ActionButtons />
        <HomeContacts />
        <WalletAssets limit={4} showMoreLink />
        <AIPayBanner />
      </div>
    </>
  );
}
