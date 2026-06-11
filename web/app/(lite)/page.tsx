import { OnboardingFlow } from "../components/OnboardingFlow";
import { ResponsiveShell } from "../components/ResponsiveShell";

export default function OnboardingScreen() {
  return (
    <ResponsiveShell desktopMode="centered" bareMobile>
      <OnboardingFlow />
    </ResponsiveShell>
  );
}
