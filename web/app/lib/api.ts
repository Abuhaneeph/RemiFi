const API_BASE =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8787";

const API_KEY = process.env.NEXT_PUBLIC_AGENT_API_KEY;

export type TransferContext = {
  destinationCountry?: string;
  recipientWallet?: string;
  recipientPhone?: string;
};

export type QuoteResponse = {
  kind: "quote" | "schedule";
  intent: {
    amount: number;
    sourceCurrency: string;
    destinationCountry: string;
    recipientName?: string;
    frequency: string;
  };
  summary: string;
  savings?: string;
  needsConfirmation?: boolean;
  recipientReceives?: number;
  destinationCurrency?: string;
  mentoFeeUsd?: number;
  estimatedGasUsd?: number;
  routeHops?: number;
  mentoPair?: string;
  scheduleNextRunAt?: string;
  deliveryMethod?: "wallet" | "escrow";
  matchedContact?: string;
  exchangeRate?: number;
};

export type TransferResponse = {
  status: "confirmed" | "failed";
  receiptId: string;
  txHash?: string;
  recipientReceives: number;
  destinationCurrency: string;
  summary: string;
  savings: string;
  deliveryMethod?: "wallet" | "escrow";
  claimUrl?: string;
  notificationSent?: boolean;
};

export type StoredContact = {
  id: string;
  name: string;
  country?: string;
  phone?: string;
  walletAddress?: string;
  favourite?: boolean;
  source?: "phone" | "manual" | "seed";
  updatedAt?: string;
};

export type PhoneImportEntry = {
  name: string;
  phone: string;
};

export type ContactsResponse = {
  contacts: StoredContact[];
};

export type ClaimInfoResponse = {
  claimId: string;
  vaultAddress: string | null;
  depositor: string;
  token: string;
  amount: string;
  amountFormatted: string;
  expiry: string;
  status: number;
};

export type BalanceItem = {
  symbol: string;
  address: string;
  balance: number;
};

export type BalanceResponse = {
  address: string;
  items: BalanceItem[];
};

export type AgentResponse = {
  address: string | null;
  chainId: number;
  agentId?: number | null;
  registered?: boolean;
};

export type ProfileCorridor = {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  label: string;
};

export type ProfileResponse = {
  limits: {
    dailyLimitUsd: number;
    singleTransferLimitUsd: number;
    dailySpentUsd: number;
    confirmationThresholdUsd: number;
  };
  corridors: ProfileCorridor[];
  defaultCorridorId: string;
};

export type HealthResponse = {
  ok: boolean;
  chainId: number;
  executionReady: boolean;
  vaultConfigured?: boolean;
  contactsCount?: number;
};

export type HistoryItem = {
  id: string;
  status: string;
  amount: number;
  sourceCurrency: string;
  destinationCountry: string;
  recipientName?: string;
  txHash?: string;
  createdAt: string;
};

export type HistoryResponse = {
  items: HistoryItem[];
};

export type ScheduleItem = {
  id: string;
  intent: {
    amount: number;
    sourceCurrency: string;
    destinationCountry: string;
    recipientName?: string;
    frequency: string;
  };
  nextRunAt: string;
  active: boolean;
};

export type SchedulesResponse = {
  schedules: ScheduleItem[];
};

function headers(): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) base["x-api-key"] = API_KEY;
  return base;
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return data;
}

export function agentApiBase(): string {
  return API_BASE;
}

/** Agent readiness (quotes work when ok; transfers need executionReady). */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, { headers: headers() });
  return handle<HealthResponse>(res);
}

/** Parse a message and fetch a live Mento quote + fee comparison (no execution). */
export async function fetchQuote(
  message: string,
  ctx?: TransferContext
): Promise<QuoteResponse> {
  const res = await fetch(`${API_BASE}/api/intent`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, ...ctx }),
  });
  return handle<QuoteResponse>(res);
}

/** Execute a transfer derived from a message. Returns a real txHash on success. */
export async function executeTransfer(
  message: string,
  ctx?: TransferContext
): Promise<TransferResponse> {
  const res = await fetch(`${API_BASE}/api/transfer`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, ...ctx }),
  });
  return handle<TransferResponse>(res);
}

/** The agent's on-chain address (Model A wallet) used for demo balances. */
export async function fetchAgentInfo(): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/api/agent`, { headers: headers() });
  return handle<AgentResponse>(res);
}

/** Spending limits and supported corridors from the agent config. */
export async function fetchProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${API_BASE}/api/profile`, { headers: headers() });
  return handle<ProfileResponse>(res);
}

export async function fetchBalances(address: string): Promise<BalanceResponse> {
  const res = await fetch(
    `${API_BASE}/api/balance?address=${encodeURIComponent(address)}&_=${Date.now()}`,
    { headers: headers(), cache: "no-store" }
  );
  return handle<BalanceResponse>(res);
}

/** Transfer history from the agent store (data/transactions.json). */
export async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/api/history`, { headers: headers() });
  return handle<HistoryResponse>(res);
}

export async function fetchSchedules(): Promise<SchedulesResponse> {
  const res = await fetch(`${API_BASE}/api/schedules`, { headers: headers() });
  return handle<SchedulesResponse>(res);
}

export async function cancelSchedule(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
  return handle<{ ok: boolean }>(res);
}

export async function toggleSchedule(
  id: string,
  active: boolean
): Promise<{ schedule: ScheduleItem }> {
  const res = await fetch(`${API_BASE}/api/schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ active }),
  });
  return handle<{ schedule: ScheduleItem }>(res);
}

/** Sync contacts to the agent API so Telegram/WhatsApp/CLI can resolve names. */
export async function syncContacts(
  contacts: StoredContact[]
): Promise<ContactsResponse> {
  const res = await fetch(`${API_BASE}/api/contacts/sync`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ contacts }),
  });
  return handle<ContactsResponse>(res);
}

/** Fetch contacts stored on the agent API. */
export async function fetchContacts(): Promise<ContactsResponse> {
  const res = await fetch(`${API_BASE}/api/contacts`, { headers: headers() });
  return handle<ContactsResponse>(res);
}

/** Bulk import device address-book entries into the agent contact store. */
export async function importPhoneContacts(
  contacts: PhoneImportEntry[]
): Promise<ContactsResponse & { imported: number }> {
  const res = await fetch(`${API_BASE}/api/contacts/import-phone`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ contacts }),
  });
  return handle<ContactsResponse & { imported: number }>(res);
}

/** Read escrow details for a claim link (public). */
export async function fetchClaimInfo(
  claimId: string
): Promise<ClaimInfoResponse> {
  const res = await fetch(
    `${API_BASE}/api/claim?claimId=${encodeURIComponent(claimId)}`,
    { headers: headers() }
  );
  return handle<ClaimInfoResponse>(res);
}

/** Celo explorer tx link (mainnet by default; Sepolia uses celo-sepolia subdomain). */
export function explorerTxUrl(txHash: string): string {
  const base =
    process.env.NEXT_PUBLIC_CELO_EXPLORER ?? "https://celoscan.io";
  return `${base}/tx/${txHash}`;
}

/** Format ISO timestamp for recent tx list. */
export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (sameDay) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
