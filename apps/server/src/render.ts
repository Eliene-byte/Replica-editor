import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { MediaItem, Project, RenderJob, Timeline, TimelineClip } from "../../shared/types.ts";
import { resolveBinaries, runWithProgress } from "./ffmpeg.ts";
import { ensureDir, uid } from "./util.ts";
import { projectDir, readProject, renderDir } from "./store.ts";

export interface RenderPreset {
  id: string;
  label: string;
  kind: "video" | "audio";
  width?: number;
  height?: number;
  crf: number;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  extension: string;
}

export const PRESETS: RenderPreset[] = [
  { id: "mp4-1080p", label: "MP4 1080p (H.264)", kind: "video", width: 1920, height: 1080, crf: 20, audioCodec: "aac", audioBitrate: "192k", extension: "mp4" },
  { id: "mp4-720p", label: "MP4 720p (H.264)", kind: "video", width: 1280, height: 720, crf: 22, audioCodec: "aac", audioBitrate: "160k", extension: "mp4" },
  { id: "mp4-480p", label: "MP4 480p (leve)", kind: "video", width: 854, height: 480, crf: 23, audioCodec: "aac", audioBitrate: "96k", extension: "mp4" },
  { id: "webm-720p", label: "WebM 720p (VP9)", kind: "video", width: 1280, height: 720, crf: 31, audioCodec: "libopus", audioBitrate: "128k", extension: "webm" },
  { id: "wav-audio", label: "Som WAV (só áudio)", kind: "audio", crf: 0, extension: "wav" },
];

export function getPreset(id: string): RenderPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export interface RenderPlan {
  args: string[];
  /** opções que precisam vir antes do caminho de saída */
  outputArgs: string[];
  durationSeconds: number;
  inputs: string[];
}

/**
 * Monta o grafo de filtros do ffmpeg a partir da timeline.
 *
 * Vídeo: um fundo preto com a duração da timeline + um overlay por clipe,
 * posicionado por `enable='between(t,inicio,fim)'`. Gaps entre clipes ficam
 * pretos de verdade, e um clipe em faixa de cima fica por cima do de baixo.
 * Áudio: base silenciosa com a duração da timeline + um `adelay` por clipe,
 * tudo mixado com `amix` normalizado (sem dividir o volume).
 */
