/**
 * Timeline em canvas.
 *
 * Por que canvas e não DOM: 300 clipes em DOM matam um notebook de 2010.
 * Em canvas são milhares, e o repaint só acontece quando algo muda (dirty flag).
 *
 * Durante um arrasto a timeline base fica congelada: cada mousemove recalcula a
 * partir do estado original, então o clip não "Anda" duas vezes nem acumula erro.
 */

import { store } from "../core/state.ts";
import type { Timeline, TimelineClip } from "../../../shared/types.ts";
import {
  clipDuration,
  clipEnd,
  cloneTimeline,
  moveClip,
  razorAt,
  rollEdit,
  slideClip,
  slipClip,
  snapFrame,
  trimClip,
  trimLimit,
} from "../core/model.ts";
import { formatTimecode } from "../../../shared/time.ts";

const RULER_HEIGHT = 24;
const EDGE_GRAB = 6; // px de tolerância para pegar a borda do clip

export interface TimelineView {
  container: HTMLElement;
  destroy(): void;
}

export function createTimeline(): TimelineView {
  const container = document.createElement("div");
  container.className = "timeline";
  const scroller = document.createElement("div");
  scroller.className = "timeline-scroll";
  const canvas = document.createElement("canvas");
  canvas.className = "timeline-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Timeline de edição");
  scroller.append(canvas);
  container.append(scroller);

  const ctx = canvas.getContext("2d");
  // dirty começa falso: o primeiro invalidate() agenda o primeiro desenho
  let dirty = false;
  let raf = 0;
  let fallback = 0;

  interface DragState {
    kind: "move" | "trim-in" | "trim-out" | "roll-in" | "roll-out" | "slip" | "slide";
    clipId: string;
    startX: number;
    base: Timeline;
    originSnapshot: string | null;
    moved: boolean;
  }
  let dragging: DragState | null = null;

  /** Traduz a ferramenta escolhida em um tipo de arrasto. */
  function dragKindFor(tool: string, edge: "in" | "out" | undefined): DragState["kind"] {
    if (tool === "roll") return edge === "in" ? "roll-in" : "roll-out";
    if (tool === "slip") return "slip";
    if (tool === "slide") return "slide";
    return edge === "in" ? "trim-in" : edge === "out" ? "trim-out" : "move";
  }

  const css = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";

  const timelineData = (): Timeline | null => store.timeline;
  const pxPerFrame = (): number => store.state.zoom;

  function frameFromClientX(clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    return Math.round((clientX - rect.left) / pxPerFrame());
  }

  function trackLayout(timeline: Timeline): Array<{ track: Timeline["tracks"][number]; y: number; height: number }> {
    const layout: Array<{ track: Timeline["tracks"][number]; y: number; height: number }> = [];
    let y = RULER_HEIGHT;
    const ordered = [...timeline.tracks].sort((a, b) =>
      a.kind === b.kind ? b.index - a.index : a.kind === "video" ? -1 : 1
    );
    for (const track of ordered) {
      layout.push({ track, y, height: track.height });
      y += track.height;
    }
    return layout;
  }

  function hitTest(clientX: number, clientY: number): { clip?: TimelineClip; edge?: "in" | "out"; trackId?: string } {
    const timeline = timelineData();
    if (!timeline) return {};
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const zoom = pxPerFrame();
    for (const { track, y: trackY, height } of trackLayout(timeline)) {
      if (y < trackY || y > trackY + height) continue;
      for (const clip of timeline.clips) {
        if (clip.trackId !== track.id) continue;
        const x0 = clip.start * zoom;
        const x1 = clipEnd(clip) * zoom;
        if (x < x0 || x > x1) continue;
        if (Math.abs(x - x0) <= EDGE_GRAB) return { clip, edge: "in", trackId: track.id };
        if (Math.abs(x - x1) <= EDGE_GRAB) return { clip, edge: "out", trackId: track.id };
        return { clip, trackId: track.id };
      }
      return { trackId: track.id };
    }
    return {};
  }

  function draw(): void {
    const timeline = timelineData();
    if (!ctx || !timeline) return;
    const zoom = pxPerFrame();
    const layout = trackLayout(timeline);
    const totalHeight = layout.reduce((sum, l) => sum + l.height, RULER_HEIGHT);
    const duration = timeline.durationFrames;
    const contentWidth = Math.max(container.clientWidth, (duration + 120) * zoom);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssWidth = Math.floor(contentWidth);
    const cssHeight = Math.max(totalHeight, 120);

    if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    ctx.fillStyle = css("--timeline-bg");
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    layout.forEach((item, index) => {
      ctx.fillStyle = index % 2 === 0 ? css("--surface") : css("--bg");
      ctx.fillRect(0, item.y, cssWidth, item.height);
      ctx.fillStyle = css("--border");
      ctx.fillRect(0, item.y + item.height - 1, cssWidth, 1);
    });

    ctx.fillStyle = css("--surface-2");
    ctx.fillRect(0, 0, cssWidth, RULER_HEIGHT);
    drawRuler(ctx, cssWidth, zoom);

    for (const clip of timeline.clips) {
      const slot = layout.find((l) => l.track.id === clip.trackId);
      if (!slot) continue;
      drawClip(ctx, clip, slot.y, slot.height, zoom, timeline);
    }

    for (const marker of timeline.markers) {
      const x = marker.time * zoom;
      ctx.fillStyle = marker.color || css("--warning");
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 6, 0);
      ctx.lineTo(x, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x, 0, 1, RULER_HEIGHT);
    }

    const px = store.state.playhead * zoom;
    ctx.fillStyle = css("--playhead");
    ctx.fillRect(px, 0, 1, totalHeight);
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 9);
    ctx.closePath();
    ctx.fill();

    dirty = false;
  }

  function drawRuler(context: CanvasRenderingContext2D, width: number, zoom: number): void {
    const fps = store.state.project?.settings.fps ?? 30;
    const targetPx = 90;
    const stepCandidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const step = stepCandidates.find((s) => s * zoom >= targetPx) ?? 3600;
    context.fillStyle = css("--ruler");
    context.font = "10px system-ui, sans-serif";
    context.textBaseline = "top";
    const last = Math.ceil(width / zoom);
    for (let frame = 0; frame <= last; frame += step) {
      const x = frame * zoom;
      context.fillRect(x, RULER_HEIGHT - 6, 1, 6);
      context.fillText(formatTimecode(frame, fps), x + 3, 3);
    }
  }

  function drawClip(
    context: CanvasRenderingContext2D,
    clip: TimelineClip,
    y: number,
    height: number,
    zoom: number,
    timeline: Timeline
  ): void {
    const selected = store.state.selectedClipIds.includes(clip.id);
    const track = timeline.tracks.find((t) => t.id === clip.trackId);
    const base = track?.kind === "audio" ? css("--clip-audio") : css("--clip-video");
    const active = track?.kind === "audio" ? css("--clip-audio-active") : css("--clip-video-active");
    const x = clip.start * zoom;
    const w = Math.max(2, clipDuration(clip) * zoom);

    context.save();
    context.globalAlpha = clip.enabled ? 1 : 0.45;
    context.fillStyle = selected ? active : base;
    roundRect(context, x, y + 2, w, height - 4, 3);
    context.fill();

    context.strokeStyle = selected ? css("--accent") : "rgba(0,0,0,.35)";
    context.lineWidth = selected ? 1.5 : 1;
    roundRect(context, x + 0.5, y + 2.5, Math.max(1, w - 1), height - 5, 3);
    context.stroke();

    if (clip.keyframes.length) {
      context.fillStyle = css("--accent");
      context.beginPath();
      context.moveTo(x + w - 8, y + 6);
      context.lineTo(x + w - 4, y + 10);
      context.lineTo(x + w - 8, y + 14);
      context.lineTo(x + w - 12, y + 10);
      context.closePath();
      context.fill();
    }

    if (w > 28) {
      context.fillStyle = css("--text");
      context.font = "11px system-ui, sans-serif";
      context.textBaseline = "middle";
      context.save();
      context.beginPath();
      context.rect(x + 4, y, w - 8, height);
      context.clip();
      context.fillText(clipLabel(clip, timeline), x + 6, y + height / 2);
      context.restore();
    }
    context.restore();
  }

  function clipLabel(clip: TimelineClip, timeline: Timeline): string {
    const project = store.state.project;
    const item = project?.media.find((m) => m.id === clip.mediaId);
    const name = item?.name ?? "clipe";
    void timeline;
    return `${name}  ${formatTimecode(clip.in, project?.settings.fps ?? 30)}`;
  }

  function roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function invalidate(): void {
    if (dirty) return;
    dirty = true;
    if (raf) return;
    const paint = (): void => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (fallback) {
        window.clearTimeout(fallback);
        fallback = 0;
      }
      draw();
    };
    raf = requestAnimationFrame(paint);
    // fallback: em aba sem foco ou máquina muito lenta o rAF pode não disparar,
    // e a timeline ficaria em branco. O timer garante o desenho.
    fallback = window.setTimeout(paint, 120);
  }

  /* ------------------------------ interação ------------------------------ */

  canvas.addEventListener("pointerdown", (event) => {
    const timeline = timelineData();
    if (!timeline) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* ponteiro sintético ou navegador sem captura: seguimos sem ela */
    }
    const hit = hitTest(event.clientX, event.clientY);

    if (store.state.tool === "razor" && hit.clip) {
      const frame = frameFromClientX(event.clientX);
      store.commitTimeline(razorAt(timeline, frame));
      return;
    }

    if (!hit.clip) {
      store.setPlayhead(frameFromClientX(event.clientX));
      if (!event.shiftKey) store.select([]);
      return;
    }

    const clip = hit.clip;
    if (event.shiftKey) {
      const current = store.state.selectedClipIds;
      const next = current.includes(clip.id)
        ? current.filter((id) => id !== clip.id)
        : [...current, clip.id];
      store.select(next);
    } else if (!store.state.selectedClipIds.includes(clip.id)) {
      store.select([clip.id]);
    }

    dragging = {
      kind: dragKindFor(store.state.tool, hit.edge),
      clipId: clip.id,
      startX: event.clientX,
      base: cloneTimeline(timeline),
      originSnapshot: store.snapshotTimeline(),
      moved: false,
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const base = dragging.base;
    const clip = base.clips.find((c) => c.id === dragging!.clipId);
    if (!clip) return;
    const deltaFrames = Math.round((event.clientX - dragging.startX) / pxPerFrame());
    if (deltaFrames === 0 && !dragging.moved) return;
    dragging.moved = true;

    const media = store.state.project?.media.find((m) => m.id === clip.mediaId);
    const mediaDuration = media?.durationFrames ?? clip.out;

    if (dragging.kind === "move") {
      let target = clip.start + deltaFrames;
      if (store.state.snap) {
        target = snapFrame(base, target, Math.round(8 / pxPerFrame()), [store.state.playhead]);
      }
      target = Math.max(0, target);
      store.commitTimeline(moveClip(base, clip.id, target), { history: false });
      return;
    }

    if (dragging.kind === "slip") {
      store.commitTimeline(slipClip(base, clip.id, deltaFrames, mediaDuration), { history: false });
      return;
    }

    if (dragging.kind === "slide") {
      store.commitTimeline(slideClip(base, clip.id, deltaFrames), { history: false });
      return;
    }

    if (dragging.kind === "roll-in" || dragging.kind === "roll-out") {
      const durationOf = (target: TimelineClip): number => {
        const item = store.state.project?.media.find((m) => m.id === target.mediaId);
        return item?.durationFrames ?? target.out;
      };
      store.commitTimeline(
        rollEdit(base, clip.id, dragging.kind === "roll-in" ? "in" : "out", deltaFrames, durationOf),
        { history: false }
      );
      return;
    }

    if (dragging.kind === "trim-in") {
      const target = Math.max(0, Math.min(clip.out - 1, clip.in + deltaFrames));
      const limited = trimLimit(base, clip.id, "in", target);
      store.commitTimeline(trimClip(base, clip.id, "in", limited - clip.in, mediaDuration), { history: false });
      return;
    }

    const target = Math.max(clip.in + 1, Math.min(mediaDuration, clip.out + deltaFrames));
    const limited = trimLimit(base, clip.id, "out", target);
    store.commitTimeline(trimClip(base, clip.id, "out", limited - clip.out, mediaDuration), { history: false });
  });

  const endDrag = (): void => {
    if (dragging?.moved && dragging.originSnapshot) {
      store.pushHistory(dragging.originSnapshot);
    }
    dragging = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("dblclick", (event) => {
    const hit = hitTest(event.clientX, event.clientY);
    if (hit.clip) store.setPlayhead(hit.clip.start);
  });

  scroller.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
        store.setZoom(store.state.zoom * factor);
      }
    },
    { passive: false }
  );

  const unsubscribe = [
    store.on("timeline", invalidate),
    store.on("selection", invalidate),
    store.on("playhead", invalidate),
    store.on("project", invalidate),
  ];

  const resizeObserver = new ResizeObserver(() => invalidate());
  resizeObserver.observe(container);

  invalidate();

  return {
    container,
    destroy(): void {
      unsubscribe.forEach((fn) => fn());
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (fallback) window.clearTimeout(fallback);
    },
  };
}
