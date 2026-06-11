"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAddContact } from "../../../context/AddContactContext";
import { AppHeader } from "../../../components/AppHeader";
import { PeopleList } from "../../../components/PeopleList";
import { PeopleDashboard } from "../../../components/PeopleDashboard";
import { PhoneShell } from "../../../components/PhoneShell";

export default function AddPersonRedirect() {
  const router = useRouter();
  const { openAddContact } = useAddContact();

  useEffect(() => {
    openAddContact();
    router.replace("/people");
  }, [openAddContact, router]);

  return (
    <PhoneShell nav="people" desktop={<PeopleDashboard />} title="People">
      <div className="screen screen-has-nav px-5 pt-5">
        <AppHeader />
        <PeopleList />
      </div>
    </PhoneShell>
  );
}
