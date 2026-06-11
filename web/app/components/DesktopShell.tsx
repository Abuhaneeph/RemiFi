import Link from "next/link";
import type { ReactNode } from "react";
import { PROFILE } from "../data/people";
import { Avatar } from "./Avatar";
import { BrandLogo } from "./BrandLogo";
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

        <Link href="/profile" className="dashboard-profile-link">
          <Avatar name={PROFILE.name} src={PROFILE.avatar} size={36} ring />
          <span className="dashboard-profile-name">{PROFILE.name}</span>
        </Link>
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
