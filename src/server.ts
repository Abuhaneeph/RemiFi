import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig, type Config } from "./config/index.js";
import {
  bulkSyncContacts,
  executeForMessage,
  getAgentAddress,
  getBalances,
  getClaimInfo,
  getContactByName,
  getHistory,
  getProfileInfo,
  getSchedules,
  importContactsFromPhone,
  listContacts,
  quoteForMessage,
  removeContact,
  removeSchedule,
  saveContact,
  toggleSchedule,
} from "./api/service.js";
import { StoredContactSchema } from "./contacts/types.js";
import { buildA2aAgentCard, buildAgentCard } from "./agent/agent-card.js";
import {
  buildApiIndex,
  buildMcpManifest,
  buildMcpResourceDescriptor,
  mcpResourceForPath,
  REMIFI_MCP_TOOLS,
} from "./agent/mcp-manifest.js";
import { buildAgentRegistrationFile } from "./agent/registration-file.js";
import { agentRegistryId } from "./agent/registry-addresses.js";
import {
  applySettleHeaders,
  buildPaymentRequirements,
  settleX402Payment,
} from "./x402/handler.js";

const config = loadConfig();

function setCors(res: ServerResponse, origin: string) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, X-PAYMENT, PAYMENT-SIGNATURE"
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function transferContext(body: Record<string, unknown>) {
  const ctx: {
    destinationCountry?: string;
    recipientWallet?: string;
    recipientPhone?: string;
    senderPhone?: string;
  } = {};
  if (body.destinationCountry) {
    ctx.destinationCountry = String(body.destinationCountry).toUpperCase();
  }
  if (body.recipientWallet && /^0x[a-fA-F0-9]{40}$/.test(String(body.recipientWallet))) {
    ctx.recipientWallet = String(body.recipientWallet);
  }
  if (body.recipientPhone) ctx.recipientPhone = String(body.recipientPhone);
  if (body.senderPhone) ctx.senderPhone = String(body.senderPhone);
  return Object.keys(ctx).length ? ctx : undefined;
}

