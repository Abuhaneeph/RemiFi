import type { ReactNode } from "react";
import { BottomNav, type NavTab } from "./BottomNav";
import { DesktopShell } from "./DesktopShell";

export function ResponsiveShell({
  children,
  desktop,
  nav,
  title,
  flush = false,
  desktopMode = "dashboard",
  bareMobile = false,
}: {
  children: ReactNode;
  desktop?: ReactNode;
  nav?: NavTab;
  title?: string;
  flush?: boolean;
  desktopMode?: "dashboard" | "centered";
  bareMobile?: boolean;
}) {
  const desktopContent = desktop ?? children;

  return (
    <>
      <div className={`layout-mobile${bareMobile ? " layout-mobile-bare" : ""}`}>
        {bareMobile ? (
          <div className="onboarding-mobile-shell flex min-h-0 flex-1 flex-col">
            {children}
          </div>
        ) : (
          <div className="phone">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            {nav ? <BottomNav active={nav} /> : null}
          </div>
        )}
      </div>

      <div className="layout-desktop">
        {desktopMode === "centered" ? (
          <div className="dashboard-onboarding">
            <div className="dashboard-onboarding-column">{desktopContent}</div>
          </div>
        ) : (
          <DesktopShell flush={flush}>
            {desktopContent}
          </DesktopShell>
        )}
      </div>
    </>
  );
}
