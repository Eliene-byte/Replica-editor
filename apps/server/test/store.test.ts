import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateProject, createProject, readProject, listProjects, deleteProject } from "../src/store.ts";
import { emptyTimeline } from "../../shared/types.ts";
import type { MediaItem, Project } from "../../shared/types.ts";

function media(id: string, frames = 300): MediaItem {
  return {
    id,
    name: `${id}.mp4`,
    path: `media/${id}.mp4`,
    kind: "video",
    durationFrames: frames,
    fps: 30,
    width: 1920,
    height: 1080,
    hasAudio: true,
    status: "ready",
    contentHash: id,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

function project(): Project {
  const timeline = emptyTimeline("tl_1", 30);
  return {
    id: "prj_1",
    name: "Teste",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { fps: 30, width: 1920, height: 1080, sampleRate: 48000, proxyEnabled: true, proxyScale: 4, renderPath: "renders" },
    media: [media("med_1")],
    bins: [],
    timelines: [timeline],
    activeTimelineId: "tl_1",
    titles: [],
  };
}

test("projeto válido passa na validação", () => {
  const p = project();
  p.timelines[0].clips.push({
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 90,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [1, 1, 1], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  });
  assert.doesNotThrow(() => validateProject(p));
});

test("clip com duração zero é recusado", () => {
  const p = project();
  p.timelines[0].clips.push({
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 50,
    out: 50,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [1, 1, 1], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  });
  assert.throws(() => validateProject(p), /duração zero/);
});

test("clip que passa do fim da mídia é recusado", () => {
  const p = project();
  p.timelines[0].clips.push({
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 9999,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [1, 1, 1], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  });
  assert.throws(() => validateProject(p), /passa do fim da mídia/);
});

test("dois clipes na mesma faixa não podem se sobrepor", () => {
  const p = project();
  const base = {
    trackId: "tl_1_v1",
    mediaId: "med_1",
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0] as [number, number, number], gamma: [0, 0, 0] as [number, number, number], gain: [1, 1, 1] as [number, number, number], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  };
  p.timelines[0].clips.push({ ...base, id: "clp_1", start: 0, in: 0, out: 100 });
  p.timelines[0].clips.push({ ...base, id: "clp_2", start: 50, in: 0, out: 100 });
  assert.throws(() => validateProject(p), /se sobrepõem/);
});

test("clip apontando para mídia inexistente é recusado", () => {
  const p = project();
  p.timelines[0].clips.push({
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_999",
    start: 0,
    in: 0,
    out: 30,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [1, 1, 1], temperature: 0, tint: 0, curve: null },
    keyframes: [],
  });
  assert.throws(() => validateProject(p), /mídia inexistente/);
});

test("keyframe fora do clipe é recusado", () => {
  const p = project();
  p.timelines[0].clips.push({
    id: "clp_1",
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 30,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [1, 1, 1], temperature: 0, tint: 0, curve: null },
    keyframes: [{ id: "kf_1", property: "opacity", time: 999, value: 0.5, easing: "linear" }],
  });
  assert.throws(() => validateProject(p), /keyframe .* fora do clip/);
});

test("o store grava e lê projeto de forma atômica", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "replica-store-"));
  process.env.REPLICA_DATA_DIR = dir;
  const created = await createProject("Teste de ponta a ponta");
  assert.ok(created.id.startsWith("prj_"));
  const read = await readProject(created.id);
  assert.equal(read?.name, "Teste de ponta a ponta");
  const list = await listProjects();
  assert.equal(list.length, 1);
  await deleteProject(created.id);
  assert.equal(await readProject(created.id), null);
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.REPLICA_DATA_DIR;
});
