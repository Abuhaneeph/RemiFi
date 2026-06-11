"use client";

import { useState } from "react";
import { phonePlaceholder } from "../data/countries";
import { useContacts } from "../context/ContactsContext";
import { useLanguage } from "../context/LanguageContext";
import { canPickPhoneContacts, pickPhoneContact } from "../lib/phone-contacts";
import { CountryPickerField } from "./CountryPickerSheet";
import { MobileSheet } from "./MobileSheet";
import { QrScanner } from "./QrScanner";

type AddContactFormProps = {
  onSaved: () => void;
};

export function AddContactForm({ onSaved }: AddContactFormProps) {
  const { addPerson } = useContacts();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("PH");
  const [phone, setPhone] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [favourite, setFavourite] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const phonePickerAvailable = canPickPhoneContacts();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addPerson({
      name: name.trim(),
      country,
      phone: phone.trim() || undefined,
      walletAddress: walletAddress.trim() || undefined,
      favourite,
    });
    onSaved();
  };

  const handlePickFromPhone = async () => {
    setPicking(true);
    try {
      const picked = await pickPhoneContact();
      if (!picked) return;
      if (picked.name) setName(picked.name);
      if (picked.phone) setPhone(picked.phone);
    } finally {
      setPicking(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <section>
          <label htmlFor="add-contact-name" className="form-label">
            {t("contact.name")}
          </label>
          <input
            id="add-contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contact.namePlaceholder")}
            className="form-field mt-2 w-full"
            autoComplete="name"
            required
          />
        </section>

        <section className="mt-4">
          <CountryPickerField
            value={country}
            onChange={setCountry}
            label={t("contact.country")}
          />
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="add-contact-wallet" className="form-label">
              {t("contact.wallet")}
            </label>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700"
              onClick={() => setScanOpen(true)}
            >
              {t("contact.scanQr")}
            </button>
          </div>
          <input
            id="add-contact-wallet"
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder={t("contact.walletPlaceholder")}
            className="form-field mt-2 w-full font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="add-contact-phone" className="form-label">
              {t("contact.phone")}
            </label>
            {phonePickerAvailable ? (
              <button
                type="button"
                className="text-xs font-semibold text-brand-700"
                onClick={() => void handlePickFromPhone()}
                disabled={picking}
              >
                {picking ? "…" : t("people.fromPhone")}
              </button>
            ) : null}
          </div>
          <input
            id="add-contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={phonePlaceholder(country)}
            className="form-field mt-2 w-full"
            autoComplete="tel"
          />
        </section>

        <label className="method-row mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={favourite}
            onChange={(e) => setFavourite(e.target.checked)}
            className="accent-brand-500"
          />
          <span className="font-semibold text-ink">{t("contact.favourite")}</span>
        </label>

        <button
          type="submit"
          className="btn btn-gradient btn-block mt-5"
          disabled={!name.trim()}
        >
          {t("contact.save")}
        </button>
      </form>

      <MobileSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title={t("contact.scanQr")}
        stacked
        size="scan"
        bodyClassName="scan-sheet-body"
      >
        <QrScanner
          walletOnly
          onScan={(address) => {
            setWalletAddress(address);
            setScanOpen(false);
          }}
        />
      </MobileSheet>
    </>
  );
}
