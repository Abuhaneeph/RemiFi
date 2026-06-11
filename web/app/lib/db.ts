import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

let schemaReady = false;

export async function ensureSchema() {
  if (!isDbConfigured()) return;
  if (schemaReady) return;
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id  TEXT NOT NULL,
      role        TEXT NOT NULL,
      text        TEXT NOT NULL,
      metadata    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS chat_messages_session_idx
      ON chat_messages(session_id, created_at)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id  TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      unread      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_session_idx
      ON notifications(session_id, created_at DESC)
  `;
  schemaReady = true;
}
