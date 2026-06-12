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
import { transferContextFromBody } from "./api/transfer-context.js";
import {
  handleTelegramConfirm,
  handleTransferConfirm,
  handleTransferPrepare,
  handleUserAuthStarted,
  handleUserLink,
  handleUserStatus,
} from "./api/user-routes.js";
import { StoredContactSchema } from "./contacts/types.js";
import { buildA2aAgentCard, buildAgentCard } from "./agent/agent-card.js";
import {
  buildApiIndex,
  buildCustomServiceProbe,
  buildMcpManifest,
  buildMcpResourceDescriptor,
  MCP_PROTOCOL_VERSION,
  mcpResourceForPath,
  mcpTransportUrl,
  REMIFI_MCP_PROMPTS,
  REMIFI_MCP_RESOURCES,
  REMIFI_MCP_TOOLS,
  mcpResourceUri,
  type McpResourceName,
} from "./agent/mcp-manifest.js";
import { buildAgentRegistrationFile } from "./agent/registration-file.js";
import { handleA2aJsonRpcMethod } from "./agent/public-rpc.js";
import { agentRegistryId } from "./agent/registry-addresses.js";
import {
  applySettleHeaders,
  buildPaymentRequirements,
  settleX402Payment,
  x402ResourceUrl,
  isX402Ready,
} from "./x402/handler.js";

const config = loadConfig();

function setCors(res: ServerResponse, origin: string) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, X-PAYMENT, PAYMENT-SIGNATURE"
  );
}

