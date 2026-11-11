import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** raiz do repo (dist/server -> dist -> repo) */
export const REPO_ROOT = path.resolve(HERE, "..", "..");

export type PlatformKey = "linux-x64" | "win-x64" | "darwin-x64" | "darwin-arm64";

export function platformKey(): PlatformKey {
  const platform = process.platform === "win32" ? "win" : process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "x64" ? "x64" : "arm64";
  return `${platform}-${arch}` as PlatformKey;
}

function vendorPath(name: string): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(REPO_ROOT, "vendor", "ffmpeg", platformKey(), `${name}${ext}`);
}

let cached: { ffmpeg: string | null; ffprobe: string | null } | null = null;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Ordem: env -> vendor (baixado pelo CI) -> PATH do sistema */
export async function resolveBinaries(): Promise<{ ffmpeg: string | null; ffprobe: string | null }> {
  if (cached) return cached;
  const envFfmpeg = process.env.REPLICA_FFMPEG;
  const envFfprobe = process.env.REPLICA_FFPROBE;
  const vendorFfmpeg = vendorPath("ffmpeg");
  const vendorFfprobe = vendorPath("ffprobe");

  const pick = async (env: string | undefined, vendor: string, fallback: string): Promise<string | null> => {
    if (env) return env;
    if (await exists(vendor)) return vendor;
    return fallback;
  };

  cached = {
    ffmpeg: await pick(envFfmpeg, vendorFfmpeg, "ffmpeg"),
    ffprobe: await pick(envFfprobe, vendorFfprobe, "ffprobe"),
  };
  return cached;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(bin: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`timeout depois de ${opts.timeoutMs}ms: ${bin}`));
        }, opts.timeoutMs)
      : undefined;
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export interface MediaInfo {
  duration: number; // segundos
  fps: number;
  width: number;
  height: number;
  hasAudio: boolean;
  kind: "video" | "audio" | "image";
  durationFrames: number;
}

/** Metadados via ffprobe. Sem ffprobe -> null (o app segue, só sem duração). */
export async function probe(file: string): Promise<MediaInfo | null> {
  const { ffprobe } = await resolveBinaries();
  if (!ffprobe) return null;
  const res = await run(ffprobe, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]).catch(() => null);
  if (!res || res.code !== 0) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    return null;
  }
  const streams: any[] = parsed.streams ?? [];
  const format = parsed.format ?? {};
  const video = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  const audio = streams.find((s) => s.codec_type === "audio");
  const duration = Number(format.duration ?? video?.duration ?? 0);
  const fps = parseFps(video?.avg_frame_rate ?? video?.r_frame_rate);
  const width = Number(video?.width ?? 0);
  const height = Number(video?.height ?? 0);
  const kind: MediaInfo["kind"] = !video ? "audio" : width && height ? "video" : "image";
  const durationFrames = Math.max(1, Math.round(duration * (fps || 25)));
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    fps: fps || 25,
    width,
    height,
    hasAudio: Boolean(audio),
    kind,
    durationFrames,
  };
}

export function parseFps(rate?: string): number {
  if (!rate) return 0;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return 0;
  const fps = num / den;
  return Number.isFinite(fps) && fps > 0 ? Math.min(fps, 240) : 0;
}

/** Progresso de render: ffmpeg -progress pipe:1 emite out_time_us=... */
export function runWithProgress(
  bin: string,
  args: string[],
  onProgress: (seconds: number) => void
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    child.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const m = /^out_time_us=(\d+)/.exec(line.trim());
        if (m) onProgress(Number(m[1]) / 1_000_000);
        else {
          const m2 = /^out_time_ms=(\d+)/.exec(line.trim());
          if (m2) onProgress(Number(m2[1]) / 1000);
        }
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
