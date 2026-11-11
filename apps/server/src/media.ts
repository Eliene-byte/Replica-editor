import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { MediaItem, Project } from "../../shared/types.ts";
import { parseMultipart } from "./multipart.ts";
import { probe, resolveBinaries, run } from "./ffmpeg.ts";
import { ensureDir, pathExists, uid } from "./util.ts";
import { mediaDir, projectDir, proxyDir } from "./store.ts";

export const MAX_FILE_BYTES = Number(process.env.REPLICA_MAX_FILE_BYTES ?? 4 * 1024 * 1024 * 1024);

/** hash rápido: tamanho + primeiro e último MB. Bom o bastante para deduplicar. */
export async function contentHash(file: string): Promise<string> {
  const stat = await fsp.stat(file);
  const hash = crypto.createHash("sha1");
  hash.update(String(stat.size));
  const fh = await fsp.open(file, "r");
  try {
    const chunk = Buffer.alloc(Math.min(1024 * 1024, stat.size));
    await fh.read(chunk, 0, chunk.length, 0);
    hash.update(chunk);
    if (stat.size > chunk.length) {
      const tail = Buffer.alloc(Math.min(1024 * 1024, stat.size));
      await fh.read(tail, 0, tail.length, Math.max(0, stat.size - tail.length));
      hash.update(tail);
    }
  } finally {
    await fh.close();
  }
  return hash.digest("hex");
}

export interface ImportResult {
  imported: MediaItem[];
  skipped: Array<{ name: string; reason: string }>;
}

export async function importMedia(project: Project, req: IncomingMessage): Promise<ImportResult> {
  const contentType = req.headers["content-type"] ?? "";
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) throw new Error("requisição não é multipart/form-data");
  const boundary = (match[1] ?? match[2]).trim();

  const tmpDir = path.join(projectDir(project.id), "tmp");
  await ensureDir(tmpDir);

  const created: MediaItem[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  await parseMultipart(req, boundary, {
    maxFileBytes: MAX_FILE_BYTES,
    tmpDir,
    onFile: async (file) => {
      try {
        const hash = await contentHash(file.path);
        const existing = project.media.find((m) => m.contentHash === hash);
        if (existing) {
          skipped.push({ name: file.filename, reason: "arquivo idêntico já importado" });
          return file.path;
        }
        const dir = mediaDir(project.id);
        await ensureDir(dir);
        const dest = path.join(dir, `${hash.slice(0, 8)}-${file.filename}`);
        await fsp.rename(file.path, dest).catch(async () => {
          await fsp.copyFile(file.path, dest);
          await fsp.rm(file.path, { force: true });
        });

        const info = await probe(dest);
        const stat = await fsp.stat(dest);
        const item: MediaItem = {
          id: uid("med"),
          name: file.filename,
          path: path.relative(projectDir(project.id), dest).replace(/\\/g, "/"),
          kind: info?.kind ?? "video",
          durationFrames: info?.durationFrames ?? 1,
          fps: info?.fps ?? project.settings.fps,
          width: info?.width ?? 0,
          height: info?.height ?? 0,
          hasAudio: info?.hasAudio ?? false,
          status: info ? "ready" : "error",
          contentHash: hash,
          metadata: { size: stat.size, importedAt: new Date().toISOString() },
          createdAt: new Date().toISOString(),
        };
        created.push(item);
        return dest;
      } catch (err) {
        skipped.push({ name: file.filename, reason: (err as Error).message });
        return file.path;
      }
    },
  });

  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  return { imported: created, skipped };
}

/** Gera proxy (480p) e miniatura em background. Falha aqui não quebra o projeto. */
export async function generateDerivatives(project: Project, item: MediaItem): Promise<{ thumb?: string; proxy?: string }> {
  const { ffmpeg } = await resolveBinaries();
  if (!ffmpeg) return {};
  const source = path.join(projectDir(project.id), item.path);
  if (!(await pathExists(source))) return {};
  const out: { thumb?: string; proxy?: string } = {};

  await ensureDir(proxyDir());
  const thumb = path.join(proxyDir(), `${item.id}.jpg`);
  if (!(await pathExists(thumb))) {
    const res = await run(ffmpeg, [
      "-y", "-ss", "0.5", "-i", source,
      "-frames:v", "1", "-vf", "scale=160:-2", "-q:v", "6", thumb,
    ]).catch(() => null);
    if (res && res.code === 0) out.thumb = path.basename(thumb);
  }

  if (item.kind !== "audio") {
    const proxy = path.join(proxyDir(), `${item.id}.mp4`);
    const scale = Math.max(2, Math.round((item.width || 1920) / 480) || 1);
    if (!(await pathExists(proxy))) {
      const res = await run(ffmpeg, [
        "-y", "-i", source,
        "-vf", `scale=trunc(iw/${scale})*2:-2`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
        "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart", proxy,
      ], { timeoutMs: 30 * 60 * 1000 }).catch(() => null);
      if (res && res.code === 0) out.proxy = path.basename(proxy);
    }
  }
  return out;
}

export function absoluteMediaPath(project: Project, item: MediaItem): string {
  return path.join(projectDir(project.id), item.path);
}

export function proxyPath(item: MediaItem): string {
  return path.join(proxyDir(), `${item.id}.${item.kind === "audio" ? "mp3" : "mp4"}`);
}

export function thumbPath(item: MediaItem): string {
  return path.join(proxyDir(), `${item.id}.jpg`);
}

export async function removeMediaFiles(item: MediaItem): Promise<void> {
  await Promise.all([
    fsp.rm(proxyPath(item), { force: true }),
    fsp.rm(thumbPath(item), { force: true }),
  ]);
}
