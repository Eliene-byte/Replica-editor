import type { MediaItem, Project, RenderJob } from "../../../shared/types.ts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`resposta inválida de ${url}`);
    }
  }
  if (!res.ok) throw new Error(body?.error ?? `erro ${res.status} em ${url}`);
  return body as T;
}

export const api = {
  health: () => request<{ ok: boolean; ffmpeg: string | null; ffmpegVersion: string | null; node: string }>("/api/health"),

  listProjects: () =>
    request<{ projects: Array<{ id: string; name: string; updatedAt: string; mediaCount: number; durationFrames: number }> }>(
      "/api/projects"
    ),

  createProject: (name: string, settings?: Partial<Project["settings"]>) =>
    request<{ project: Project }>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, settings }),
    }),

  loadProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),

  saveProject: (id: string, project: Partial<Project>) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project),
    }),

  deleteProject: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  importMedia: (id: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("file", file, file.name);
    return request<{ imported: MediaItem[]; skipped: Array<{ name: string; reason: string }> }>(
      `/api/projects/${id}/media`,
      { method: "POST", body: form }
    );
  },

  deleteMedia: (projectId: string, mediaId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/media/${mediaId}`, { method: "DELETE" }),

  regenerateProxy: (projectId: string, mediaId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/media/${mediaId}/proxy`, { method: "POST" }),

  presets: () => request<{ presets: Array<{ id: string; label: string; kind: string }> }>("/api/presets"),

  enqueueRender: (body: { projectId: string; timelineId?: string; presetId: string; outputName?: string }) =>
    request<{ job: RenderJob }>("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),

  listJobs: () => request<{ jobs: RenderJob[] }>("/api/render"),

  getJob: (id: string) => request<{ job: RenderJob }>(`/api/render/${id}`),

  cancelJob: (id: string) => request<{ ok: boolean }>(`/api/render/${id}`, { method: "DELETE" }),

  streamUrl: (projectId: string, mediaId: string) => `/api/projects/${projectId}/media/${mediaId}/stream`,
  proxyUrl: (projectId: string, mediaId: string) => `/api/projects/${projectId}/media/${mediaId}/proxy`,
  thumbUrl: (projectId: string, mediaId: string) => `/api/projects/${projectId}/media/${mediaId}/thumb`,
  renderFileUrl: (jobId: string) => `/api/render/${jobId}/file`,
};
