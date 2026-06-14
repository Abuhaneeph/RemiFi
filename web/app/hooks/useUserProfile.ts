"use client";

import { useMemo } from "react";
import { useProfiles } from "thirdweb/react";
import type { Profile } from "thirdweb/wallets";
import { useWallet, shortAddress } from "../context/WalletContext";
import { toyAvatar } from "../data/people";
import { getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";

function profileContact(profiles: Profile[]): {
  displayName: string;
  detail: string;
  authLabel: string;
} | null {
  for (const profile of profiles) {
    const email = profile.details.email?.trim();
    if (email) {
      const local = email.split("@")[0]?.trim();
      return {
        displayName: local || email,
        detail: email,
        authLabel: profile.type === "google" ? "Google" : "Email",
      };
    }

    const phone = profile.details.phone?.trim();
    if (phone) {
      return {
        displayName: phone,
        detail: phone,
        authLabel: "Phone",
      };
    }
  }

  const social = profiles[0];
  if (social?.type) {
    const label =
      social.type.charAt(0).toUpperCase() + social.type.slice(1);
    return {
      displayName: label,
      detail: label,
      authLabel: label,
    };
  }

  return null;
}

export function useUserProfile() {
  const { address, isConnected, walletId } = useWallet();
  const client = getThirdwebClient();
  const profilesQuery = useProfiles({
    client: client as NonNullable<typeof client>,
  });

  const profiles = useMemo(
    () => (thirdwebConfigured && isConnected ? profilesQuery.data ?? [] : []),
    [isConnected, profilesQuery.data]
  );

  const contact = useMemo(
    () => (profiles.length ? profileContact(profiles) : null),
    [profiles]
  );

  const displayName = useMemo(() => {
    if (!isConnected || !address) return null;
    if (contact?.displayName) return contact.displayName;
    return shortAddress(address);
  }, [isConnected, address, contact]);

  const subtitle = useMemo(() => {
    if (!isConnected || !address) return null;
    if (contact?.detail) return contact.detail;
    return `0x${address.slice(2, 6)}…${address.slice(-4)} · Celo`;
  }, [isConnected, address, contact]);

  const avatarSrc = useMemo(() => {
    if (!isConnected) return toyAvatar("guest");
    const seed = contact?.detail ?? address ?? "remifi-user";
    return toyAvatar(seed);
  }, [isConnected, address, contact]);

  const walletLabel = useMemo(() => {
    if (!isConnected) return null;
    if (walletId === "inApp") return "Remifi wallet";
    return "Connected wallet";
  }, [isConnected, walletId]);

  return {
    displayName,
    subtitle,
    avatarSrc,
    walletLabel,
    authLabel: contact?.authLabel ?? null,
    isConnected,
    address,
    profilesLoading: profilesQuery.isLoading && isConnected,
  };
}
