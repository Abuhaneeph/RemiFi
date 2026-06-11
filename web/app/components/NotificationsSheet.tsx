"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { NOTIFICATIONS, type AppNotification } from "../data/notifications";
import { MobileSheet } from "./MobileSheet";
import { getSessionId } from "../lib/session";

type NotificationsSheetProps = {
  open: boolean;
  onClose: () => void;
};

type DbNotification = {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function NotificationRow({
  item,
  onRead,
}: {
  item: AppNotification;
  onRead: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`notification-item${item.unread ? " notification-item-unread" : ""}`}
      onTouchStart={() => onRead(item.id)}
      onClick={() => onRead(item.id)}
    >
      <span className="notification-dot" aria-hidden={!item.unread} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-ink">{item.title}</span>
        <span className="mt-0.5 block text-sm text-muted">{item.body}</span>
        <span className="mt-1 block text-xs font-semibold text-soft">
          {item.time}
        </span>
      </span>
    </button>
  );
}

export function NotificationsSheet({ open, onClose }: NotificationsSheetProps) {
  const [items, setItems] = useState<AppNotification[]>(NOTIFICATIONS);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    const sid = getSessionId();
    if (!sid) { setLoading(false); return; }
    fetch(`/api/notifications?sessionId=${sid}`)
      .then((r) => r.json())
      .then((data: { notifications?: DbNotification[] }) => {
        const rows = data.notifications ?? [];
        if (rows.length > 0) {
          setItems(
            rows.map((n) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              unread: n.unread,
              time: timeAgo(n.created_at),
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.unread).length,
    [items]
  );

  const markRead = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      )
    );
    const sid = getSessionId();
    if (sid) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, id }),
      }).catch(() => {});
    }
  };

  const markAllRead = () => {
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
    const sid = getSessionId();
    if (sid) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, allRead: true }),
      }).catch(() => {});
    }
  };

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={
        loading
          ? "Loading…"
          : unreadCount > 0
            ? `${unreadCount} unread`
            : "You're all caught up"
      }
      stacked
      size="list"
    >
      <div className="sheet-list">
        {unreadCount > 0 && !loading ? (
          <div className="px-4 pb-2">
            <button
              type="button"
              className="text-sm font-semibold text-brand-600"
              onTouchStart={markAllRead}
              onClick={markAllRead}
            >
              Mark all as read
            </button>
          </div>
        ) : null}

        <div className="sheet-options">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onRead={markRead} />
          ))}
        </div>
      </div>
    </MobileSheet>
  );
}
