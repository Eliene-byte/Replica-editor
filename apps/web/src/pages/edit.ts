/**
 * Página de edição (S04) — a central do app.
 * A página Cut (S03) reutiliza esta com o modo compacto.
 */

import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { el } from "../dom.ts";
import { icon, iconButton } from "../icons.ts";
import { createTimeline } from "../components/timeline.ts";
import { createViewer } from "../components/viewer.ts";
import { createMediaPool } from "../components/pool.ts";
import { createInspector } from "../components/inspector.ts";
import { toast } from "../components/toast.ts";
import {
  clipEnd,
  findGap,
  firstFreeFrame,
  insertClip,
  makeClip,
  rippleDelete,
  timelineDuration,
} from "../core/model.ts";
import { formatTimecode } from "../../../shared/time.ts";
import type { MediaItem } from "../../../shared/types.ts";

export interface EditPageOptions {
  compact?: boolean;
}

export interface EditController {
  togglePlay(): void;
  play(): void;
  stop(): void;
  deleteSelected(): void;
  addMarker(): void;
}

export interface EditPage extends EditController {
  container: HTMLElement;
  destroy(): void;
}

export function createEditPage(options: EditPageOptions = {}): EditPage {
  const container = el("div", { class: `page page--edit${options.compact ? " page--compact" : ""}` });

  const viewer = createViewer();
  const timelineView = createTimeline();
  const inspector = createInspector();

  const pool = createMediaPool({
    onOpen(media: MediaItem) {
      viewer.show(media);
      store.state.sourceMediaId = media.id;
    },
    onAppend(media: MediaItem) {
      appendMedia(media);
    },
  });

  /* ------------------------------ toolbar ------------------------------ */

  const toolSelect = iconButton("select", "Ferramenta de seleção (V)", () => store.setTool("select"));
  const toolRazor = iconButton("razor", "Ferramenta de corte (S)", () => store.setTool("razor"));
  const toolRoll = iconButton("roll", "Ajuste fino: roll (R)", () => store.setTool("roll"));
  const toolSlip = iconButton("slip", "Ajuste fino: slip (Y)", () => store.setTool("slip"));
  const toolSlide = iconButton("slide", "Ajuste fino: slide (U)", () => store.setTool("slide"));
  const snapBtn = iconButton("magnet", "Encaixe (N)", () => {
    store.state.snap = !store.state.snap;
    snapBtn.classList.toggle("is-on", store.state.snap);
    toast(store.state.snap ? "Encaixe ligado" : "Encaixe desligado", "info");
  });
  snapBtn.classList.toggle("is-on", store.state.snap);
  const undoBtn = iconButton("undo", "Desfazer (Ctrl+Z)", () => store.undo());
  const redoBtn = iconButton("redo", "Refazer (Ctrl+Shift+Z)", () => store.redo());
  const zoomIn = iconButton("zoomIn", "Aproximar (Ctrl+=)", () => store.setZoom(store.state.zoom * 1.25));
  const zoomOut = iconButton("zoomOut", "Afastar (Ctrl+-)", () => store.setZoom(store.state.zoom / 1.25));
  const markerBtn = iconButton("plus", "Marcar ponto (M)", () => addMarker());

  const timecode = el("span", { class: "timecode timecode--big" });

  const toolbar = el("div", { class: "toolbar" }, [
    toolSelect,
    toolRazor,
    el("span", { class: "divider" }),
    toolRoll,
    toolSlip,
    toolSlide,
    el("span", { class: "divider" }),
    snapBtn,
    undoBtn,
    redoBtn,
    el("span", { class: "divider" }),
    zoomOut,
    zoomIn,
    markerBtn,
    el("span", { class: "spacer" }),
    timecode,
  ]);

  /* --------------------------- layout --------------------------- */

  const left = el("div", { class: "panel panel--pool" }, [
    el("h2", { class: "panel-title", text: "Mídia" }),
    pool.container,
  ]);

  const center = el("div", { class: "panel panel--center" }, [viewer.container, timelineView.container]);
  const right = options.compact ? el("div", { class: "panel panel--inspector panel--hidden" }) : inspector.container;

  container.append(toolbar, el("div", { class: "edit-grid" }, [left, center, right]));

  /* --------------------------- ações --------------------------- */

  function fps(): number {
    return store.state.project?.settings.fps ?? 30;
  }

  function appendMedia(media: MediaItem): void {
    const timeline = store.timeline;
    if (!timeline) return;
    const track = timeline.tracks.find((t) => t.kind === "video");
    if (!track) return;
    const length = media.durationFrames;
    const at = store.state.ripple
      ? firstFreeFrame(timeline, track.id)
      : findGap(timeline, track.id, store.state.playhead, length);
    const clip = makeClip({
      trackId: track.id,
      mediaId: media.id,
      start: at,
      in: 0,
      out: Math.min(length, media.durationFrames),
      id: `clp_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    });
    store.commitTimeline(insertClip(timeline, clip, { ripple: store.state.ripple }));
    store.setPlayhead(at);
    toast(`${media.name} adicionado à timeline`, "success");
  }

  function addMarker(): void {
    const timeline = store.timeline;
    if (!timeline) return;
    const next = structuredClone(timeline);
    next.markers.push({
      id: `mk_${Date.now()}`,
      time: store.state.playhead,
      color: "#ffd166",
      label: `marcador ${next.markers.length + 1}`,
    });
    store.commitTimeline(next);
  }

  function deleteSelected(): void {
    const timeline = store.timeline;
    if (!timeline) return;
    let next = timeline;
    for (const id of store.state.selectedClipIds) {
      next = store.state.ripple ? rippleDelete(next, id) : { ...next, clips: next.clips.filter((c) => c.id !== id) };
    }
    store.commitTimeline(next);
    store.select([]);
    toast("Clipe removido", "info");
  }

  /* --------------------------- reprodução --------------------------- */

  let playing = false;
  let lastTs = 0;
  let activeClipId: string | null = null;

  function syncViewer(): void {
    const timeline = store.timeline;
    if (!timeline) return;
    const frame = store.state.playhead;
    const clip = timeline.clips.find((c) => frame >= c.start && frame < clipEnd(c));
    if (!clip) {
      viewer.video.pause();
      activeClipId = null;
      return;
    }
    if (clip.id !== activeClipId) {
      activeClipId = clip.id;
      const media = store.state.project?.media.find((m) => m.id === clip.mediaId) ?? null;
      viewer.show(media);
    }
    const mediaFps = store.state.project?.media.find((m) => m.id === clip.mediaId)?.fps ?? fps();
    const seconds = (clip.in + (frame - clip.start) * (mediaFps / fps()) * clip.speed) / mediaFps;
    if (Math.abs(viewer.video.currentTime - seconds) > 0.25) viewer.seekSeconds(seconds);
    if (playing && viewer.video.paused) void viewer.video.play().catch(() => undefined);
  }

  function tick(ts: number): void {
    if (!playing) return;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    const next = store.state.playhead + dt * fps();
    if (next > (store.timeline?.durationFrames ?? 0)) {
      store.setPlayhead(0);
      stop();
      return;
    }
    store.setPlayhead(next);
    syncViewer();
    requestAnimationFrame(tick);
  }

  function play(): void {
    if (!store.timeline) return;
    playing = true;
    store.state.playing = true;
    lastTs = performance.now();
    syncViewer();
    requestAnimationFrame(tick);
  }

  function stop(): void {
    playing = false;
    store.state.playing = false;
    viewer.video.pause();
  }

  function togglePlay(): void {
    if (playing) stop();
    else play();
  }

  /* --------------------------- drop na timeline --------------------------- */

  const scroller = timelineView.container.querySelector(".timeline-scroll");
  scroller?.addEventListener("dragover", (event) => {
    const dragEvent = event as DragEvent;
    dragEvent.preventDefault();
    if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = "copy";
  });
  scroller?.addEventListener("drop", (event) => {
    const dragEvent = event as DragEvent;
    dragEvent.preventDefault();
    const mediaId = dragEvent.dataTransfer?.getData("application/x-replica-media");
    if (!mediaId) return;
    const media = store.state.project?.media.find((m) => m.id === mediaId);
    if (!media) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const frame = Math.max(0, Math.round((dragEvent.clientX - rect.left + target.scrollLeft) / store.state.zoom));
    const timeline = store.timeline;
    if (!timeline) return;
    const track = timeline.tracks.find((t) => t.kind === "video");
    if (!track) return;
    const clip = makeClip({
      trackId: track.id,
      mediaId: media.id,
      start: frame,
      in: 0,
      out: media.durationFrames,
      id: `clp_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    });
    store.commitTimeline(insertClip(timeline, clip, { ripple: false }));
    toast(`${media.name} inserido em ${formatTimecode(frame, fps())}`, "success");
  });

  /* --------------------------- reações --------------------------- */

  const unsubscribes = [
    store.on("timeline", () => {
      const timeline = store.timeline;
      if (timeline) timeline.durationFrames = timelineDuration(timeline);
      timecode.textContent = formatTimecode(store.state.playhead, fps());
    }),
    store.on("playhead", () => {
      timecode.textContent = formatTimecode(store.state.playhead, fps());
    }),
    store.on("tool", () => {
      toolSelect.classList.toggle("is-on", store.state.tool === "select");
      toolRazor.classList.toggle("is-on", store.state.tool === "razor");
      toolRoll.classList.toggle("is-on", store.state.tool === "roll");
      toolSlip.classList.toggle("is-on", store.state.tool === "slip");
      toolSlide.classList.toggle("is-on", store.state.tool === "slide");
    }),
  ];
  toolSelect.classList.toggle("is-on", store.state.tool === "select");
  timecode.textContent = formatTimecode(store.state.playhead, fps());

  return {
    container,
    togglePlay,
    play,
    stop,
    deleteSelected,
    addMarker,
    destroy(): void {
      unsubscribes.forEach((fn) => fn());
      timelineView.destroy();
      stop();
    },
  };
}
