/**
 * Vercel Next.js 16 monorepo workaround (vercel/vercel#15937).
 *
 * When Root Directory is `web`, the build writes to web/.next and web/node_modules,
 * but post-build validation looks under /vercel/path0/ (repo root). Symlink those
 * paths at repo root so validation passes.
 *
 * @see https://github.com/vercel/vercel/issues/15937
 */
import { rm, symlink } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = join(scriptDir, "..");
const repoRoot = join(webDir, "..");

/** Repo-root names → paths inside web/ that Vercel's validator expects at path0. */
const LINKS = [".next", "node_modules"];

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

const linkType = process.platform === "win32" ? "junction" : "dir";

async function replaceWithSymlink(name, target) {
  const link = join(repoRoot, name);

  if (!existsSync(target)) {
    console.error(`vercel-monorepo-path-fix: missing ${target}`);
    process.exit(1);
  }

  if (existsSync(link)) {
    const stat = lstatSync(link);
    await rm(link, { recursive: true, force: true });
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      /* removed real directory */
    }
  }

  await symlink(target, link, linkType);
  console.log(`vercel-monorepo-path-fix: ${link} -> ${target}`);
}

for (const name of LINKS) {
  await replaceWithSymlink(name, join(webDir, name));
}
