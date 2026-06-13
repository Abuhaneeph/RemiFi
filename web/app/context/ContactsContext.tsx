"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FAVOURITES, PEOPLE, toyAvatar, type Person } from "../data/people";
import {
  fetchContacts,
  importPhoneContacts,
  syncContacts,
  type StoredContact,
} from "../lib/api";
import { deferNonCritical } from "../lib/defer";
import { pickPhoneContacts } from "../lib/phone-contacts";
import { useWallet } from "./WalletContext";

const STORAGE_KEY = "remitclaw-added-contacts";
const PHONE_IMPORT_KEY = "remitclaw-phone-import-done";

type AddPersonInput = {
  name: string;
  country?: string;
  phone?: string;
  walletAddress?: string;
  favourite?: boolean;
};

type ContactsContextValue = {
  allPeople: Person[];
  favourites: Person[];
  addPerson: (input: AddPersonInput) => Person;
  findPerson: (name: string) => Person | undefined;
  importFromPhone: () => Promise<number>;
  syncing: boolean;
  agentContactCount: number;
};

const ContactsContext = createContext<ContactsContextValue | null>(null);

function loadAdded(): Person[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Person[]) : [];
  } catch {
    return [];
  }
}

function personToStored(person: Person): StoredContact {
  return {
    id: person.id,
    name: person.name,
    country: person.country,
    phone: person.phone,
    walletAddress: person.walletAddress,
    favourite: person.favourite,
    source: person.source ?? "manual",
    updatedAt: new Date().toISOString(),
  };
}

function storedToPerson(contact: StoredContact): Person {
  return {
    id: contact.id,
    name: contact.name,
    avatar: toyAvatar(contact.name),
    country: contact.country,
    phone: contact.phone,
    walletAddress: contact.walletAddress,
    favourite: contact.favourite,
    source: contact.source,
  };
}

function mergePeople(local: Person[], remote: StoredContact[] | undefined): Person[] {
  const agentContacts = Array.isArray(remote) ? remote : [];
  const byId = new Map<string, Person>();

  for (const p of [...PEOPLE, ...local]) {
    byId.set(p.id, p);
  }

  for (const contact of agentContacts) {
    const existing = byId.get(contact.id);
    if (!existing) {
      byId.set(contact.id, storedToPerson(contact));
      continue;
    }
    byId.set(contact.id, {
      ...existing,
      name: contact.name || existing.name,
      country: contact.country ?? existing.country,
      phone: contact.phone ?? existing.phone,
      walletAddress: contact.walletAddress ?? existing.walletAddress,
      favourite: contact.favourite ?? existing.favourite,
      source: contact.source ?? existing.source,
    });
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [added, setAdded] = useState<Person[]>([]);
  const [remote, setRemote] = useState<StoredContact[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAdded(loadAdded());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(added));
  }, [added, ready]);

  /** Push manually added contacts to the agent (phone imports use a separate endpoint). */
  const pushManualToAgent = useCallback(
    async (manual: Person[]) => {
      if (!manual.length) return;
      setSyncing(true);
      try {
        const { contacts } = await syncContacts(
          manual.map(personToStored),
          address
        );
        setRemote(Array.isArray(contacts) ? contacts : []);
      } catch {
        // Agent API may be offline during local dev.
      } finally {
        setSyncing(false);
      }
    },
    [address]
  );

  useEffect(() => {
    if (!ready) return;

    return deferNonCritical(() => {
      void (async () => {
        try {
          const { contacts } = await fetchContacts(address);
          setRemote(Array.isArray(contacts) ? contacts : []);
        } catch {
          // Fall back to local-only contacts.
        }
      })();
    });
  }, [ready, address]);

  const allPeople = useMemo(() => mergePeople(added, remote), [added, remote]);

  const favourites = useMemo(() => {
    const ids = new Set(FAVOURITES.map((p) => p.id));
    const favs = allPeople.filter((p) => p.favourite);
    return [...FAVOURITES, ...favs.filter((p) => !ids.has(p.id))];
  }, [allPeople]);

  useEffect(() => {
    if (!ready) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void pushManualToAgent(added);
    }, 600);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [added, ready, pushManualToAgent]);

  const importFromPhone = useCallback(async (): Promise<number> => {
    const picked = await pickPhoneContacts();
    if (!picked.length) return 0;

    setSyncing(true);
    try {
      const entries = picked
        .filter((c): c is { name: string; phone: string } => Boolean(c.phone))
        .map((c) => ({ name: c.name, phone: c.phone! }));

      const { contacts, imported } = await importPhoneContacts(
        entries,
        address
      );
      setRemote(Array.isArray(contacts) ? contacts : []);
      localStorage.setItem(PHONE_IMPORT_KEY, "1");
      return imported;
    } catch {
      return 0;
    } finally {
      setSyncing(false);
    }
  }, [address]);

  const addPerson = useCallback((input: AddPersonInput) => {
    const name = input.name.trim();
    const person: Person = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name,
      avatar: toyAvatar(name),
      country: input.country,
      phone: input.phone,
      walletAddress: input.walletAddress,
      favourite: input.favourite,
      source: "manual",
    };
    setAdded((prev) => [...prev, person]);
    return person;
  }, []);

  const findPerson = useCallback(
    (name: string) => {
      const lower = name.trim().toLowerCase();
      const exact = allPeople.find((p) => p.name.toLowerCase() === lower);
      if (exact) return exact;
      return allPeople.find((p) => p.name.toLowerCase().startsWith(lower));
    },
    [allPeople]
  );

  const value = useMemo(
    () => ({
      allPeople,
      favourites,
      addPerson,
      findPerson,
      importFromPhone,
      syncing,
      agentContactCount: remote.length,
    }),
    [
      allPeople,
      favourites,
      addPerson,
      findPerson,
      importFromPhone,
      syncing,
      remote.length,
    ]
  );

  return (
    <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) {
    throw new Error("useContacts must be used within ContactsProvider");
  }
  return ctx;
}
