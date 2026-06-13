"use client";

import Link from "next/link";
import { useLanguage } from "../context/LanguageContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { Avatar } from "./Avatar";

export function DashboardProfileLink() {
  const { t } = useLanguage();
  const { displayName, avatarSrc, isConnected } = useUserProfile();
  const name = displayName ?? t("profile.guest");

  return (
    <Link href="/profile" className="dashboard-profile-link">
      <Avatar name={name} src={avatarSrc} size={36} ring />
      <span className="dashboard-profile-name">{name}</span>
    </Link>
  );
}
