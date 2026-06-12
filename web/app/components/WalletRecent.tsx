"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { TokenIcon } from "./TokenIcon";
import { useContacts } from "../context/ContactsContext";
import { useWallet } from "../context/WalletContext";
import {
  explorerTxUrl,
  fetchHistory,
  formatTxDate,
  type HistoryItem,
} from "../lib/api";
import { WALLET_ASSETS } from "../data/people";

function tokenLogo(currency: string): string {
  const sym = currency.length <= 3 ? `${currency}m` : currency;
  const asset = WALLET_ASSETS.find(
    (a) => a.symbol === sym || a.code === currency
  );
  return asset?.logo ?? "/tokens/usdm.png";
}

export function WalletRecent() {
  const { allPeople } = useContacts();
  const { address } = useWallet();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items: rows } = await fetchHistory(address);
        if (!cancelled) {
          setItems(rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : "Could not load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) {
    return (
      <section className="mt-7">
        <h2 className="text-[1.05rem] text-ink">Recent</h2>
        <p className="mt-3 text-sm text-muted">Loading from agent…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-7">
        <h2 className="text-[1.05rem] text-ink">Recent</h2>
        <p className="mt-3 text-sm text-muted">
          {error}. Start the agent with <code className="text-brand-600">npm run serve</code>.
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mt-7">
        <h2 className="text-[1.05rem] text-ink">Recent</h2>
        <p className="mt-3 text-sm text-muted">No transfers yet. Try AI Pay.</p>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <h2 className="text-[1.05rem] text-ink">Recent</h2>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((tx) => {
          const name = tx.recipientName ?? tx.destinationCountry;
          const person = allPeople.find(
            (p) => p.name.toLowerCase() === (tx.recipientName ?? "").toLowerCase()
          );
          const currency = `${tx.sourceCurrency}m`;
          const href = tx.recipientName
            ? `/pay?to=${encodeURIComponent(tx.recipientName)}&amount=${tx.amount}`
            : "/pay";

          return (
            <Link key={tx.id} href={href} className="tx-row">
              {person ? (
                <Avatar name={person.name} src={person.avatar} size={40} />
              ) : (
                <div className="tx-icon">↑</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Sent to {name}</p>
                <p className="text-xs text-muted">{formatTxDate(tx.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <p className="tnum font-bold text-ink">
                    -{tx.amount} {currency}
                  </p>
                  <p
                    className={`text-xs font-semibold capitalize ${
                      tx.status === "confirmed"
                        ? "text-accent-600"
                        : "text-brand-500"
                    }`}
                  >
                    {tx.status}
                  </p>
                  {tx.txHash && (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(explorerTxUrl(tx.txHash!), "_blank");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(explorerTxUrl(tx.txHash!), "_blank");
                        }
                      }}
                      className="text-[0.65rem] font-semibold text-brand-600 underline"
                    >
                      Explorer ↗
                    </span>
                  )}
                </div>
                <TokenIcon src={tokenLogo(currency)} alt={currency} size={28} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
