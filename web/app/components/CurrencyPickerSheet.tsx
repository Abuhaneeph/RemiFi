"use client";

import { useState } from "react";
import { DISPLAY_CURRENCIES } from "../data/currencies";
import { useWalletPreferences } from "../context/WalletPreferencesContext";
import { CheckIcon } from "./icons";
import { MobileSheet } from "./MobileSheet";

type CurrencyPickerSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CurrencyPickerSheet({ open, onClose }: CurrencyPickerSheetProps) {
  const { currencyCode, setCurrencyCode } = useWalletPreferences();

  const handleSelect = (code: string) => {
    setCurrencyCode(code);
    onClose();
  };

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title="Display currency"
      subtitle="Choose how your balance is shown"
      stacked
      size="list"
    >
      <div className="sheet-list">
        <div className="sheet-options">
          {DISPLAY_CURRENCIES.map((item) => {
            const selected = item.code === currencyCode;
            return (
              <button
                key={item.code}
                type="button"
                className={`sheet-option ${selected ? "sheet-option-active" : ""}`}
                onTouchStart={() => handleSelect(item.code)}
                onClick={() => handleSelect(item.code)}
              >
                <span className="sheet-option-flag text-base font-bold" aria-hidden>
                  {item.symbol}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-ink">
                    {item.label}
                  </span>
                  <span className="text-xs font-medium text-soft">
                    {item.pillLabel}
                  </span>
                </span>
                {selected ? (
                  <CheckIcon className="h-5 w-5 shrink-0 text-brand-600" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </MobileSheet>
  );
}

export function CurrencyPickerButton() {
  const [open, setOpen] = useState(false);
  const { currency } = useWalletPreferences();

  return (
    <>
      <button
        type="button"
        className="pill pill-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Change display currency"
        onTouchStart={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        {currency.pillLabel}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-soft" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <CurrencyPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