/** GET or HEAD — 8004scan probes use HEAD on service endpoints. */
function isReadMethod(method: string | undefined): boolean {
  return method === "GET" || method === "HEAD";
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  method?: string
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  if (method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
}

async function readBody(
  req: IncomingMessage,
  timeoutMs = 8000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(
      () => reject(new Error("Request body timeout")),
      timeoutMs
    );
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function wantsEventStream(req: IncomingMessage): boolean {
  return (req.headers.accept ?? "").includes("text/event-stream");
}

/** Streamable HTTP: first SSE event for MCP clients and health probes. */
function sendMcpSseEndpoint(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.end(
    `event: endpoint\ndata: ${JSON.stringify({ version: MCP_PROTOCOL_VERSION })}\n\n`
  );
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

  if (method === "prompts/list") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        prompts: REMIFI_MCP_PROMPTS.map((name) => ({
          name,
          description: `Remifi ${name.replace(/_/g, " ")} prompt`,
        })),
      },
    });
  }

  if (method === "resources/list") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        resources: REMIFI_MCP_RESOURCES.map((name: McpResourceName) => ({
          name,
          uri: mcpResourceUri(cfg, name),
          description: `Remifi ${name.replace(/_/g, " ")}`,
        })),
      },
    });
  }

  if (method === "ping") {
    return sendJson(res, 200, { jsonrpc: "2.0", id, result: {} });
  }

  const a2a = handleA2aJsonRpcMethod(
    method,
    id,
    cfg,
    getAgentAddress(cfg)
  );
  if (a2a) {
    return sendJson(res, 200, a2a);
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

/**
 * 8004scan health checks: HEAD/GET without x-api-key on service URLs.
 * Returns descriptor JSON (or empty body for HEAD) — not live execution.
 */
function handle8004Probe(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  url: URL,
  cfg: Config
): boolean {
  if (req.headers["x-api-key"]) return false;

  if (
    isReadMethod(req.method) &&
    (path === "/mcp" || path === "/api/mcp" || path === "/a2a")
  ) {
    if (wantsEventStream(req)) {
      sendMcpSseEndpoint(res);
      return true;
    }
    sendJson(
      res,
      200,
      {
        status: "ok",
        transport: "streamable-http",
        protocolVersion: MCP_PROTOCOL_VERSION,
        endpoint: mcpTransportUrl(cfg),
      },
      req.method
    );
    return true;
  }

  if (isReadMethod(req.method) && path === "/ping") {
    sendJson(res, 200, { status: "ok", service: "remifi-api" }, req.method);
    return true;
  }

  // 8004scan probes auth-gated custom services with HEAD (no API key).
  if (req.method !== "HEAD") return false;

  const claimId = url.searchParams.get("claimId") ?? url.searchParams.get("c");
  if (path === "/api/claim" && claimId && /^0x[a-fA-F0-9]{64}$/.test(claimId)) {
    return false;
  }

  const resource = mcpResourceForPath(path);
  if (resource) {
    sendJson(
      res,
      200,
      buildMcpResourceDescriptor(cfg, resource),
      req.method
    );
    return true;
  }

  if (path === "/api/x402/premium-quote") {
    sendJson(
      res,
      200,
      buildCustomServiceProbe(cfg, "premium-quote", path, "POST"),
      req.method
    );
    return true;
  }

  return false;
}

const server = createServer(async (req, res) => {
  setCors(res, config.webOrigin);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (isReadMethod(req.method) && path === "/") {
      res.setHeader("Accept-Payment", "x402");
      return sendJson(
        res,
        200,
        buildApiIndex(config, getAgentAddress(config)),
        req.method
      );
    }

    if (isReadMethod(req.method) && path === "/api/health") {
      const executionReady = Boolean(config.agentPrivateKey);
      return sendJson(res, 200, {
        status: executionReady ? "healthy" : "degraded",
        ok: true,
        service: "remifi-api",
        version: "1.0.0",
        chainId: config.celoChainId,
        agentId: config.agentId ?? null,
        executionReady,
        x402Ready: isX402Ready(config),
        x402Enabled: config.x402Enabled,
        vaultConfigured: Boolean(config.remifiVaultAddress),
        contactsCount: listContacts(config).length,
        timestamp: new Date().toISOString(),
      }, req.method);
    }

    if (isReadMethod(req.method) && path === "/api/agent") {
      return sendJson(res, 200, {
        address: getAgentAddress(config),
        chainId: config.celoChainId,
        agentId: config.agentId ?? null,
        agentRegistry: agentRegistryId(config),
        registered: config.agentId != null,
      }, req.method);
    }

    if (isReadMethod(req.method) && path === "/.well-known/mcp.json") {
      return sendJson(res, 200, buildMcpManifest(config), req.method);
    }

    if (
      isReadMethod(req.method) &&
      path === "/.well-known/agent-registration.json"
    ) {
      return sendJson(res, 200, buildAgentRegistrationFile(config), req.method);
    }

    if (handle8004Probe(req, res, path, url, config)) {
      return;
    }

    if (
      req.method === "POST" &&
      (path === "/" ||
        path === "/mcp" ||
        path === "/api/mcp" ||
        path === "/a2a" ||
        path === "/.well-known/mcp.json")
    ) {
      try {
        return await handleMcpJsonRpc(req, res, config);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : "JSON-RPC handler error";
        return sendJson(res, 400, { error: messageText });
      }
    }

    if (isReadMethod(req.method) && path === "/api/claim") {
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
      }, req.method);
    }

    // ── Public ERC-8004 registration file (Celo docs + EIP-8004) ──
    if (isReadMethod(req.method) && path === "/.well-known/agent.json") {
      return sendJson(
        res,
        200,
        buildAgentCard(config, getAgentAddress(config)),
        req.method
      );
    }

    if (isReadMethod(req.method) && path === "/.well-known/agent-card.json") {
      return sendJson(
        res,
        200,
        buildA2aAgentCard(config, getAgentAddress(config)),
        req.method
      );
    }

    // ── x402: payment requirements for the premium quote endpoint ──
    if (isReadMethod(req.method) && path === "/api/x402/info") {
      const resourceUrl = x402ResourceUrl(config, "/api/x402/premium-quote");
      res.setHeader("Accept-Payment", "x402");
      return sendJson(
        res,
        200,
        buildPaymentRequirements(config, resourceUrl),
        req.method
      );
    }

    // ── x402-gated premium quote (402 → pay → retry with X-PAYMENT) ──
    if (
      (req.method === "GET" || req.method === "POST") &&
      path === "/api/x402/premium-quote"
    ) {
      const resourceUrl = x402ResourceUrl(config, "/api/x402/premium-quote");
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

    if (!authorized(req, config)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    if (req.method === "GET" && path === "/api/user/status") {
      const telegramUserId = url.searchParams.get("telegramUserId")?.trim();
      if (!telegramUserId) {
        return sendJson(res, 400, { error: "telegramUserId is required" });
      }
      return sendJson(res, 200, await handleUserStatus(config, telegramUserId));
    }

    if (req.method === "POST" && path === "/api/user/auth-started") {
      const body = await readBody(req);
      const telegramUserId = String(body.telegramUserId ?? "").trim();
      if (!telegramUserId) {
        return sendJson(res, 400, { error: "telegramUserId is required" });
      }
      return sendJson(res, 200, await handleUserAuthStarted(config, telegramUserId));
    }

    if (req.method === "POST" && path === "/api/user/link") {
      const body = await readBody(req);
      try {
        return sendJson(res, 200, await handleUserLink(config, {
          telegramUserId: body.telegramUserId
            ? String(body.telegramUserId)
            : undefined,
          walletAddress: String(body.walletAddress ?? ""),
        }));
      } catch (err) {
        const messageText = err instanceof Error ? err.message : "Link failed";
        return sendJson(res, 400, { error: messageText });
      }
    }

    if (req.method === "POST" && path === "/api/intent") {
      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message) return sendJson(res, 400, { error: "message is required" });
      const result = await quoteForMessage(config, message, transferContextFromBody(body));
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && path === "/api/transfer/prepare") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
      try {
        const result = await handleTransferPrepare(config, body, ctx);
        return sendJson(res, 200, result);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : "Prepare failed";
        return sendJson(res, 400, { error: messageText });
      }
    }

    if (req.method === "POST" && path === "/api/transfer/confirm") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
      try {
        const result = await handleTransferConfirm(config, body, ctx);
        return sendJson(res, 200, result);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : "Confirm failed";
        return sendJson(res, 400, { error: messageText });
      }
    }

    if (req.method === "POST" && path === "/api/transfer/telegram-confirm") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
      try {
        const result = await handleTelegramConfirm(config, body, ctx);
        return sendJson(res, 200, result);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : "Confirm link failed";
        return sendJson(res, 400, { error: messageText });
      }
    }

    if (req.method === "POST" && path === "/api/transfer") {
      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message) return sendJson(res, 400, { error: "message is required" });
      const ctx = transferContextFromBody(body);
      if (ctx?.senderWallet) {
        return sendJson(res, 400, {
          error:
            "User-wallet sends use POST /api/transfer/prepare then /api/transfer/confirm.",
        });
      }
      const result = await executeForMessage(config, message, ctx);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && path === "/api/profile") {
      return sendJson(res, 200, getProfileInfo(config));
    }

    if (req.method === "GET" && path === "/api/contacts") {
      const name = url.searchParams.get("name");
      const ctx = transferContextFromBody({
        telegramUserId: url.searchParams.get("telegramUserId"),
        senderWallet: url.searchParams.get("senderWallet"),
        userId: url.searchParams.get("userId"),
      });
      if (name) {
        const contact = getContactByName(config, name, ctx);
        if (!contact) return sendJson(res, 404, { error: "Contact not found" });
        return sendJson(res, 200, { contact });
      }
      return sendJson(res, 200, { contacts: listContacts(config, ctx) });
    }

    if (req.method === "POST" && path === "/api/contacts/sync") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
      const raw = Array.isArray(body.contacts) ? body.contacts : [];
      const contacts = raw
        .map((item) => StoredContactSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data);
      return sendJson(res, 200, {
        contacts: bulkSyncContacts(config, contacts, ctx),
      });
    }

    if (req.method === "POST" && path === "/api/contacts/import-phone") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
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
        contacts: importContactsFromPhone(config, entries, ctx),
      });
    }

    if (req.method === "POST" && path === "/api/contacts") {
      const body = await readBody(req);
      const ctx = transferContextFromBody(body);
      const parsed = StoredContactSchema.safeParse(body);
      if (!parsed.success) {
        return sendJson(res, 400, { error: "Invalid contact payload" });
      }
      return sendJson(res, 200, {
        contact: saveContact(config, parsed.data, ctx),
      });
    }

    if (req.method === "DELETE" && path.startsWith("/api/contacts/")) {
      const id = decodeURIComponent(path.slice("/api/contacts/".length));
      if (!id) return sendJson(res, 400, { error: "contact id required" });
      const ctx = transferContextFromBody({
        telegramUserId: url.searchParams.get("telegramUserId"),
        senderWallet: url.searchParams.get("senderWallet"),
        userId: url.searchParams.get("userId"),
      });
      const removed = removeContact(config, id, ctx);
      if (!removed) return sendJson(res, 404, { error: "Contact not found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && path === "/api/history") {
      const ctx = transferContextFromBody({
        telegramUserId: url.searchParams.get("telegramUserId"),
        senderWallet: url.searchParams.get("senderWallet"),
        userId: url.searchParams.get("userId"),
      });
      return sendJson(res, 200, { items: getHistory(config, ctx) });
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
