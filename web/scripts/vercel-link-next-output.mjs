/**
 * Vercel post-build: platform validator looks for /vercel/path0/.next/package.json
 * but Next builds to web/.next when Root Directory is `web`. Symlink repo-root .next → web/.next.
 */
import { rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = join(scriptDir, "..");
const repoRoot = join(webDir, "..");
const webNext = join(webDir, ".next");
const rootNext = join(repoRoot, ".next");

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

if (!existsSync(webNext)) {
  console.error("vercel-link-next-output: missing web/.next after build");
  process.exit(1);
}

if (existsSync(rootNext)) {
  await rm(rootNext, { recursive: true, force: true });
}

const linkType = process.platform === "win32" ? "junction" : "dir";
await symlink(webNext, rootNext, linkType);
console.log(`vercel-link-next-output: ${rootNext} -> ${webNext}`);
