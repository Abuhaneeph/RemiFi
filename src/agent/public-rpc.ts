import type { Config } from "../config/index.js";
import { buildA2aAgentCard } from "./agent-card.js";

/** Minimal A2A v0.3 JSON-RPC handlers for discovery health probes (8004scan). */
export function handleA2aJsonRpcMethod(
  method: string,
  id: unknown,
  cfg: Config,
  walletAddress?: string | null
): Record<string, unknown> | null {
  if (method === "message/send") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        kind: "message",
        messageId: `msg_${Date.now()}`,
        role: "agent",
        parts: [
          {
            kind: "text",
            text: `${cfg.agentName} is online. Say who to pay and how much — e.g. "Send $50 to Mom".`,
          },
        ],
      },
    };
  }

  if (method === "agent/getExtendedCard") {
    return {
      jsonrpc: "2.0",
      id,
      result: buildA2aAgentCard(cfg, walletAddress),
    };
  }

  if (method === "tasks/get") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Task not found" },
    };
  }

  return null;
}
