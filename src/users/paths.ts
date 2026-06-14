import { join } from "node:path";
import type { Config } from "../config/index.js";

/** Per-user data directory under DATA_DIR/users/{userId}. */
export function userDataDir(config: Config, userId: string): string {
  return join(config.dataDir, "users", userId);
}

export function usersRegistryPath(config: Config): string {
  return join(config.dataDir, "users", "registry.json");
}

export function pendingQuotesPath(config: Config): string {
  return join(config.dataDir, "pending-quotes.json");
}
