import { Suspense } from "react";
import { ResponsiveShell } from "../../components/ResponsiveShell";
import { AuthFlow } from "../../components/AuthFlow";

export const dynamic = "force-dynamic";

export default function AuthScreen() {
  return (
    <ResponsiveShell desktopMode="centered" bareMobile>
      <Suspense fallback={null}>
        <AuthFlow />
      </Suspense>
    </ResponsiveShell>
  );
}
