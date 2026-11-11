import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "server");

await mkdir(out, { recursive: true });

await build({
  entryPoints: [path.join(root, "apps/server/src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node18"],
  minify: false,
  sourcemap: true,
  outfile: path.join(out, "index.js"),
  banner: { js: "// Corte Leve - servidor. Gerado por scripts/build-server.mjs. Não editar à mão." },
});

console.log("servidor pronto: dist/server/index.js");
