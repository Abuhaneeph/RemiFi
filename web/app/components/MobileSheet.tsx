"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { lockBodyScroll } from "../lib/bodyScrollLock";

export type MobileSheetSize = "default" | "scan" | "form" | "list";

type MobileSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stacked?: boolean;
  size?: MobileSheetSize;
  bodyClassName?: string;
  children: ReactNode;
};

export function MobileSheet({
  open,
  onClose,
  title,
  subtitle,
  stacked = false,
  size = "default",
  bodyClassName,
  children,
}: MobileSheetProps) {
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const unlockScroll = lockBodyScroll();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const panelClass = [
    "mobile-sheet-panel",
    size !== "default" ? `mobile-sheet-panel-${size}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClass =
    bodyClassName ??
    (size === "form"
      ? "sheet-form-body"
      : size === "list"
        ? "mobile-sheet-body-flush"
        : "mobile-sheet-body");

  return createPortal(
    <div
      className={`mobile-sheet${stacked ? " mobile-sheet-stacked" : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle-wrap">
          <span className="sheet-handle" aria-hidden />
        </div>

        <div className="sheet-header sheet-header-row">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1.05rem] font-bold text-ink">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-btn shrink-0"
            aria-label="Close"
            onTouchStart={onClose}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="m6 6 12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={bodyClass}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
