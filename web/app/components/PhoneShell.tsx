import type { ReactNode } from "react";
import { BottomNav, type NavTab } from "./BottomNav";

export function PhoneShell({
  children,
  nav,
}: {
  children: ReactNode;
  nav?: NavTab;
}) {
  return (
    <div className="phone">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {nav && <BottomNav active={nav} />}
    </div>
  );
}
