import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mergePhoneImports } from "./phone-import.js";
import {
  DEFAULT_CONTACTS,
  StoredContactSchema,
  type PhoneImportEntry,
  type StoredContact,
} from "./types.js";
import { normalizeE164 } from "../escrow/phone.js";

function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function contactsPath(dataDir: string): string {
  return join(dataDir, "contacts.json");
}

function seedDefaults(dataDir: string): StoredContact[] {
  const seeded = DEFAULT_CONTACTS.map((c) => ({
    ...c,
    updatedAt: c.updatedAt ?? new Date().toISOString(),
  }));
  writeFileSync(contactsPath(dataDir), JSON.stringify(seeded, null, 2));
  return seeded;
}

export function loadContacts(dataDir: string): StoredContact[] {
  ensureDataDir(dataDir);
  const path = contactsPath(dataDir);
  if (!existsSync(path)) return seedDefaults(dataDir);
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
    return raw
      .map((item) => StoredContactSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);
  } catch {
    return seedDefaults(dataDir);
  }
}

function saveAll(dataDir: string, contacts: StoredContact[]): StoredContact[] {
  ensureDataDir(dataDir);
  writeFileSync(contactsPath(dataDir), JSON.stringify(contacts, null, 2));
  return contacts;
}

export function upsertContact(
  dataDir: string,
  input: Omit<StoredContact, "updatedAt"> & { updatedAt?: string }
): StoredContact {
  const contacts = loadContacts(dataDir);
  const now = new Date().toISOString();
  const contact: StoredContact = StoredContactSchema.parse({
    ...input,
    updatedAt: input.updatedAt ?? now,
  });

  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) contacts[idx] = contact;
  else contacts.push(contact);

  saveAll(dataDir, contacts);
  return contact;
}

export function syncContacts(
  dataDir: string,
  incoming: StoredContact[]
): StoredContact[] {
  const existing = loadContacts(dataDir);
  const byId = new Map(existing.map((c) => [c.id, c]));

  for (const raw of incoming) {
    const parsed = StoredContactSchema.safeParse({
      ...raw,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    });
    if (!parsed.success) continue;

    const prev = byId.get(parsed.data.id);
    if (!prev || (parsed.data.updatedAt ?? "") >= (prev.updatedAt ?? "")) {
      byId.set(parsed.data.id, parsed.data);
    }
  }

  const merged = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return saveAll(dataDir, merged);
}

export function deleteContact(dataDir: string, id: string): boolean {
  const contacts = loadContacts(dataDir);
  const next = contacts.filter((c) => c.id !== id);
  if (next.length === contacts.length) return false;
  saveAll(dataDir, next);
  return true;
}

/** Case-insensitive name match; prefers exact, then starts-with, then contains. */
export function findContactById(
  dataDir: string,
  id: string
): StoredContact | undefined {
  const lower = id.toLowerCase();
  return loadContacts(dataDir).find((c) => c.id.toLowerCase() === lower);
}

export function findContactByName(
  dataDir: string,
  name: string
): StoredContact | undefined {
  const lower = name.trim().toLowerCase();
  if (!lower) return undefined;

  const contacts = loadContacts(dataDir);
  const exact = contacts.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;

  const starts = contacts.find((c) => c.name.toLowerCase().startsWith(lower));
  if (starts) return starts;

  return contacts.find((c) => lower.includes(c.name.toLowerCase()));
}

/** Match a WhatsApp / SMS sender number to a saved contact. */
export function findContactByPhone(
  dataDir: string,
  phone: string
): StoredContact | undefined {
  let normalized: string;
  try {
    normalized = normalizeE164(phone);
  } catch {
    return undefined;
  }

  const digits = normalized.replace(/\D/g, "");
  const contacts = loadContacts(dataDir);

  return contacts.find((c) => {
    if (!c.phone) return false;
    try {
      const contactDigits = normalizeE164(c.phone).replace(/\D/g, "");
      return contactDigits === digits;
    } catch {
      return false;
    }
  });
}

/** Bulk import from the device address book (web Contact Picker → agent store). */
export function importPhoneContacts(
  dataDir: string,
  entries: PhoneImportEntry[]
): StoredContact[] {
  const merged = mergePhoneImports(loadContacts(dataDir), entries);
  return saveAll(dataDir, merged);
}
