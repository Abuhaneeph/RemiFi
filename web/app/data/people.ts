export type Person = {
  id: string;
  name: string;
  avatar: string;
  country?: string;
  phone?: string;
  walletAddress?: string;
  favourite?: boolean;
  source?: "phone" | "manual" | "seed";
};

/** Illustrated toy-style avatar (DiceBear adventurer) */
export function toyAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(seed)}&size=128`;
}

export const PROFILE = {
  name: "Main Account",
  avatar: toyAvatar("main-account"),
};

export const ASSISTANT = {
  name: "Remifi",
  avatar: toyAvatar("remifi"),
};

export const WALLET_ASSETS = [
  {
    symbol: "USDm",
    name: "US Dollar",
    logo: "/tokens/usdm.png",
    code: "USD",
    balance: 2840.12,
    change: "+2.4%",
  },
  {
    symbol: "EURm",
    name: "Euro",
    logo: "/tokens/eurm.png",
    code: "EUR",
    balance: 920.5,
    change: "+0.8%",
  },
  {
    symbol: "BRLm",
    name: "Brazil Real",
    logo: "/tokens/brlm.svg",
    code: "BRL",
    balance: 473.61,
    change: "-0.3%",
  },
];

export const PEOPLE: Person[] = [
  { id: "tolly", name: "Tolly", avatar: toyAvatar("tolly"), country: "PH" },
  { id: "anisha", name: "Anisha", avatar: toyAvatar("anisha"), country: "IN" },
  { id: "raima", name: "Raima", avatar: toyAvatar("raima"), country: "KE" },
  { id: "mom", name: "Mom", avatar: toyAvatar("mom"), country: "PH", favourite: true },
  { id: "asish", name: "Asish", avatar: toyAvatar("asish"), country: "IN" },
  { id: "disha", name: "Disha", avatar: toyAvatar("disha"), country: "IN" },
];

export const FAVOURITES: Person[] = [
  { id: "mom", name: "Mom", avatar: toyAvatar("mom"), country: "PH", favourite: true },
  { id: "tolly", name: "Tolly", avatar: toyAvatar("tolly"), country: "PH", favourite: true },
  { id: "sister", name: "Sister", avatar: toyAvatar("sister"), country: "PH", favourite: true },
];

export const RECENT_TX = [
  { id: "1", to: "Mom", amount: 50, currency: "USDm", date: "Today", status: "confirmed" as const },
  { id: "2", to: "Tolly", amount: 120, currency: "EURm", date: "Yesterday", status: "confirmed" as const },
  { id: "3", to: "Anisha", amount: 35, currency: "USDm", date: "Jun 4", status: "pending" as const },
];

export function findPerson(name: string): Person | undefined {
  const all = [...PEOPLE, ...FAVOURITES];
  return all.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function payLink(name: string, amount?: number) {
  const params = new URLSearchParams({ to: name });
  if (amount) params.set("amount", String(amount));
  return `/pay?${params.toString()}`;
}

export function getAsset(tokenSymbol: string) {
  return WALLET_ASSETS.find((a) => a.symbol === tokenSymbol);
}
