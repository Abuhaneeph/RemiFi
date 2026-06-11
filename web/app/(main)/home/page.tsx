import { HomeDashboard } from "../../components/HomeDashboard";
import { HomeScreenContent } from "../../components/HomeScreenContent";
import { PhoneShell } from "../../components/PhoneShell";

export default function HomeScreen() {
  return (
    <PhoneShell nav="home" desktop={<HomeDashboard />}>
      <HomeScreenContent />
    </PhoneShell>
  );
}
