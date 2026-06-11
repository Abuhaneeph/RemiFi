"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  COUNTRIES,
  POPULAR_COUNTRIES,
  countryFlag,
  filterCountries,
  getCountryLabel,
  type Country,
} from "../data/countries";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "./icons";
import { OverlayPortal } from "./OverlayPortal";

type CountryPickerSheetProps = {
  open: boolean;
  value: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

function CountryOption({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <button
      type="button"
      className={`sheet-option ${selected ? "sheet-option-active" : ""}`}
      onClick={() => onSelect(country.code)}
    >
      <span className="sheet-option-flag" aria-hidden>
        {countryFlag(country.code)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-semibold text-ink">{country.label}</span>
        <span className="text-xs font-medium text-soft">{country.code}</span>
      </span>
      {selected && <CheckIcon className="h-5 w-5 shrink-0 text-brand-600" />}
    </button>
  );
}

export function CountryPickerSheet({
  open,
  value,
  onSelect,
  onClose,
}: CountryPickerSheetProps) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const filteredPopular = useMemo(
    () => filterCountries(query, POPULAR_COUNTRIES),
    [query]
  );
  const filteredAll = useMemo(() => {
    const matches = filterCountries(query, COUNTRIES);
    if (query.trim()) return matches;
    const popularCodes = new Set(POPULAR_COUNTRIES.map((c) => c.code));
    return matches.filter((c) => !popularCodes.has(c.code));
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 160);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        className="mobile-sheet mobile-sheet-stacked"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="mobile-sheet-panel mobile-sheet-panel-list"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="sheet-handle-wrap">
          <span className="sheet-handle" aria-hidden />
        </div>

        <div className="sheet-header">
          <h2 id={titleId} className="text-[1.05rem] font-bold text-ink">
            Receiving country
          </h2>
          <p className="mt-1 text-sm text-muted">
            {getCountryLabel(value)}
          </p>
        </div>

        <div className="sheet-search">
          <SearchIcon className="h-[1.1rem] w-[1.1rem] shrink-0 text-soft" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries"
            className="min-w-0 flex-1 bg-transparent text-[0.9rem] text-ink outline-none placeholder:text-soft"
          />
        </div>

        <div className="sheet-list">
          {filteredPopular.length > 0 && (
            <section>
              <p className="sheet-section-label">Popular corridors</p>
              <div className="sheet-options">
                {filteredPopular.map((country) => (
                  <CountryOption
                    key={`popular-${country.code}`}
                    country={country}
                    selected={country.code === value}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredAll.length > 0 && (
            <section className={filteredPopular.length > 0 ? "mt-4" : undefined}>
              <p className="sheet-section-label">
                {query.trim() ? "Results" : "All countries"}
              </p>
              <div className="sheet-options">
                {filteredAll.map((country) => (
                  <CountryOption
                    key={country.code}
                    country={country}
                    selected={country.code === value}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredPopular.length === 0 && filteredAll.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No countries match your search.
            </p>
          )}
        </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

type CountryPickerFieldProps = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
};

export function CountryPickerField({
  value,
  onChange,
  label = "Receiving country",
}: CountryPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = getCountryLabel(value);

  return (
    <>
      <label className="form-label">{label}</label>
      <button
        type="button"
        className="picker-field mt-2 w-full"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="picker-field-flag" aria-hidden>
          {countryFlag(value)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-semibold text-ink">
          {selectedLabel}
        </span>
        <ChevronDownIcon className="h-5 w-5 shrink-0 text-soft" />
      </button>

      <CountryPickerSheet
        open={open}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
