"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

const STORAGE_KEY = "remifi.telegramUserId";

export function useTelegramDeepLink() {
  const searchParams = useSearchParams();
  const tgFromUrl = searchParams.get("tg")?.trim() ?? null;
  const linked = searchParams.get("tg") === "linked";

  useEffect(() => {
    if (tgFromUrl && tgFromUrl !== "linked") {
      sessionStorage.setItem(STORAGE_KEY, tgFromUrl);
    }
  }, [tgFromUrl]);

  const telegramUserId = useMemo(() => {
    if (tgFromUrl && tgFromUrl !== "linked") return tgFromUrl;
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(STORAGE_KEY);
  }, [tgFromUrl]);

  return { telegramUserId, linked };
}