export function buildRenderPlan(opts: {
  project: Project;
  timeline: Timeline;
  mediaById: Map<string, MediaItem>;
  preset: RenderPreset;
  outputPath: string;
  absoluteMediaPath: (item: MediaItem) => string;
}): RenderPlan {
  const { project, timeline, mediaById, preset } = opts;
  const fps = project.settings.fps || 25;
  const width = preset.width ?? project.settings.width;
  const height = preset.height ?? project.settings.height;
  const durationFrames = Math.max(1, timeline.durationFrames);
  const durationSeconds = durationFrames / fps;

  const clips = timeline.clips.filter((c) => c.enabled);
  const videoClips = clips.filter((c) => trackKind(timeline, c.trackId) === "video");
  const audioClips = clips.filter((c) => trackKind(timeline, c.trackId) === "audio");

  // um -i por mídia usada
  const usedMedia = new Map<string, number>();
  const inputs: string[] = [];
  const inputIndexOf = (item: MediaItem): number => {
    const found = usedMedia.get(item.id);
    if (found !== undefined) return found;
    const index = inputs.length;
    inputs.push(opts.absoluteMediaPath(item));
    usedMedia.set(item.id, index);
    return index;
  };

  const filters: string[] = [];
  let vLabel = "vbase0";
  filters.push(`color=c=black:s=${width}x${height}:r=${fps}:d=${durationSeconds.toFixed(3)},format=rgba[${vLabel}]`);

  const videoTracks = timeline.tracks
    .filter((t) => t.kind === "video")
    .sort((a, b) => a.index - b.index);

  let segIndex = 0;
  for (const track of videoTracks) {
    const trackClips = videoClips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.start - b.start);
    for (const clip of trackClips) {
      const item = mediaById.get(clip.mediaId);
      if (!item) continue;
      const input = inputIndexOf(item);
      const startSec = clip.start / fps;
      const lengthSec = (clip.out - clip.in) / fps / (clip.speed || 1);
      const endSec = startSec + lengthSec;
      const seg = `v${segIndex++}`;
      const next = `vbase${segIndex}`;
      const rotation = (clip.transform.rotation || 0) % 360;
      const rotateChain =
        rotation === 0
          ? ""
          : `rotate=${((rotation * Math.PI) / 180).toFixed(6)}:ow=rotw(iw):oh=roth(ih):c=none,`;
      const offsetX = clampOffset(clip.transform.x || 0, width);
      const offsetY = clampOffset(clip.transform.y || 0, height);
      const filtersText = [
        `trim=start=${clip.in}:end=${clip.out}`,
        `setpts=(PTS-STARTPTS)/${clip.speed || 1}`,
        rotateChain,
        `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
        eqFilter(clip),
        `format=rgba`,
        `pad=${width}:${height}:x=${offsetX}:y=${offsetY}:color=0x00000000`,
        `colorchannelmixer=aa=${clamp01(clip.opacity)}`,
        `setpts=PTS-STARTPTS`,
      ].filter(Boolean).join(",");
      filters.push(`[${input}:v]${filtersText}[${seg}]`);
      filters.push(
        `[${vLabel}][${seg}]overlay=x=0:y=0:eof_action=pass:shortest=0:enable='between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})'[${next}]`
      );
      vLabel = next;
    }
  }

  const audioTracks = timeline.tracks
    .filter((t) => t.kind === "audio")
    .sort((a, b) => a.index - b.index);

  const audioInputs: string[] = [];
  let aIndex = 0;
  for (const track of audioTracks) {
    const trackClips = audioClips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.start - b.start);
    for (const clip of trackClips) {
      const item = mediaById.get(clip.mediaId);
      if (!item || !item.hasAudio) continue;
      const input = inputIndexOf(item);
      const startMs = Math.round((clip.start / fps) * 1000);
      const seg = `a${aIndex++}`;
      const chain = [
        `atrim=start=${clip.in}:end=${clip.out}`,
        `asetpts=PTS-STARTPTS`,
        clip.speed && clip.speed !== 1 ? `atempo=${atempo(clip.speed)}` : "",
        `volume=${clampVolume(clip.volume)}`,
        `adelay=delays=${startMs}:all=1`,
        `apad`,
        `atrim=0:${durationSeconds.toFixed(3)}`,
      ].filter(Boolean).join(",");
      filters.push(`[${input}:a]${chain}[${seg}]`);
      audioInputs.push(seg);
    }
  }

  let aLabel: string;
  if (audioInputs.length) {
    filters.push(
      `anullsrc=r=${project.settings.sampleRate || 48000}:cl=stereo:d=${durationSeconds.toFixed(3)}[abase]`
    );
    const mixInputs = ["abase", ...audioInputs].map((label) => `[${label}]`).join("");
    filters.push(`${mixInputs}amix=inputs=${audioInputs.length + 1}:duration=first:dropout_transition=0:normalize=0[aout]`);
    aLabel = "aout";
  } else {
    filters.push(
      `anullsrc=r=${project.settings.sampleRate || 48000}:cl=stereo:d=${durationSeconds.toFixed(3)}[aout]`
    );
    aLabel = "aout";
  }

  const args: string[] = [];
  for (const file of inputs) args.push("-i", file);

  if (preset.kind === "audio") {
    args.push("-filter_complex", filters.join(";"), "-map", `[${aLabel}]`, "-vn");
    args.push("-c:a", "pcm_s16le");
    return { args, outputArgs: [], durationSeconds, inputs };
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", `[${vLabel}]`, "-map", `[${aLabel}]`);
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", String(preset.crf), "-pix_fmt", "yuv420p");
  args.push("-c:a", preset.audioCodec ?? "aac", "-b:a", preset.audioBitrate ?? "160k");
  return { args, outputArgs: ["-movflags", "+faststart", "-shortest"], durationSeconds, inputs };
}

function trackKind(timeline: Timeline, trackId: string): "video" | "audio" | null {
  return timeline.tracks.find((t) => t.id === trackId)?.kind ?? null;
}

function clamp01(value: number): string {
  return String(Math.min(1, Math.max(0, value ?? 1)));
}

/** deslocamento em pixels dentro da tela (o clamp evita erro do filtro pad) */
function clampOffset(value: number, size: number): number {
  return Math.round(Math.min(size - 2, Math.max(0, value)));
}

function clampVolume(value: number): string {
  return String(Math.min(4, Math.max(0, value ?? 1)));
}

function atempo(speed: number): number {
  const s = Math.min(2, Math.max(0.5, speed));
  return Number(s.toFixed(3));
}

/** lift/gamma/gain/temperatura aproximados com o filtro eq do ffmpeg. */
function eqFilter(clip: TimelineClip): string {
  const c = clip.color;
  if (!c) return "";
  const liftAvg = (c.lift[0] + c.lift[1] + c.lift[2]) / 3;
  const gainAvg = (c.gain[0] + c.gain[1] + c.gain[2]) / 3;
  const gammaAvg = (c.gamma[0] + c.gamma[1] + c.gamma[2]) / 3;
  const brightness = liftAvg * 0.3 + c.temperature * 0.04;
  const contrast = Math.min(3, Math.max(0, gainAvg));
  const saturation = Math.min(3, Math.max(0, 1 + gammaAvg));
  const gamma = 1 + c.tint * 0.1;
  if (brightness === 0 && contrast === 1 && saturation === 1 && gamma === 1) return "";
  return `eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}:gamma=${gamma.toFixed(3)}`;
}

/* ------------------------------------------------------------------ */
/* fila de render: um job por vez (2 ffmpeg simultâneos dobram o tempo) */
/* ------------------------------------------------------------------ */

const jobs = new Map<string, RenderJob>();
let running = false;

export function listJobs(): RenderJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function jobKey(projectId: string, timelineId: string, presetId: string, outputName: string, timeline: Timeline): string {
  const fingerprint = JSON.stringify({
    clips: timeline.clips.map((c) => [c.id, c.start, c.in, c.out, c.speed, c.opacity, c.volume, c.enabled]),
    tracks: timeline.tracks.map((t) => [t.id, t.kind, t.muted, t.solo]),
    markers: timeline.markers.length,
  });
  return crypto
    .createHash("sha1")
    .update(`${projectId}|${timelineId}|${presetId}|${outputName}|${fingerprint}`)
    .digest("hex");
}

export async function enqueueRender(opts: {
  project: Project;
  timeline: Timeline;
  preset: RenderPreset;
  outputName: string;
  absoluteMediaPath: (item: MediaItem) => string;
}): Promise<RenderJob> {
  const key = jobKey(opts.project.id, opts.timeline.id, opts.preset.id, opts.outputName, opts.timeline);
  const existing = [...jobs.values()].find(
    (j) => j.idempotencyKey === key && j.status !== "failed" && j.status !== "cancelled"
  );
  if (existing) return existing;

  const job: RenderJob = {
    id: uid("job"),
    projectId: opts.project.id,
    timelineId: opts.timeline.id,
    presetId: opts.preset.id,
    idempotencyKey: key,
    status: "queued",
    progress: 0,
    outputName: opts.outputName,
    log: "",
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  void processQueue();
  return job;
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "queued" || job.status === "rendering") {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    return true;
  }
  return false;
}

async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = [...jobs.values()].find((j) => j.status === "queued");
      if (!next) break;
      await runJob(next);
    }
  } finally {
    running = false;
  }
}

async function runJob(job: RenderJob): Promise<void> {
  const { ffmpeg } = await resolveBinaries();
  if (!ffmpeg) {
    job.status = "failed";
    job.error = "ffmpeg não encontrado. Defina REPLICA_FFMPEG ou baixe o pacote com o CI.";
    job.finishedAt = new Date().toISOString();
    return;
  }

  const project = await readProject(job.projectId);
  if (!project) {
    job.status = "failed";
    job.error = "projeto não encontrado";
    job.finishedAt = new Date().toISOString();
    return;
  }
  const timeline = project.timelines.find((t) => t.id === job.timelineId);
  const preset = getPreset(job.presetId);
  if (!timeline || !preset) {
    job.status = "failed";
    job.error = "timeline ou preset inválido";
    job.finishedAt = new Date().toISOString();
    return;
  }
  if (!timeline.clips.some((c) => c.enabled)) {
    job.status = "failed";
    job.error = "a timeline está vazia";
    job.finishedAt = new Date().toISOString();
    return;
  }

  const outDir = path.join(renderDir(), project.id);
  await ensureDir(outDir);
  const outputPath = path.join(outDir, `${job.outputName}.${preset.extension}`);
  const mediaById = new Map(project.media.map((m) => [m.id, m]));

  let plan: RenderPlan;
  try {
    plan = buildRenderPlan({
      project,
      timeline,
      mediaById,
      preset,
      outputPath,
      absoluteMediaPath: (item) => path.join(projectDir(project.id), item.path),
    });
  } catch (err) {
    job.status = "failed";
    job.error = `não foi possível montar o render: ${(err as Error).message}`;
    job.finishedAt = new Date().toISOString();
    return;
  }

  job.status = "rendering";
  job.startedAt = new Date().toISOString();
  job.progress = 0;

  const result = await runWithProgress(
    ffmpeg,
    [...plan.args, "-progress", "pipe:1", "-nostats", ...plan.outputArgs, outputPath],
    (seconds) => {
      job.progress = Math.min(0.99, seconds / Math.max(0.001, plan.durationSeconds));
    }
  );

  job.log = (result.stderr || "").split("\n").slice(-40).join("\n");
  if (result.code === 0) {
    job.status = "done";
    job.progress = 1;
    job.outputPath = outputPath;
  } else {
    job.status = "failed";
    job.error = `ffmpeg saiu com código ${result.code}`;
    await fsp.rm(outputPath, { force: true }).catch(() => undefined);
  }
  job.finishedAt = new Date().toISOString();
}
