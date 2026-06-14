import { createWallet, inAppWallet, type Wallet } from "thirdweb/wallets";
import { celoChain } from "./thirdweb";

/** Default in-app wallet — silent one-tap signing after UI confirm. */
export function getRemifiInAppWallet(): Wallet {
  const sponsorGas =
    process.env.NEXT_PUBLIC_THIRDWEB_SPONSOR_GAS !== "false";

  return inAppWallet({
    auth: { options: ["email", "google", "apple", "passkey", "phone"] },
    metadata: { name: "Remifi" },
    smartAccount: {
      chain: celoChain,
      sponsorGas,
    },
  });
}

/** Primary connect list: in-app only (no MetaMask popups). */
export function getRemifiWallets(): Wallet[] {
  return [getRemifiInAppWallet()];
}

/** Optional external wallets under "Use existing wallet". */
export function getRemifiAdvancedWallets(): Wallet[] {
  return [
    createWallet("io.metamask"),
    createWallet("com.valoraapp"),
    createWallet("walletConnect"),
  ];
}
