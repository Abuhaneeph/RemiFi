"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "remifi.telegramUserId";

function tgFromSearch(search: string): string | null {
  const tg = new URLSearchParams(search).get("tg")?.trim() ?? null;
  return tg && tg !== "linked" ? tg : null;
}

/** Telegram ?tg= deep link — reads URL on client only (no useSearchParams / Suspense required). */
export function useTelegramDeepLink() {
  const [tgFromUrl, setTgFromUrl] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tg = params.get("tg")?.trim() ?? null;
    setLinked(tg === "linked");
    const id = tgFromSearch(window.location.search);
    setTgFromUrl(id);
    if (id) {
      sessionStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const telegramUserId = useMemo(() => {
    if (tgFromUrl) return tgFromUrl;
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(STORAGE_KEY);
  }, [tgFromUrl]);

  return { telegramUserId, linked };
}
