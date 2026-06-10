"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ActionButtons } from "./ActionButtons";
import { AIPayBanner } from "./AIPayBanner";
import { AppHeader } from "./AppHeader";
import { BalanceSection } from "./BalanceSection";
import { HomeContacts } from "./HomeContacts";

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
        <AIPayBanner />
      </div>
    </>
  );
}
