import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { handleApi } from "./api.ts";
import { mimeFor, sendFile } from "./http.ts";
import { REPO_ROOT } from "./ffmpeg.ts";
import { ensureDir } from "./util.ts";
import { dataDir, proxyDir, renderDir } from "./store.ts";

const PORT = Number(process.env.PORT ?? 4321);
const HOST = process.env.HOST ?? "127.0.0.1";

/** Em produção o front vive em dist/web; em desenvolvimento, apps/web. */
const WEB_ROOTS = [path.join(REPO_ROOT, "dist", "web"), path.join(REPO_ROOT, "apps", "web")];

async function resolveWebRoot(): Promise<string> {
  for (const root of WEB_ROOTS) {
    try {
      await fsp.access(path.join(root, "index.html"));
      return root;
    } catch {
      continue;
    }
  }
  return WEB_ROOTS[0];
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, webRoot: string): Promise<void> {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.join(webRoot, rel);
  // impede escapar do webRoot
  if (!target.startsWith(webRoot)) {
    res.writeHead(403).end("proibido");
    return;
  }
  try {
    const stat = await fsp.stat(target);
    if (stat.isFile()) {
      await sendFile(req, res, target, mimeFor(target));
      return;
    }
  } catch {
    /* cai no index.html */
  }
  const index = path.join(webRoot, "index.html");
  try {
    await fsp.access(index);
    await sendFile(req, res, index, "text/html; charset=utf-8");
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("front não construído — rode `npm run build`");
  }
}

export async function start(): Promise<http.Server> {
  await ensureDir(dataDir());
  await ensureDir(proxyDir());
  await ensureDir(renderDir());
  const webRoot = await resolveWebRoot();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    try {
      if (pathname.startsWith("/api/")) {
        const handled = await handleApi(req, res, pathname, url.searchParams);
        if (!handled) {
          res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "rota não encontrada" }));
        }
        return;
      }
      await serveStatic(req, res, pathname, webRoot);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(PORT, HOST, resolve));
  return server;
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  start().then(() => {
    console.log(`Corte Leve em http://${HOST}:${PORT}`);
  });
}
