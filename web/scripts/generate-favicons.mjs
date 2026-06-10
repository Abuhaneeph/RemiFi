/**
 * Generate favicon + app icons from public/logo.png
 *   npm run icons
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public", "logo.png");

const outputs = [
  { file: "app/icon.png", size: 32 },
  { file: "app/apple-icon.png", size: 180 },
  { file: "public/favicon-32x32.png", size: 32 },
  { file: "public/favicon-16x16.png", size: 16 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

const image = sharp(src);
for (const { file, size } of outputs) {
  const out = path.join(root, file);
  await mkdir(path.dirname(out), { recursive: true });
  await image.clone().resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  console.log(`✓ ${file} (${size}×${size})`);
}
