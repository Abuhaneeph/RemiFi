"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../context/LanguageContext";
import { BoltIcon, CardIcon, HomeIcon, UsersIcon } from "./icons";

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/home", label: t("nav.home"), icon: HomeIcon },
    { href: "/wallet", label: t("nav.wallet"), icon: CardIcon },
    { href: "/people", label: t("nav.people"), icon: UsersIcon },
  ] as const;

  return (
    <nav className="dashboard-nav" aria-label="Main navigation">
      <ul className="dashboard-nav-list">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="dashboard-nav-item"
              data-active={isActive(pathname, href)}
            >
              <Icon className="dashboard-nav-icon" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/pay"
            className="dashboard-nav-item dashboard-nav-item-pay"
            data-active={isActive(pathname, "/pay")}
          >
            <BoltIcon className="dashboard-nav-icon" />
            <span>{t("nav.pay")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
