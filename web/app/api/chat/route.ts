import { type NextRequest, NextResponse } from "next/server";
import { getDb, ensureSchema, isDbConfigured } from "../../lib/db";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !isDbConfigured()) return NextResponse.json({ messages: [] });
  try {
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`
      SELECT id, role, text, metadata, created_at
      FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 200
    `;
    return NextResponse.json({ messages: rows });
  } catch (err) {
    console.error("[chat GET]", err);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; role?: string; text?: string; metadata?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { sessionId, role, text, metadata } = body;
  if (!sessionId || !role || !text) {
    return NextResponse.json({ error: "sessionId, role and text are required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  try {
    await ensureSchema();
    const sql = getDb();
    const [row] = await sql`
      INSERT INTO chat_messages(session_id, role, text, metadata)
      VALUES (
        ${sessionId},
        ${role},
        ${text},
        ${metadata != null ? JSON.stringify(metadata) : null}
      )
      RETURNING id, created_at
    `;
    return NextResponse.json({ id: row.id, created_at: row.created_at });
  } catch (err) {
    console.error("[chat POST]", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
