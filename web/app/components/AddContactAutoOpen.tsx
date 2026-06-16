"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAddContact } from "../context/AddContactContext";

/** Opens add-contact sheet when URL has ?add=1 (client-only; no useSearchParams). */
export function AddContactAutoOpen() {
  const pathname = usePathname();
  const router = useRouter();
  const { openAddContact } = useAddContact();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    if (new URLSearchParams(window.location.search).get("add") !== "1") return;
    opened.current = true;

    const frame = requestAnimationFrame(() => {
      openAddContact();
      router.replace(pathname, { scroll: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [openAddContact, pathname, router]);

  return null;
}
