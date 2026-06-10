#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/index.js";
import { getAgentAccount } from "../wallet/client.js";
import { buildA2aAgentCard, buildAgentCard } from "../agent/agent-card.js";
import { buildAgentRegistrationFile } from "../agent/registration-file.js";

const REMIFI_WEBSITE = "https://remifi.xyz";
const REMIFI_API = "https://api.remifi.xyz";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const wellKnownDir = join(root, "web/public/.well-known");

function configForPublish(config: ReturnType<typeof loadConfig>) {
  return {
    ...config,
    publicBaseUrl: config.publicBaseUrl ?? REMIFI_WEBSITE,
    publicAgentApiUrl: config.publicAgentApiUrl ?? REMIFI_API,
  };
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${path}`);
}

function main() {
  const config = configForPublish(loadConfig());
  const wallet = config.agentPrivateKey
    ? getAgentAccount(config).address
    : "0xB98cFAC37b8bD7f549789718aC17F8aEE7cE0c37";

  writeJson(join(wellKnownDir, "agent.json"), buildAgentCard(config, wallet));
  writeJson(join(wellKnownDir, "agent-card.json"), buildA2aAgentCard(config));
  writeJson(
    join(wellKnownDir, "agent-registration.json"),
    buildAgentRegistrationFile(config)
  );
}

main();