/** Public MCP JSON-RPC for 8004scan health probes (no API key). */
async function handleMcpJsonRpc(
  req: IncomingMessage,
  res: ServerResponse,
  cfg: Config
) {
  const body = await readBody(req);
  const method = typeof body.method === "string" ? body.method : "";
  const id = body.id ?? 0;

  if (method === "initialize") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, prompts: {}, resources: {} },
        serverInfo: { name: cfg.agentName, version: "1.0.0" },
      },
    });
  }

  if (method === "tools/list") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        tools: REMIFI_MCP_TOOLS.map((name) => ({
          name,
          description: `Remifi ${name.replace(/_/g, " ")}`,
          inputSchema: { type: "object", properties: {} },
        })),
      },
    });
  }

  if (method === "resources/list") {
    const manifest = buildMcpManifest(cfg);
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        resources: manifest.resources.map((resource) => ({
          ...resource,
          description: `Remifi ${resource.name.replace(/_/g, " ")}`,
        })),
      },
    });
  }

  if (method === "ping") {
    return sendJson(res, 200, { jsonrpc: "2.0", id, result: {} });
  }

  return sendJson(res, 200, {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

/** Optional shared-secret check (skipped if AGENT_API_KEY is unset). */
function authorized(req: IncomingMessage, cfg: Config): boolean {
  if (!cfg.agentApiKey) return true;
  return req.headers["x-api-key"] === cfg.agentApiKey;
}

const server = createServer(async (req, res) => {
  setCors(res, config.webOrigin);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/") {
      res.setHeader("Accept-Payment", "x402");
      return sendJson(res, 200, buildApiIndex(config, getAgentAddress(config)));
    }

    if (req.method === "GET" && path === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        chainId: config.celoChainId,
        executionReady: Boolean(config.agentPrivateKey),
        vaultConfigured: Boolean(config.remifiVaultAddress),
        contactsCount: listContacts(config).length,
      });
    }

    if (req.method === "GET" && path === "/api/agent") {
      return sendJson(res, 200, {
        address: getAgentAddress(config),
        chainId: config.celoChainId,
        agentId: config.agentId ?? null,
        agentRegistry: agentRegistryId(config),
        registered: config.agentId != null,
      });
    }

    if (req.method === "GET" && path === "/.well-known/mcp.json") {
      return sendJson(res, 200, buildMcpManifest(config));
    }

    if (
      req.method === "GET" &&
      path === "/.well-known/agent-registration.json"
    ) {
      return sendJson(res, 200, buildAgentRegistrationFile(config));
    }

    if (
      req.method === "POST" &&
      (path === "/" || path === "/mcp" || path === "/api/mcp")
    ) {
      return handleMcpJsonRpc(req, res, config);
    }

    if (req.method === "GET" && path === "/api/claim") {
      const claimId = url.searchParams.get("claimId") ?? url.searchParams.get("c");
      if (!claimId || !/^0x[a-fA-F0-9]{64}$/.test(claimId)) {
        return sendJson(res, 400, { error: "valid ?claimId=0x… is required" });
      }
      const escrow = await getClaimInfo(config, claimId);
      if (!escrow) {
        return sendJson(res, 404, { error: "Claim not found" });
      }
      return sendJson(res, 200, {
        claimId,
        vaultAddress: config.remifiVaultAddress ?? null,
        ...escrow,
      });
    }

    // ── Public ERC-8004 registration file (Celo docs + EIP-8004) ──
    if (req.method === "GET" && path === "/.well-known/agent.json") {
      return sendJson(
        res,
        200,
        buildAgentCard(config, getAgentAddress(config))
      );
    }

    if (req.method === "GET" && path === "/.well-known/agent-card.json") {
      return sendJson(res, 200, buildA2aAgentCard(config));
    }

    // ── x402: payment requirements for the premium quote endpoint ──
    if (req.method === "GET" && path === "/api/x402/info") {
      const resourceUrl = `${url.origin}/api/x402/premium-quote`;
      res.setHeader("Accept-Payment", "x402");
      return sendJson(res, 200, buildPaymentRequirements(config, resourceUrl));
    }

    // ── x402-gated premium quote (402 → pay → retry with X-PAYMENT) ──
    if (
      (req.method === "GET" || req.method === "POST") &&
      path === "/api/x402/premium-quote"
    ) {
      const resourceUrl = `${url.origin}/api/x402/premium-quote`;
      const settled = await settleX402Payment(
        config,
        req,
        resourceUrl,
        req.method as "GET" | "POST"
      );

      if (!settled.ok) {
        applySettleHeaders(res, settled.responseHeaders);
        res.setHeader("Accept-Payment", "x402");
        return sendJson(res, settled.status, settled.responseBody);
      }

      if (req.method === "GET") {
        return sendJson(res, 200, {
          paid: true,
          message: "x402 payment accepted — POST a remittance message to quote",
        });
      }

      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message) return sendJson(res, 400, { error: "message is required" });
      const quote = await quoteForMessage(config, message);
      return sendJson(res, 200, { paid: true, quote });
    }

    // Public MCP resource descriptors (8004scan probes only — never for x-api-key clients)
    if (req.method === "GET" && !req.headers["x-api-key"]) {
      const resource = mcpResourceForPath(path);
      const hasClaimId =
        url.searchParams.get("claimId") ?? url.searchParams.get("c");
      const hasBalanceAddress = url.searchParams.get("address");
      if (
        resource &&
        path !== "/api/health" &&
        path !== "/api/agent" &&
        path !== "/api/x402/info" &&
        !(path === "/api/claim" && hasClaimId) &&
        !(path === "/api/balance" && hasBalanceAddress)
      ) {
        return sendJson(res, 200, buildMcpResourceDescriptor(config, resource));
      }
    }

    if (!authorized(req, config)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    if (req.method === "POST" && path === "/api/intent") {
      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message) return sendJson(res, 400, { error: "message is required" });
      const result = await quoteForMessage(config, message, transferContext(body));
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && path === "/api/transfer") {
      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message) return sendJson(res, 400, { error: "message is required" });
      const result = await executeForMessage(config, message, transferContext(body));
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && path === "/api/profile") {
      return sendJson(res, 200, getProfileInfo(config));
    }

    if (req.method === "GET" && path === "/api/contacts") {
      const name = url.searchParams.get("name");
      if (name) {
        const contact = getContactByName(config, name);
        if (!contact) return sendJson(res, 404, { error: "Contact not found" });
        return sendJson(res, 200, { contact });
      }
      return sendJson(res, 200, { contacts: listContacts(config) });
    }

    if (req.method === "POST" && path === "/api/contacts/sync") {
      const body = await readBody(req);
      const raw = Array.isArray(body.contacts) ? body.contacts : [];
      const contacts = raw
        .map((item) => StoredContactSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data);
      return sendJson(res, 200, {
        contacts: bulkSyncContacts(config, contacts),
      });
    }

    if (req.method === "POST" && path === "/api/contacts/import-phone") {
      const body = await readBody(req);
      const raw = Array.isArray(body.contacts) ? body.contacts : [];
      const entries = raw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const name = String(row.name ?? "").trim();
          const phone = String(row.phone ?? "").trim();
          if (!name || !phone) return null;
          return { name, phone };
        })
        .filter((e): e is { name: string; phone: string } => e !== null);

      if (!entries.length) {
        return sendJson(res, 400, { error: "contacts array with name+phone required" });
      }

      return sendJson(res, 200, {
        imported: entries.length,
        contacts: importContactsFromPhone(config, entries),
      });
    }

    if (req.method === "POST" && path === "/api/contacts") {
      const body = await readBody(req);
      const parsed = StoredContactSchema.safeParse(body);
      if (!parsed.success) {
        return sendJson(res, 400, { error: "Invalid contact payload" });
      }
      return sendJson(res, 200, { contact: saveContact(config, parsed.data) });
    }

    if (req.method === "DELETE" && path.startsWith("/api/contacts/")) {
      const id = decodeURIComponent(path.slice("/api/contacts/".length));
      if (!id) return sendJson(res, 400, { error: "contact id required" });
      const removed = removeContact(config, id);
      if (!removed) return sendJson(res, 404, { error: "Contact not found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && path === "/api/history") {
      return sendJson(res, 200, { items: getHistory(config) });
    }

    if (req.method === "GET" && path === "/api/schedules") {
      return sendJson(res, 200, { schedules: getSchedules(config) });
    }

    if (req.method === "DELETE" && path.startsWith("/api/schedules/")) {
      const id = decodeURIComponent(path.slice("/api/schedules/".length));
      if (!id) return sendJson(res, 400, { error: "schedule id required" });
      const removed = removeSchedule(config, id);
      if (!removed) return sendJson(res, 404, { error: "Schedule not found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "PATCH" && path.startsWith("/api/schedules/")) {
      const id = decodeURIComponent(path.slice("/api/schedules/".length));
      if (!id) return sendJson(res, 400, { error: "schedule id required" });
      const body = await readBody(req);
      const active = Boolean(body.active);
      const updated = toggleSchedule(config, id, active);
      if (!updated) return sendJson(res, 404, { error: "Schedule not found" });
      return sendJson(res, 200, { schedule: updated });
    }

    if (req.method === "GET" && path === "/api/balance") {
      const address = url.searchParams.get("address");
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return sendJson(res, 400, { error: "valid ?address=0x… is required" });
      }
      const items = await getBalances(config, address);
      return sendJson(res, 200, { address, items });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "Internal error";
    return sendJson(res, 500, { error: messageText });
  }
});

server.listen(config.agentApiPort, "0.0.0.0", () => {
  console.log(
    `Remifi agent API listening on 0.0.0.0:${config.agentApiPort} (chainId ${config.celoChainId})`
  );
  if (!config.agentPrivateKey) {
    console.log(
      "⚠️  AGENT_PRIVATE_KEY not set — /api/transfer will fail until you add it."
    );
  }
});
