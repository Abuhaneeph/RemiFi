import { Suspense } from "react";
import { ResponsiveShell } from "../../../components/ResponsiveShell";
import { PayConfirmFlow } from "../../../components/PayConfirmFlow";

export const dynamic = "force-dynamic";

export default function PayConfirmPage() {
  return (
    <ResponsiveShell desktopMode="centered" bareMobile>
      <Suspense fallback={null}>
        <PayConfirmFlow />
      </Suspense>
    </ResponsiveShell>
  );
}
