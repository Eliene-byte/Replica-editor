import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./ffmpeg.ts";
import type { Project } from "../../shared/types.ts";
import { DEFAULT_SETTINGS, emptyTimeline } from "../../shared/types.ts";
import { ensureDir, readJson, uid, writeJsonAtomic } from "./util.ts";

export function dataDir(): string {
  return process.env.REPLICA_DATA_DIR
    ? path.resolve(process.env.REPLICA_DATA_DIR)
    : path.join(REPO_ROOT, "data");
}

export function projectsDir(): string {
  return path.join(dataDir(), "projects");
}

export function proxyDir(): string {
  return path.join(dataDir(), "proxy");
}

export function renderDir(): string {
  return path.join(dataDir(), "renders");
}

export function projectDir(id: string): string {
  return path.join(projectsDir(), id);
}

export function projectFile(id: string): string {
  return path.join(projectDir(id), "project.json");
}

export function mediaDir(id: string): string {
  return path.join(projectDir(id), "media");
}

export async function listProjects(): Promise<
  Array<{ id: string; name: string; updatedAt: string; mediaCount: number; durationFrames: number }>
> {
  const dir = projectsDir();
  await ensureDir(dir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: Array<{ id: string; name: string; updatedAt: string; mediaCount: number; durationFrames: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const project = await readJson<Project>(projectFile(entry.name));
    if (!project) continue;
    out.push({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      mediaCount: project.media.length,
      durationFrames: project.timelines.find((t) => t.id === project.activeTimelineId)?.durationFrames ?? 0,
    });
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function createProject(name: string, settings?: Partial<Project["settings"]>): Promise<Project> {
  const id = uid("prj");
  const now = new Date().toISOString();
  const timelineId = uid("tl");
  const project: Project = {
    id,
    name: name?.trim() || "Projeto sem nome",
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    media: [],
    bins: [],
    timelines: [emptyTimeline(timelineId, settings?.fps ?? DEFAULT_SETTINGS.fps)],
    activeTimelineId: timelineId,
    titles: [],
  };
  await ensureDir(mediaDir(id));
  await writeJsonAtomic(projectFile(id), project);
  return project;
}

export async function readProject(id: string): Promise<Project | null> {
  if (!isSafeId(id)) return null;
  return readJson<Project>(projectFile(id));
}

/**
 * Salva o projeto. Recebe o documento inteiro do cliente e valida as regras
 * duras do schema (duração positiva, trim dentro da mídia, sem sobreposição).
 */
export async function saveProject(id: string, incoming: Project): Promise<Project> {
  const current = await readProject(id);
  if (!current) throw new Error("projeto não encontrado");
  const merged: Project = {
    ...current,
    ...incoming,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
    media: current.media, // midia é gerenciada pela rota de import
    settings: { ...current.settings, ...(incoming.settings ?? {}) },
  };
  validateProject(merged);
  await writeJsonAtomic(projectFile(id), merged);
  return merged;
}

export function validateProject(project: Project): void {
  const media = new Map(project.media.map((m) => [m.id, m]));
  const timeline = project.timelines.find((t) => t.id === project.activeTimelineId);
  if (!timeline) throw new Error("timeline ativa não encontrada");
  const trackIds = new Set(timeline.tracks.map((t) => t.id));

  for (const clip of timeline.clips) {
    if (!trackIds.has(clip.trackId)) throw new Error(`clip ${clip.id} aponta para faixa inexistente`);
    if (!media.has(clip.mediaId)) throw new Error(`clip ${clip.id} aponta para mídia inexistente`);
    if (clip.out <= clip.in) throw new Error(`clip ${clip.id} tem duração zero`);
    if (clip.in < 0) throw new Error(`clip ${clip.id} tem entrada negativa`);
    const item = media.get(clip.mediaId)!;
    if (clip.out > item.durationFrames) throw new Error(`clip ${clip.id} passa do fim da mídia`);
    if (clip.start < 0) throw new Error(`clip ${clip.id} tem início negativo`);
    for (const kf of clip.keyframes) {
      if (kf.time < clip.start || kf.time > clip.start + (clip.out - clip.in)) {
        throw new Error(`keyframe ${kf.id} fora do clip`);
      }
    }
  }

  // sem sobreposição na mesma faixa
  const byTrack = new Map<string, Array<{ start: number; end: number; id: string }>>();
  for (const clip of timeline.clips) {
    const list = byTrack.get(clip.trackId) ?? [];
    list.push({ start: clip.start, end: clip.start + (clip.out - clip.in), id: clip.id });
    byTrack.set(clip.trackId, list);
  }
  for (const [trackId, list] of byTrack) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end) {
        throw new Error(`clips ${list[i - 1].id} e ${list[i].id} se sobrepõem na faixa ${trackId}`);
      }
    }
  }
}

export async function deleteProject(id: string): Promise<boolean> {  if (!isSafeId(id)) return false;
  const dir = projectDir(id);
  try {
    await fs.access(dir);
  } catch {
    return false;
  }
  await fs.rm(dir, { recursive: true, force: true });
  return true;
}

export function isSafeId(id: string): boolean {
  return /^[a-z0-9_]+$/i.test(id);
}

/** acrescenta mídias importadas ao projeto */
export async function addMedia(projectId: string, items: Project["media"]): Promise<Project | null> {
  const project = await readProject(projectId);
  if (!project) return null;
  project.media = [...project.media, ...items];
  project.updatedAt = new Date().toISOString();
  await writeJsonAtomic(projectFile(projectId), project);
  return project;
}

/** atualiza campos derivados (thumb, proxy, status) das mídias */
export async function updateMedia(
  projectId: string,
  items: Array<Partial<Project["media"][number]> & { id: string }>
): Promise<void> {
  const project = await readProject(projectId);
  if (!project) return;
  for (const update of items) {
    const current = project.media.find((m) => m.id === update.id);
    if (current) Object.assign(current, update);
  }
  project.updatedAt = new Date().toISOString();
  await writeJsonAtomic(projectFile(projectId), project);
}

/** remove a mídia e os clipes que a usavam */
export async function removeMedia(projectId: string, mediaId: string): Promise<void> {
  const project = await readProject(projectId);
  if (!project) return;
  project.media = project.media.filter((m) => m.id !== mediaId);
  for (const bin of project.bins) bin.itemIds = bin.itemIds.filter((id) => id !== mediaId);
  for (const timeline of project.timelines) {
    timeline.clips = timeline.clips.filter((c) => c.mediaId !== mediaId);
    timeline.transitions = timeline.transitions.filter(
      (t) => !timeline.clips.some((c) => c.id === t.clipAId) || !timeline.clips.some((c) => c.id === t.clipBId)
    );
  }
  project.updatedAt = new Date().toISOString();
  await writeJsonAtomic(projectFile(projectId), project);
}
