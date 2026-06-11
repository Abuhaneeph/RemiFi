"use client";

import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { AddContactForm } from "./AddContactForm";
import { MobileSheet } from "./MobileSheet";

type AddContactSheetProps = {
  onClose: () => void;
};

export function AddContactSheet({ onClose }: AddContactSheetProps) {
  const { t } = useLanguage();
  const [formKey, setFormKey] = useState(0);

  const handleClose = () => {
    setFormKey((k) => k + 1);
    onClose();
  };

  const handleSaved = () => {
    setFormKey((k) => k + 1);
    onClose();
  };

  return (
    <MobileSheet
      open
      onClose={handleClose}
      title={t("contact.addTitle")}
      stacked
      size="form"
    >
      <AddContactForm key={formKey} onSaved={handleSaved} />
    </MobileSheet>
  );
}
