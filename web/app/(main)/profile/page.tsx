"use client";

import { ProfileContent } from "../../components/ProfileContent";
import { PhoneShell } from "../../components/PhoneShell";

export default function ProfileScreen() {
  return (
    <PhoneShell title="Profile">
      <ProfileContent />
    </PhoneShell>
  );
}
