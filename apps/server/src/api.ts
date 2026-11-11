import fsp from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { json, readJsonBody, sendFile } from "./http.ts";
import * as store from "./store.ts";
import * as media from "./media.ts";
import * as render from "./render.ts";
import { resolveBinaries, run } from "./ffmpeg.ts";
import type { Project } from "../../shared/types.ts";

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
}

type Handler = (ctx: Ctx) => Promise<void>;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

function route(method: string, pattern: string, handler: Handler): void {
  const keys: string[] = [];
  const source = pattern.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  routes.push({ method, regex: new RegExp(`^${source}$`), keys, handler });
}

async function requireProject(id: string, res: ServerResponse): Promise<Project | null> {
  const project = await store.readProject(id);
  if (!project) {
    json(res, 404, { error: "projeto não encontrado" });
    return null;
  }
  return project;
}

function findMedia(project: Project, mediaId: string) {
  return project.media.find((m) => m.id === mediaId) ?? null;
}

/* ------------------------------------------------------------------ */
/* rotas                                                               */
/* ------------------------------------------------------------------ */

route("GET", "/api/health", async ({ res }) => {
  const { ffmpeg } = await resolveBinaries();
  let version: string | null = null;
  if (ffmpeg) {
    const out = await run(ffmpeg, ["-version"]).catch(() => null);
    version = out?.stdout.split("\n")[0] ?? null;
  }
  json(res, 200, { ok: true, ffmpeg, ffmpegVersion: version, node: process.version });
});

route("GET", "/api/projects", async ({ res }) => {
  json(res, 200, { projects: await store.listProjects() });
});

route("POST", "/api/projects", async ({ req, res }) => {
  const body = await readJsonBody<{ name?: string; settings?: Partial<Project["settings"]> }>(req);
  const project = await store.createProject(body.name ?? "Projeto sem nome", body.settings);
  json(res, 201, { project });
});

route("GET", "/api/projects/:id", async ({ res, params }) => {
  const project = await requireProject(params.id, res);
  if (project) json(res, 200, { project });
});

route("PATCH", "/api/projects/:id", async ({ req, res, params }) => {
  const body = await readJsonBody<Partial<Project>>(req);
  try {
    const project = await store.saveProject(params.id, body as Project);
    json(res, 200, { project });
  } catch (err) {
    json(res, 422, { error: (err as Error).message });
  }
});

route("DELETE", "/api/projects/:id", async ({ res, params }) => {
  const ok = await store.deleteProject(params.id);
  json(res, ok ? 200 : 404, { ok });
});

