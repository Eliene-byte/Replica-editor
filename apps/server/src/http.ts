import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseRange } from "./util.ts";

export function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

export async function readBody(req: IncomingMessage, limitBytes = 32 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new Error("corpo da requisição grande demais");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

/** Envia arquivo com suporte a Range (necessário para <video> e <audio>). */
export async function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  contentType: string,
  opts: { download?: string } = {}
): Promise<void> {
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(file);
  } catch {
    json(res, 404, { error: "arquivo não encontrado" });
    return;
  }
  const range = parseRange(req.headers.range, stat.size);
  const headers: Record<string, string> = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
  };
  if (opts.download) {
    headers["content-disposition"] = `attachment; filename="${opts.download.replace(/"/g, "")}"`;
  }
  if (range) {
    headers["content-range"] = `bytes ${range.start}-${range.end}/${stat.size}`;
    headers["content-length"] = String(range.end - range.start + 1);
    res.writeHead(206, headers);
    fs.createReadStream(file, { start: range.start, end: range.end }).pipe(res);
    return;
  }
  headers["content-length"] = String(stat.size);
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
