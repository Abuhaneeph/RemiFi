"use client";

import { useState } from "react";
import { LanguageSelector } from "./LanguageSelector";
import { BellIcon, ScanIcon } from "./icons";
import { NotificationsSheet } from "./NotificationsSheet";
import { ScanSheet } from "./ScanSheet";

export function DesktopHeaderActions() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <>
      <div className="dashboard-header-actions">
        <LanguageSelector variant="compact" />
        <button
          type="button"
          className="icon-btn"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen(true)}
        >
          <BellIcon className="h-[1.15rem] w-[1.15rem]" />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Scan QR"
          onClick={() => setScanOpen(true)}
        >
          <ScanIcon className="h-[1.15rem] w-[1.15rem]" />
        </button>
      </div>

      <NotificationsSheet
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}
