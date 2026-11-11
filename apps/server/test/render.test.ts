import test from "node:test";
import assert from "node:assert/strict";
import { buildRenderPlan, getPreset, PRESETS } from "../src/render.ts";
import { emptyTimeline } from "../../shared/types.ts";
import type { MediaItem, Project, Timeline } from "../../shared/types.ts";

function mediaItem(): MediaItem {
  return {
    id: "med_1",
    name: "a.mp4",
    path: "media/a.mp4",
    kind: "video",
    durationFrames: 300,
    fps: 30,
    width: 1920,
    height: 1080,
    hasAudio: true,
    status: "ready",
    contentHash: "hash",
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

function projectWithClip(): { project: Project; timeline: Timeline } {
  const timeline = emptyTimeline("tl_1", 30);
  timeline.durationFrames = 150;
  const base = {
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0] as [number, number, number], gamma: [0, 0, 0] as [number, number, number], gain: [1, 1, 1] as [number, number, number], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  };
  timeline.clips.push({
    ...base,
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 90,
  });
  timeline.clips.push({
    ...base,
    id: "clp_2",
    trackId: "tl_1_a1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 90,
  });
  const project: Project = {
    id: "prj_1",
    name: "Teste",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { fps: 30, width: 1920, height: 1080, sampleRate: 48000, proxyEnabled: true, proxyScale: 4, renderPath: "renders" },
    media: [mediaItem()],
    bins: [],
    timelines: [timeline],
    activeTimelineId: "tl_1",
    titles: [],
  };
  return { project, timeline };
}

test("o plano de render monta trim, overlay, amix e encoder", () => {
  const { project, timeline } = projectWithClip();
  const preset = getPreset("mp4-720p")!;
  const plan = buildRenderPlan({
    project,
    timeline,
    mediaById: new Map(project.media.map((m) => [m.id, m])),
    preset,
    outputPath: "/tmp/saida.mp4",
    absoluteMediaPath: (item) => `/mídia/${item.name}`,
  });

  const graph = plan.args[plan.args.indexOf("-filter_complex") + 1];
  assert.match(graph, /trim=start=0:end=90/);
  assert.match(graph, /overlay=/);
  assert.match(graph, /between\(t,0\.000,3\.000\)/, "a janela do overlay cobre a duração do clipe");
  assert.match(graph, /amix=inputs=/);
  assert.match(graph, /anullsrc=/, "há sempre uma base de áudio");
  assert.ok(plan.args.includes("libx264"));
  assert.ok(plan.args.includes("yuv420p"));
  assert.equal(plan.durationSeconds, 5);
  assert.deepEqual(plan.inputs, ["/mídia/a.mp4"]);
});

test("clip desabilitado não entra no render", () => {
  const { project, timeline } = projectWithClip();
  timeline.clips[0].enabled = false;
  const plan = buildRenderPlan({
    project,
    timeline,
    mediaById: new Map(project.media.map((m) => [m.id, m])),
    preset: getPreset("mp4-1080p")!,
    outputPath: "/tmp/saida.mp4",
    absoluteMediaPath: (item) => `/mídia/${item.name}`,
  });
  const graph = plan.args[plan.args.indexOf("-filter_complex") + 1];
  assert.doesNotMatch(graph, /\[0:v\]/, "nenhum segmento de vídeo desabilitado entra no grafo");
});

test("preset de áudio não mapeia vídeo", () => {
  const { project, timeline } = projectWithClip();
  const plan = buildRenderPlan({
    project,
    timeline,
    mediaById: new Map(project.media.map((m) => [m.id, m])),
    preset: getPreset("wav-audio")!,
    outputPath: "/tmp/saida.wav",
    absoluteMediaPath: (item) => `/mídia/${item.name}`,
  });
  assert.ok(plan.args.includes("-vn"));
  assert.ok(plan.args.includes("pcm_s16le"));
  assert.ok(!plan.args.includes("libx264"));
});

test("cor do clip entra no filtro eq", () => {
  const { project, timeline } = projectWithClip();
  timeline.clips[0].color.gain = [1.4, 1.4, 1.4];
  const plan = buildRenderPlan({
    project,
    timeline,
    mediaById: new Map(project.media.map((m) => [m.id, m])),
    preset: getPreset("mp4-1080p")!,
    outputPath: "/tmp/saida.mp4",
    absoluteMediaPath: (item) => `/mídia/${item.name}`,
  });
  const graph = plan.args[plan.args.indexOf("-filter_complex") + 1];
  assert.match(graph, /eq=.*contrast=1\.4/);
});

test("a lista de presets tem ids únicos e saída de vídeo e áudio", () => {
  const ids = PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PRESETS.some((p) => p.kind === "video"));
  assert.ok(PRESETS.some((p) => p.kind === "audio"));
});
