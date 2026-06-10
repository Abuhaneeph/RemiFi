import type { Config } from "../config/index.js";
import { agentRegistryId } from "./registry-addresses.js";

/** ERC-8004 domain verification file (api.remifi.xyz /.well-known/agent-registration.json). */
export function buildAgentRegistrationFile(config: Config) {
  const registrations: { agentId: number; agentRegistry: string }[] = [];
  if (config.agentId != null) {
    registrations.push({
      agentId: config.agentId,
      agentRegistry: agentRegistryId(config),
    });
  }
  return { registrations };
}
