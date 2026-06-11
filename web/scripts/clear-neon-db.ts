import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("DATABASE_URL not found in web/.env.local");
  process.exit(1);
}

async function main() {
  const sql = neon(match![1].trim());

  const [chatCount] = await sql`SELECT count(*)::int AS n FROM chat_messages`;
  const [notifCount] = await sql`SELECT count(*)::int AS n FROM notifications`;

  await sql`TRUNCATE TABLE chat_messages, notifications`;

  console.log(
    `Cleared ${chatCount.n} chat message(s) and ${notifCount.n} notification(s).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
