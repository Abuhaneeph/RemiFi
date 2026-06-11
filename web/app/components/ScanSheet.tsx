"use client";

import { useRouter } from "next/navigation";
import { MobileSheet } from "./MobileSheet";
import { QrScanner } from "./QrScanner";
import { parseWalletFromQr } from "../lib/qr";
import { useLanguage } from "../context/LanguageContext";

type ScanSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function ScanSheet({ open, onClose }: ScanSheetProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const handleScan = (raw: string) => {
    const wallet = parseWalletFromQr(raw);
    if (wallet) {
      onClose();
      router.push(`/pay?wallet=${encodeURIComponent(wallet)}`);
      return;
    }
    onClose();
    router.push(`/pay?to=${encodeURIComponent(raw)}`);
  };

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={t("scan.title")}
      subtitle={t("scan.subtitle")}
      stacked
      size="scan"
      bodyClassName="scan-sheet-body"
    >
      <QrScanner
        walletOnly={false}
        onScan={handleScan}
        onError={() => {
          /* inline error in QrScanner */
        }}
      />
    </MobileSheet>
  );
}
