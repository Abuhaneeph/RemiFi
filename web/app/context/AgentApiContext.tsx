"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  fetchAgentInfo,
  fetchBalances,
  type BalanceItem,
} from "../lib/api";
import { deferNonCritical } from "../lib/defer";

type AgentApiContextValue = {
  balances: BalanceItem[];
  balanceAddress: string | null;
  balancesLoading: boolean;
  balancesError: string | null;
  refreshBalances: () => Promise<void>;
  /** Optimistic deduct + poll until on-chain balance reflects the send. */
  refreshBalancesAfterSend: (sentAmountUsd: number) => Promise<void>;
};

const AgentApiContext = createContext<AgentApiContextValue | null>(null);

function deductUsd(items: BalanceItem[], amountUsd: number): BalanceItem[] {
  if (amountUsd <= 0) return items;
  return items.map((item) => {
    if (item.symbol !== "USDC" && item.symbol !== "USDm") return item;
    return { ...item, balance: Math.max(0, item.balance - amountUsd) };
  });
}

export function AgentApiProvider({ children }: { children: ReactNode }) {
  const account = useActiveAccount();
  const userAddress = account?.address ?? null;

  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [balanceAddress, setBalanceAddress] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  const syncBalances = useCallback(async () => {
    const address =
      userAddress ??
      (await fetchAgentInfo().catch(() => ({ address: null }))).address;

    if (!address) {
      setBalances([]);
      setBalanceAddress(null);
      setBalancesError(
        userAddress
          ? "Could not read wallet balance."
          : "Connect your wallet or configure the agent wallet."
      );
      return;
    }

    const { items } = await fetchBalances(address);
    setBalances(Array.isArray(items) ? items : []);
    setBalanceAddress(address);
    setBalancesError(null);
  }, [userAddress]);

  const refreshBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      await syncBalances();
    } catch (err) {
      setBalances([]);
      setBalanceAddress(null);
      setBalancesError(
        err instanceof Error ? err.message : "Could not load balances"
      );
    } finally {
      setBalancesLoading(false);
    }
  }, [syncBalances]);

  const refreshBalancesAfterSend = useCallback(
    async (sentAmountUsd: number) => {
      setBalances((prev) => deductUsd(prev, sentAmountUsd));
      const delays = [0, 2000, 4000, 6000];
      for (const ms of delays) {
        if (ms) await new Promise((r) => setTimeout(r, ms));
        try {
          await syncBalances();
        } catch {
          /* keep polling */
        }
      }
    },
    [syncBalances]
  );

  useEffect(() => {
    return deferNonCritical(() => {
      void refreshBalances();
    });
  }, [refreshBalances, userAddress]);

  const value = useMemo(
    () => ({
      balances,
      balanceAddress,
      balancesLoading,
      balancesError,
      refreshBalances,
      refreshBalancesAfterSend,
    }),
    [
      balances,
      balanceAddress,
      balancesLoading,
      balancesError,
      refreshBalances,
      refreshBalancesAfterSend,
    ]
  );

  return (
    <AgentApiContext.Provider value={value}>{children}</AgentApiContext.Provider>
  );
}

export function useAgentApi() {
  const ctx = useContext(AgentApiContext);
  if (!ctx) {
    throw new Error("useAgentApi must be used within AgentApiProvider");
  }
  return ctx;
}
