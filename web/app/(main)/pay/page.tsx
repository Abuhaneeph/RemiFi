import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ResponsiveShell } from "../../components/ResponsiveShell";

const PayChat = dynamic(
  () => import("../../components/PayChat").then((m) => m.PayChat),
  {
    loading: () => (
      <div className="screen flex flex-1 flex-col px-5 pt-5">
        <div className="h-10 w-32 animate-pulse rounded bg-surface-subtle" />
        <div className="mt-6 flex-1 space-y-3">
          <div className="h-16 w-[75%] animate-pulse rounded-2xl bg-surface-subtle" />
          <div className="ml-auto h-12 w-[60%] animate-pulse rounded-2xl bg-surface-subtle" />
        </div>
      </div>
    ),
  }
);

export default function PayScreen() {
  return (
    <ResponsiveShell title="AI Pay" flush>
      <Suspense fallback={null}>
        <PayChat />
      </Suspense>
    </ResponsiveShell>
  );
}
