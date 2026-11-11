import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "web");

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "assets"), { recursive: true });

const minify = process.env.NODE_ENV !== "development";

await build({
  entryPoints: [path.join(root, "apps/web/src/main.ts")],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  minify,
  sourcemap: true,
  legalComments: "none",
  outfile: path.join(out, "assets/app.js"),
  define: { "process.env.NODE_ENV": JSON.stringify(minify ? "production" : "development") },
});

await build({
  entryPoints: [path.join(root, "apps/web/styles/app.css")],
  bundle: true,
  minify,
  sourcemap: true,
  outfile: path.join(out, "assets/app.css"),
});

await cp(path.join(root, "apps/web/index.html"), path.join(out, "index.html"));

const { statSync } = await import("node:fs");
const size = statSync(path.join(out, "assets/app.js")).size;
console.log(`web pronto: dist/web/assets/app.js (${(size / 1024).toFixed(1)} kB cru)`);
