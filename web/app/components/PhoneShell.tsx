import type { ReactNode } from "react";
import { ResponsiveShell } from "./ResponsiveShell";
import type { NavTab } from "./BottomNav";

export function PhoneShell({
  children,
  nav,
  desktop,
  title,
  flush,
  desktopMode,
}: {
  children: ReactNode;
  nav?: NavTab;
  desktop?: ReactNode;
  title?: string;
  flush?: boolean;
  desktopMode?: "dashboard" | "centered";
}) {
  return (
    <ResponsiveShell
      nav={nav}
      desktop={desktop}
      title={title}
      flush={flush}
      desktopMode={desktopMode}
    >
      {children}
    </ResponsiveShell>
  );
}
