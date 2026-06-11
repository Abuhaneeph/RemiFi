import { type NextRequest, NextResponse } from "next/server";
import { asRows, getDb, ensureSchema, isDbConfigured } from "../../lib/db";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !isDbConfigured()) return NextResponse.json({ notifications: [] });
  try {
    await ensureSchema();
    const sql = getDb();
    const rows = asRows<{ id: string; title: string; body: string; unread: boolean; created_at: string }>(
      await sql`
        SELECT id, title, body, unread, created_at
        FROM notifications
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC
        LIMIT 50
      `
    );
    return NextResponse.json({ notifications: rows });
  } catch (err) {
    console.error("[notifications GET]", err);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; title?: string; body?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { sessionId, title, body: notifBody } = body;
  if (!sessionId || !title || !notifBody) {
    return NextResponse.json({ error: "sessionId, title and body are required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  try {
    await ensureSchema();
    const sql = getDb();
    const rows = asRows<{ id: string; created_at: string }>(
      await sql`
        INSERT INTO notifications(session_id, title, body)
        VALUES (${sessionId}, ${title}, ${notifBody})
        RETURNING id, created_at
      `
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, created_at: row.created_at });
  } catch (err) {
    console.error("[notifications POST]", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: { sessionId?: string; id?: string; allRead?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { sessionId, id, allRead } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  try {
    await ensureSchema();
    const sql = getDb();
    if (allRead) {
      await sql`UPDATE notifications SET unread = FALSE WHERE session_id = ${sessionId}`;
    } else if (id) {
      await sql`
        UPDATE notifications SET unread = FALSE
        WHERE id = ${id} AND session_id = ${sessionId}
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications PATCH]", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
