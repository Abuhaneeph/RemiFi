import { createWallet, inAppWallet } from "thirdweb/wallets";

export const remitClawAppMetadata = {
  name: "RemitClaw",
  description: "Send stablecoins across borders, as easy as a message.",
  url: "https://remitclaw.app",
};

/** Wallets offered in connect modal and auto-connect. */
export const remitClawWallets = [
  inAppWallet({
    auth: { options: ["email", "google", "apple", "passkey"] },
    metadata: { name: "RemitClaw" },
  }),
  createWallet("io.metamask"),
  createWallet("com.valoraapp"),
  createWallet("walletConnect"),
];
