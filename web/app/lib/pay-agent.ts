type ChatTurn = { role: "user" | "assistant"; content: string };

export type PayAgentResult = {
  reply?: string;
  error?: string;
};

let openClawConfigured: boolean | null = null;
let openClawReachable: boolean | null = null;

/** OpenClaw gateway URL is set in web/.env.local (Telegram-parity mode). */
export async function isOpenClawConfigured(): Promise<boolean> {
  if (openClawConfigured !== null) return openClawConfigured;
  try {
    const res = await fetch("/api/pay-agent", { cache: "no-store" });
    const data = (await res.json()) as { available?: boolean; reachable?: boolean };
    openClawConfigured = Boolean(data.available);
    openClawReachable = Boolean(data.reachable);
  } catch {
    openClawConfigured = false;
    openClawReachable = false;
  }
  return openClawConfigured;
}

export async function isOpenClawReachable(): Promise<boolean> {
  if (openClawReachable === null) await isOpenClawConfigured();
  return Boolean(openClawReachable);
}

/** Route message through OpenClaw remifi agent (same path as Telegram). */
export async function fetchPayAgentReply(
  sessionId: string,
  history: ChatTurn[],
  userMessage: string
): Promise<PayAgentResult> {
  const messages: ChatTurn[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  try {
    const res = await fetch("/api/pay-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages }),
    });
    const data = (await res.json()) as {
      reply?: string;
      error?: string;
      available?: boolean;
    };
    if (res.ok && data.reply) {
      return { reply: data.reply };
    }
    return {
      error:
        data.error ??
        (data.available === false
          ? "OpenClaw is not configured in web/.env.local."
          : "OpenClaw did not return a reply."),
    };
  } catch {
    return {
      error:
        "Cannot reach OpenClaw. Run `openclaw gateway run` in a separate terminal.",
    };
  }
}

/** Map PayChat messages to OpenClaw chat turns (text only). */
export function toAgentHistory(
  messages: Array<{ role: "user" | "bot"; text: string }>
): ChatTurn[] {
  return messages
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
}
