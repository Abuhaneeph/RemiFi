"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useLanguage } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";

/** Disconnect thirdweb and return to the onboarding screen. */
export function LogoutButton() {
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { isConnected } = useWallet();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  if (!isConnected || !wallet) return null;

  const handleLogout = async () => {
    setBusy(true);
    try {
      await disconnect(wallet);
    } catch {
      /* still send user to onboarding */
    } finally {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-block mt-6"
      onClick={() => void handleLogout()}
      disabled={busy}
    >
      {busy ? t("profile.loggingOut") : t("profile.logout")}
    </button>
  );
}
