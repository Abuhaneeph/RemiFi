import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { DashboardProfileLink } from "./DashboardProfileLink";
import { DesktopNav } from "./DesktopNav";
import { DesktopHeaderActions } from "./DesktopHeaderActions";

export function DesktopShell({
  children,
  flush = false,
}: {
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <BrandLogo
            src="/logo.png"
            size={44}
            className="dashboard-brand-logo"
          />
        </div>

        <DesktopNav />

        <DashboardProfileLink />
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-content-column">
          <div className="dashboard-header-bar">
            <DesktopHeaderActions />
          </div>
          <div
            className={`dashboard-content${flush ? " dashboard-content-flush" : ""}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
