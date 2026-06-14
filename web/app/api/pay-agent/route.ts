import { type NextRequest, NextResponse } from "next/server";
import { formatAgentReply } from "../../lib/format-agent-reply";
import { extractRecipientName, matchContact } from "../../lib/contacts";
import type { Person } from "../../data/people";

type ChatTurn = { role: "user" | "assistant"; content: string };

type StoredContact = {
  name: string;
  country?: string;
  walletAddress?: string;
  phone?: string;
};

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL?.trim().replace(/\/$/, "");
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
const MODELS = ["openclaw/remifi", "openclaw/default", "openclaw"];
const AGENT_API = (
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8787"
).replace(/\/$/, "");
const AGENT_KEY =
  process.env.NEXT_PUBLIC_AGENT_API_KEY?.trim() ||
  process.env.AGENT_API_KEY?.trim();

const PLAIN_TEXT_BASE = [
  "You are Remifi, a professional remittance assistant on Celo.",
  "Reply in plain text only: no markdown, no # headers, no blockquotes, no bullet lists, no **bold**, no emojis.",
  "Keep answers concise and professional.",
  "For quotes and sends, use the remifi skill and agent API — never invent rates or transaction hashes.",
].join(" ");

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

async function gatewayHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function fetchWalletContacts(
  senderWallet: string
): Promise<StoredContact[]> {
  if (!WALLET_RE.test(senderWallet)) return [];
  try {
    const url = `${AGENT_API}/api/contacts?senderWallet=${encodeURIComponent(senderWallet)}`;
    const res = await fetch(url, {
      headers: {
        ...(AGENT_KEY ? { "x-api-key": AGENT_KEY } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { contacts?: StoredContact[] };
    return Array.isArray(data.contacts) ? data.contacts : [];
  } catch {
    return [];
  }
}

function toPeople(contacts: StoredContact[]): Person[] {
  return contacts.map((c) => ({
    id: c.name.toLowerCase().replace(/\s+/g, "-"),
    name: c.name,
    avatar: "",
    country: c.country,
    phone: c.phone,
    walletAddress: c.walletAddress,
  }));
}

function formatContactLine(contact: StoredContact): string {
  const parts = [contact.name];
  if (contact.country) parts.push(contact.country);
  if (contact.walletAddress) parts.push(`wallet ${contact.walletAddress}`);
  else if (contact.phone) parts.push(`phone ${contact.phone}`);
  return parts.join(" · ");
}

function latestUserMessage(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "user") return history[i].content.trim();
  }
  return "";
}

function buildSystemPrompt(
  senderWallet: string | undefined,
  contacts: StoredContact[],
  lastUserMessage: string
): string {
  const lines = [PLAIN_TEXT_BASE];

  if (!senderWallet || !WALLET_RE.test(senderWallet)) {
    return lines.join("\n");
  }

  const scopeFlag = `--sender-wallet ${senderWallet}`;
  lines.push(
    "",
    `Session user wallet: ${senderWallet}`,
    `Scope every remifi-api call for this user with: ${scopeFlag}`
  );

  if (contacts.length) {
    lines.push(
      "",
      "This user's contacts (live from agent API — trust over chat memory):",
      ...contacts.map((c) => `- ${formatContactLine(c)}`)
    );
  } else {
    lines.push("", "This user has no saved contacts yet on the agent API.");
  }

  const recipientName = extractRecipientName(lastUserMessage);
  if (recipientName) {
    const matched = matchContact(recipientName, toPeople(contacts));
    lines.push("", `Latest message mentions recipient: ${recipientName}`);
    if (matched) {
      const delivery = matched.walletAddress
        ? `wallet ${matched.walletAddress}`
        : matched.phone
          ? `phone ${matched.phone}`
          : "no delivery method on file";
      lines.push(
        `Contact match: ON FILE (${matched.country ?? "no country"} · ${delivery}).`,
        `Run quote immediately — do not ask to add them or ask for wallet/phone.`,
        `Example: npm run remifi-api -- quote --amount <N> --recipient "${matched.name}" ${scopeFlag}`
      );
    } else {
      lines.push(
        `Contact match: NOT in this user's list.`,
        `Only then ask for country plus wallet or phone, or offer to add via People page.`,
        `Verify with: npm run remifi-api -- contacts "${recipientName}" ${scopeFlag}`
      );
    }
  }

  return lines.join("\n");
}

async function tryChatCompletion(
  history: ChatTurn[],
  sessionId?: string,
  systemPrompt?: string
): Promise<{ reply?: string; error?: string; status?: number }> {
  const headers = await gatewayHeaders();
  const system = systemPrompt ?? PLAIN_TEXT_BASE;

  for (const model of MODELS) {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        user: sessionId ? `web:${sessionId}` : undefined,
        messages: [{ role: "system", content: system }, ...history],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const data = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (res.ok && raw) {
      return { reply: formatAgentReply(raw) };
    }

    const err = data.error?.message ?? `gateway ${res.status} (${model})`;
    if (res.status === 404 || res.status === 405) {
      continue;
    }
    return { error: err, status: res.status };
  }

  return {
    error:
      "OpenClaw chat endpoint unavailable. Run `openclaw gateway run` and enable gateway.http.endpoints.chatCompletions.",
    status: 503,
  };
}

/** Proxy web Pay chat to OpenClaw (same brain as Telegram/WhatsApp). */
export async function POST(req: NextRequest) {
  if (!GATEWAY) {
    return NextResponse.json({ available: false }, { status: 503 });
  }

  let body: {
    sessionId?: string;
    messages?: ChatTurn[];
    senderWallet?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!history.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const senderWallet = body.senderWallet?.trim();
  const contacts =
    senderWallet && WALLET_RE.test(senderWallet)
      ? await fetchWalletContacts(senderWallet)
      : [];
  const systemPrompt = buildSystemPrompt(
    senderWallet,
    contacts,
    latestUserMessage(history)
  );

  try {
    const result = await tryChatCompletion(
      history,
      body.sessionId,
      systemPrompt
    );
    if (result.reply) {
      return NextResponse.json({ available: true, reply: result.reply });
    }
    console.error("[pay-agent]", result.error);
    return NextResponse.json(
      { available: true, error: result.error ?? "gateway error" },
      { status: result.status ?? 502 }
    );
  } catch (err) {
    console.error("[pay-agent]", err);
    return NextResponse.json(
      {
        available: true,
        error:
          "Cannot reach OpenClaw gateway. Start it with `openclaw gateway run`.",
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  if (!GATEWAY) {
    return NextResponse.json({ available: false, reachable: false });
  }
  try {
    const res = await fetch(`${GATEWAY}/health`, {
      headers: await gatewayHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    return NextResponse.json({
      available: true,
      reachable: res.ok,
      status: res.status,
    });
  } catch {
    return NextResponse.json({ available: true, reachable: false });
  }
}
