import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Config } from "../config/index.js";
import { userDataDir, usersRegistryPath } from "./paths.js";
import { UserRecord, UserRecordSchema, type UserRecord as User } from "./types.js";

type Registry = {
  users: UserRecord[];
};

function ensureUsersRoot(config: Config): void {
  const dir = userDataDir(config, ".");
  const root = dir.replace(/[/\\]\.$/, "");
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
}

function loadRegistry(config: Config): Registry {
  ensureUsersRoot(config);
  const path = usersRegistryPath(config);
  if (!existsSync(path)) return { users: [] };
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Registry;
    const users = (raw.users ?? [])
      .map((item) => UserRecordSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);
    return { users };
  } catch {
    return { users: [] };
  }
}

function saveRegistry(config: Config, registry: Registry): void {
  ensureUsersRoot(config);
  writeFileSync(usersRegistryPath(config), JSON.stringify(registry, null, 2));
}

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase();
}

function ensureUserDir(config: Config, userId: string): void {
  const dir = userDataDir(config, userId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function findUserByTelegram(
  config: Config,
  telegramUserId: string
): User | undefined {
  return loadRegistry(config).users.find(
    (u) => u.telegramUserId === telegramUserId
  );
}

export function findUserByWallet(
  config: Config,
  walletAddress: string
): User | undefined {
  const wallet = normalizeWallet(walletAddress);
  return loadRegistry(config).users.find(
    (u) => u.walletAddress?.toLowerCase() === wallet
  );
}

export function findUserById(config: Config, userId: string): User | undefined {
  return loadRegistry(config).users.find((u) => u.userId === userId);
}

/** First touch from Telegram — creates a registry row without a wallet yet. */
export function touchTelegramUser(
  config: Config,
  telegramUserId: string
): User {
  const existing = findUserByTelegram(config, telegramUserId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const user: User = {
    userId: randomUUID(),
    telegramUserId,
    createdAt: now,
    updatedAt: now,
  };
  const registry = loadRegistry(config);
  registry.users.push(user);
  saveRegistry(config, registry);
  ensureUserDir(config, user.userId);
  return user;
}

/** Wallet-only signup (web) before Telegram is linked. */
export function touchWalletUser(
  config: Config,
  walletAddress: string
): User {
  const existing = findUserByWallet(config, walletAddress);
  if (existing) return existing;

  const now = new Date().toISOString();
  const user: User = {
    userId: randomUUID(),
    walletAddress: normalizeWallet(walletAddress) as `0x${string}`,
    createdAt: now,
    updatedAt: now,
  };
  const registry = loadRegistry(config);
  registry.users.push(user);
  saveRegistry(config, registry);
  ensureUserDir(config, user.userId);
  return user;
}

export function markAuthStarted(
  config: Config,
  telegramUserId: string
): User {
  const user = touchTelegramUser(config, telegramUserId);
  if (user.authStartedAt) return user;

  const now = new Date().toISOString();
  const updated: User = { ...user, authStartedAt: now, updatedAt: now };
  upsertUser(config, updated);
  return updated;
}

export function linkTelegramWallet(
  config: Config,
  input: { telegramUserId?: string; walletAddress: string }
): User {
  const wallet = normalizeWallet(input.walletAddress);
  const now = new Date().toISOString();
  const registry = loadRegistry(config);

  let byWallet = registry.users.find(
    (u) => u.walletAddress?.toLowerCase() === wallet
  );
  let byTg = input.telegramUserId
    ? registry.users.find((u) => u.telegramUserId === input.telegramUserId)
    : undefined;

  if (byWallet && byTg && byWallet.userId !== byTg.userId) {
    // Merge telegram row into wallet row.
    registry.users = registry.users.filter((u) => u.userId !== byTg!.userId);
    byWallet = {
      ...byWallet,
      telegramUserId: input.telegramUserId ?? byWallet.telegramUserId,
      linkedAt: now,
      updatedAt: now,
    };
    upsertUserInRegistry(registry, byWallet);
    saveRegistry(config, registry);
    ensureUserDir(config, byWallet.userId);
    return byWallet;
  }

  const base =
    byTg ??
    byWallet ??
    (input.telegramUserId
      ? touchTelegramUser(config, input.telegramUserId)
      : touchWalletUser(config, wallet));
  const updated: User = {
    ...base,
    telegramUserId: input.telegramUserId ?? base.telegramUserId,
    walletAddress: wallet as `0x${string}`,
    linkedAt: base.linkedAt ?? now,
    updatedAt: now,
  };
  upsertUser(config, updated);
  ensureUserDir(config, updated.userId);
  return updated;
}

function upsertUserInRegistry(registry: Registry, user: User): void {
  const idx = registry.users.findIndex((u) => u.userId === user.userId);
  if (idx >= 0) registry.users[idx] = user;
  else registry.users.push(user);
}

export function upsertUser(config: Config, user: User): User {
  const registry = loadRegistry(config);
  upsertUserInRegistry(registry, user);
  saveRegistry(config, registry);
  return user;
}
