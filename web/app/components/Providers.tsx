"use client";

import { AddContactProvider } from "../context/AddContactContext";
import { ContactsProvider } from "../context/ContactsContext";
import { LanguageProvider } from "../context/LanguageContext";
import { WalletPreferencesProvider } from "../context/WalletPreferencesContext";
import { Web3Providers } from "./Web3Providers";

/** App-wide providers (thirdweb must wrap anything using useWallet / useActiveAccount). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <WalletPreferencesProvider>
        <AddContactProvider>
          <Web3Providers>
            <ContactsProvider>{children}</ContactsProvider>
          </Web3Providers>
        </AddContactProvider>
      </WalletPreferencesProvider>
    </LanguageProvider>
  );
}
