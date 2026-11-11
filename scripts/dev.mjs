import { context } from "esbuild";
import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "web");

await mkdir(path.join(out, "assets"), { recursive: true });
await cp(path.join(root, "apps/web/index.html"), path.join(out, "index.html"));

const web = await context({
  entryPoints: [path.join(root, "apps/web/src/main.ts")],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  sourcemap: true,
  outfile: path.join(out, "assets/app.js"),
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
const css = await context({
  entryPoints: [path.join(root, "apps/web/styles/app.css")],
  bundle: true,
  sourcemap: true,
  outfile: path.join(out, "assets/app.css"),
});

await web.watch();
await css.watch();
console.log("front em watch. Rodando o servidor...");

const server = spawn(process.execPath, [path.join(root, "dist/server/index.js")], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

process.on("SIGINT", async () => {
  server.kill();
  await web.dispose();
  await css.dispose();
  process.exit(0);
});
