import {
  getRemifiAdvancedWallets,
  getRemifiInAppWallet,
  getRemifiWallets,
} from "./thirdweb-wallets";

export const remitClawAppMetadata = {
  name: "Remifi",
  description: "Send stablecoins across borders, as easy as a message.",
  url: "https://remifi.xyz",
};

/** Primary wallets for auto-connect (in-app smart wallet). */
export const remitClawWallets = getRemifiWallets();

export { getRemifiInAppWallet, getRemifiAdvancedWallets };