route("POST", "/api/projects/:id/media", async ({ req, res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  try {
    const result = await media.importMedia(project, req);
    if (result.imported.length) await store.addMedia(project.id, result.imported);
    json(res, 201, { imported: result.imported, skipped: result.skipped });

    // derivados (proxy/miniatura) em background: o import não espera
    for (const item of result.imported) {
      void media
        .generateDerivatives(project, item)
        .then((derived) => {
          const patch = { id: item.id, ...derived };
          return store.updateMedia(project.id, [patch]);
        })
        .catch(() => undefined);
    }
  } catch (err) {
    json(res, 400, { error: (err as Error).message });
  }
});

route("GET", "/api/projects/:id/media/:mid/stream", async ({ req, res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const item = findMedia(project, params.mid);
  if (!item) {
    json(res, 404, { error: "mídia não encontrada" });
    return;
  }
  await sendFile(req, res, media.absoluteMediaPath(project, item), item.kind === "audio" ? "audio/mpeg" : "video/mp4");
});

route("GET", "/api/projects/:id/media/:mid/proxy", async ({ req, res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const item = findMedia(project, params.mid);
  if (!item) {
    json(res, 404, { error: "mídia não encontrada" });
    return;
  }
  const file = media.proxyPath(item);
  const exists = await fsp
    .access(file)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    json(res, 404, { error: "proxy ainda não gerado" });
    return;
  }
  await sendFile(req, res, file, item.kind === "audio" ? "audio/mpeg" : "video/mp4");
});

route("GET", "/api/projects/:id/media/:mid/thumb", async ({ req, res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const item = findMedia(project, params.mid);
  if (!item) {
    json(res, 404, { error: "mídia não encontrada" });
    return;
  }
  await sendFile(req, res, media.thumbPath(item), "image/jpeg");
});

route("POST", "/api/projects/:id/media/:mid/proxy", async ({ res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const item = findMedia(project, params.mid);
  if (!item) {
    json(res, 404, { error: "mídia não encontrada" });
    return;
  }
  const derived = await media.generateDerivatives(project, item);
  await store.updateMedia(project.id, [{ id: item.id, ...derived }]);
  json(res, 200, { ok: true, ...derived });
});

route("DELETE", "/api/projects/:id/media/:mid", async ({ res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const item = findMedia(project, params.mid);
  if (!item) {
    json(res, 404, { error: "mídia não encontrada" });
    return;
  }
  await media.removeMediaFiles(item);
  await store.removeMedia(project.id, item.id);
  json(res, 200, { ok: true });
});

route("PATCH", "/api/projects/:id/timeline/:tl", async ({ req, res, params }) => {
  const project = await requireProject(params.id, res);
  if (!project) return;
  const timeline = project.timelines.find((t) => t.id === params.tl);
  if (!timeline) {
    json(res, 404, { error: "timeline não encontrada" });
    return;
  }
  const body = await readJsonBody<Partial<typeof timeline>>(req);
  Object.assign(timeline, body);
  try {
    await store.validateProject(project);
  } catch (err) {
    json(res, 422, { error: (err as Error).message });
    return;
  }
  const saved = await store.saveProject(project.id, project);
  json(res, 200, { project: saved });
});

route("GET", "/api/presets", async ({ res }) => {
  json(res, 200, { presets: render.PRESETS });
});

route("POST", "/api/render", async ({ req, res }) => {
  const body = await readJsonBody<{ projectId: string; timelineId?: string; presetId: string; outputName?: string }>(req);
  const project = await store.readProject(body.projectId ?? "");
  if (!project) {
    json(res, 404, { error: "projeto não encontrado" });
    return;
  }
  const preset = render.getPreset(body.presetId);
  if (!preset) {
    json(res, 400, { error: "preset desconhecido" });
    return;
  }
  const timeline = project.timelines.find((t) => t.id === (body.timelineId ?? project.activeTimelineId));
  if (!timeline) {
    json(res, 400, { error: "timeline não encontrada" });
    return;
  }
  const outputName = (body.outputName ?? "render").replace(/[^\w\-]+/g, "_") || "render";
  const job = await render.enqueueRender({
    project,
    timeline,
    preset,
    outputName,
    absoluteMediaPath: (item) => media.absoluteMediaPath(project, item),
  });
  json(res, 202, { job });
});

route("GET", "/api/render", async ({ res }) => {
  json(res, 200, { jobs: render.listJobs() });
});

route("GET", "/api/render/:jid", async ({ res, params }) => {
  const job = render.getJob(params.jid);
  if (!job) {
    json(res, 404, { error: "job não encontrado" });
    return;
  }
  json(res, 200, { job });
});

route("DELETE", "/api/render/:jid", async ({ res, params }) => {
  const ok = render.cancelJob(params.jid);
  json(res, ok ? 200 : 404, { ok });
});

route("GET", "/api/render/:jid/file", async ({ req, res, params }) => {
  const job = render.getJob(params.jid);
  if (!job || !job.outputPath) {
    json(res, 404, { error: "arquivo indisponível" });
    return;
  }
  await sendFile(req, res, job.outputPath, "video/mp4", { download: path.basename(job.outputPath) });
});

export async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string, query: URLSearchParams): Promise<boolean> {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = r.regex.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1])));
    try {
      await r.handler({ req, res, params, query });
    } catch (err) {
      if (!res.headersSent) json(res, 500, { error: (err as Error).message });
      else res.end();
    }
    return true;
  }
  return false;
}
