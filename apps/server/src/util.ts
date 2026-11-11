import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { formatTimecode as sharedFormatTimecode } from "../../shared/time.ts";

/** id curto e legível: prj_8f2c1a */
export function uid(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export async function ensureDir(dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** escrita atômica: grava .tmp e renomeia. Nada de JSON pela metade. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** nome de arquivo seguro no Windows/Linux, sem perder a extensão */
export function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  const clean = base.length ? base : "arquivo";
  return clean.length > 120 ? `${path.extname(clean)}` && `${clean.slice(0, 100)}${path.extname(clean)}` : clean;
}

/** HTTP Range: "bytes=0-1023" -> {start,end} inclusivo. null = sem range. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;
  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatTimecode(frames: number, fps: number): string {
  return sharedFormatTimecode(frames, fps);
}
