import { type NextRequest, NextResponse } from "next/server";
import { formatAgentReply } from "../../lib/format-agent-reply";

type ChatTurn = { role: "user" | "assistant"; content: string };

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL?.trim().replace(/\/$/, "");
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
const MODELS = ["openclaw/remifi", "openclaw/default", "openclaw"];

const PLAIN_TEXT_SYSTEM = [
  "You are Remifi, a professional remittance assistant on Celo.",
  "Reply in plain text only: no markdown, no # headers, no blockquotes, no bullet lists, no **bold**, no emojis.",
  "Keep answers concise and professional.",
  "For quotes and sends, use the remifi skill and agent API — never invent rates or transaction hashes.",
].join(" ");

async function gatewayHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function tryChatCompletion(
  history: ChatTurn[],
  sessionId?: string
): Promise<{ reply?: string; error?: string; status?: number }> {
  const headers = await gatewayHeaders();

  for (const model of MODELS) {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        user: sessionId ? `web:${sessionId}` : undefined,
        messages: [
          { role: "system", content: PLAIN_TEXT_SYSTEM },
          ...history,
        ],
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

  let body: { sessionId?: string; messages?: ChatTurn[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!history.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const result = await tryChatCompletion(history, body.sessionId);
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
