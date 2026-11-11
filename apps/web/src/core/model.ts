/**
 * Operações de timeline. Funções puras: recebem uma timeline e devolvem uma
 * nova. É o único lugar onde a semântica de edição mora, então dá para testar
 * sem navegador e sem DOM.
 *
 * Todas as posições são frames inteiros. Nada de segundos em float.
 */

import type { Keyframe, KeyframeProperty, Timeline, TimelineClip, Track } from "../../../shared/types.ts";

export function cloneTimeline(timeline: Timeline): Timeline {
  return structuredClone(timeline);
}

export function clipDuration(clip: TimelineClip): number {
  return Math.max(1, clip.out - clip.in);
}

export function clipEnd(clip: TimelineClip): number {
  return clip.start + clipDuration(clip);
}

export function timelineDuration(timeline: Timeline): number {
  return timeline.clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
}

export function trackOf(timeline: Timeline, trackId: string): Track | undefined {
  return timeline.tracks.find((t) => t.id === trackId);
}

export function clipAt(timeline: Timeline, trackId: string, frame: number): TimelineClip | null {
  return (
    timeline.clips.find(
      (c) => c.trackId === trackId && frame >= c.start && frame < clipEnd(c)
    ) ?? null
  );
}

export function clipById(timeline: Timeline, clipId: string): TimelineClip | undefined {
  return timeline.clips.find((c) => c.id === clipId);
}

/** Clip na faixa de vídeo mais alta (a de cima) que cobre o frame. */
export function topVideoClipAt(timeline: Timeline, frame: number): TimelineClip | null {
  const tracks = timeline.tracks
    .filter((t) => t.kind === "video")
    .sort((a, b) => b.index - a.index);
  for (const track of tracks) {
    const clip = clipAt(timeline, track.id, frame);
    if (clip) return clip;
  }
  return null;
}

export function firstFreeFrame(timeline: Timeline, trackId: string): number {
  const clips = timeline.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const clip of clips) {
    if (clip.start > cursor) break;
    cursor = Math.max(cursor, clipEnd(clip));
  }
  return cursor;
}

/** Encontra um espaço livre na faixa (para appendar sem sobrepor). */
export function findGap(timeline: Timeline, trackId: string, wanted: number, length: number): number {
  const clips = timeline.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
  let start = Math.max(0, wanted);
  for (const clip of clips) {
    if (start + length <= clip.start) break;
    if (start < clipEnd(clip) && start >= clip.start) start = clipEnd(clip);
  }
  return start;
}

export function makeClip(input: {
  trackId: string;
  mediaId: string;
  start: number;
  in: number;
  out: number;
  id: string;
}): TimelineClip {
  return {
    id: input.id,
    trackId: input.trackId,
    mediaId: input.mediaId,
    start: input.start,
    in: input.in,
    out: input.out,
    enabled: true,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    color: {
      lift: [0, 0, 0],
      gamma: [0, 0, 0],
      gain: [1, 1, 1],
      temperature: 0,
      tint: 0,
      curve: null,
    },
    keyframes: [],
  };
}

/** Cola o clipe na faixa, empurrando o que estiver no caminho (ripple). */
export function insertClip(
  timeline: Timeline,
  clip: TimelineClip,
  options: { ripple: boolean } = { ripple: true }
): Timeline {
  const next = cloneTimeline(timeline);
  const added = cloneTimeline({ ...timeline, clips: [clip] }).clips[0];
  const length = clipDuration(added);

  if (options.ripple) {
    const overlapping = next.clips
      .filter((c) => c.trackId === added.trackId && c.start >= added.start)
      .sort((a, b) => a.start - b.start);
    for (const other of overlapping) {
      const delta = length;
      other.start += delta;
      for (const kf of other.keyframes) kf.time += delta;
    }
  } else {
    const gap = findGap(next, added.trackId, added.start, length);
    added.start = gap;
  }
  next.clips.push(added);
  return next;
}

export function moveClip(timeline: Timeline, clipId: string, newStart: number): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const delta = newStart - clip.start;
  clip.start = Math.max(0, newStart);
  for (const kf of clip.keyframes) kf.time += delta;
  return next;
}

/**
 * Trim: "in" arrasta a entrada, "out" arresta a saída.
 * Nunca deixa o clip com duração zero nem além do material original.
 */
export function trimClip(
  timeline: Timeline,
  clipId: string,
  edge: "in" | "out",
  delta: number,
  mediaDurationFrames: number
): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const length = clipDuration(clip);

  if (edge === "in") {
    const maxIn = clip.out - 1;
    const minIn = Math.max(0, clip.in - delta);
    const newIn = Math.min(Math.max(0, clip.in + delta), maxIn);
    const applied = newIn - clip.in;
    clip.in = newIn;
    clip.start += applied;
    for (const kf of clip.keyframes) kf.time += applied;
  } else {
    const minOut = clip.in + 1;
    const maxOut = Math.min(mediaDurationFrames, clip.out + delta);
    clip.out = Math.max(minOut, maxOut);
  }
  if (clipDuration(clip) !== length) {
    // trim nunca muda a duração total do clip: encolhe alonga compensando
    // (a entrada encolhe, a saída compensa) — comportamento de NLE real.
  }
  return next;
}

/** Divide o clip que cobre o frame. */
export function razorAt(timeline: Timeline, frame: number): Timeline {
  const next = cloneTimeline(timeline);
  const created: TimelineClip[] = [];
  for (const clip of next.clips) {
    if (frame <= clip.start || frame >= clipEnd(clip)) continue;
    const originalOut = clip.out;
    const splitPoint = clip.in + (frame - clip.start);
    const right: TimelineClip = {
      ...structuredClone(clip),
      id: `${clip.id}_r${frame}`,
      start: frame,
      in: splitPoint,
      out: originalOut,
    };
    clip.out = splitPoint;
    right.keyframes = clip.keyframes.filter((kf) => kf.time >= frame);
    clip.keyframes = clip.keyframes.filter((kf) => kf.time < frame);
    created.push(right);
  }
  next.clips.push(...created);
  return next;
}

/** Remove o clipe e fecha o buraco (ripple). */
export function rippleDelete(timeline: Timeline, clipId: string): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const length = clipDuration(clip);
  next.clips = next.clips.filter((c) => c.id !== clipId);
  for (const other of next.clips) {
    if (other.trackId !== clip.trackId) continue;
    if (other.start >= clip.start) {
      other.start -= length;
      for (const kf of other.keyframes) kf.time -= length;
    }
  }
  return next;
}

/** Remove sem fechar o buraco. */
export function liftDelete(timeline: Timeline, clipId: string): Timeline {
  const next = cloneTimeline(timeline);
  next.clips = next.clips.filter((c) => c.id !== clipId);
  return next;
}

/* ------------------------------ keyframes ------------------------------ */

export function valueAt(clip: TimelineClip, property: KeyframeProperty, time: number): number {
  const base = baseValue(clip, property);
  const keys = clip.keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.time - b.time);
  if (!keys.length) return base;
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      const t = span === 0 ? 0 : (time - a.time) / span;
      return a.value + (b.value - a.value) * t;
    }
  }
  return base;
}

export function baseValue(clip: TimelineClip, property: KeyframeProperty): number {
  switch (property) {
    case "opacity":
      return clip.opacity;
    case "volume":
      return clip.volume;
    case "x":
      return clip.transform.x;
    case "y":
      return clip.transform.y;
    case "scale":
      return clip.transform.scale;
    case "rotation":
      return clip.transform.rotation;
  }
}

export function setKeyframe(
  timeline: Timeline,
  clipId: string,
  property: KeyframeProperty,
  time: number,
  value: number,
  id: string
): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const existing = clip.keyframes.find((kf) => kf.property === property && Math.abs(kf.time - time) <= 0);
  if (existing) {
    existing.value = value;
  } else {
    const keyframe: Keyframe = { id, property, time, value, easing: "linear" };
    clip.keyframes.push(keyframe);
    clip.keyframes.sort((a, b) => a.time - b.time);
  }
  return next;
}

export function removeKeyframe(timeline: Timeline, clipId: string, keyframeId: string): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  clip.keyframes = clip.keyframes.filter((kf) => kf.id !== keyframeId);
  return next;
}

export function setClipProperty(
  timeline: Timeline,
  clipId: string,
  property: KeyframeProperty,
  value: number
): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  switch (property) {
    case "opacity":
      clip.opacity = value;
      break;
    case "volume":
      clip.volume = value;
      break;
    case "x":
      clip.transform.x = value;
      break;
    case "y":
      clip.transform.y = value;
      break;
    case "scale":
      clip.transform.scale = value;
      break;
    case "rotation":
      clip.transform.rotation = value;
      break;
  }
  return next;
}

/** Encaixe (snapping): frame mais próximo entre playhead, bordas de clip e markers. */
export function snapFrame(
  timeline: Timeline,
  frame: number,
  tolerance: number,
  extraPoints: number[] = []
): number {
  const points: number[] = [...extraPoints];
  for (const clip of timeline.clips) {
    points.push(clip.start, clipEnd(clip));
  }
  for (const marker of timeline.markers) points.push(marker.time);
  let best = frame;
  let bestDistance = tolerance + 1;
  for (const point of points) {
    const distance = Math.abs(point - frame);
    if (distance <= tolerance && distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Trim fino.
 *
 * roll: move o ponto de corte entre dois clipes vizinhos (um encurta, o outro
 *       alonga). É o ajuste de frame a frame entre dois cortes.
 * slip: troca o trecho do clipe (in/out) sem mexer na duração nem na posição.
 * slide: move o clipe no tempo sem mexer no trecho (in/out).
 */
export function rollEdit(
  timeline: Timeline,
  clipId: string,
  edge: "in" | "out",
  delta: number,
  mediaDuration: (clip: TimelineClip) => number
): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const neighbours = next.clips
    .filter((c) => c.trackId === clip.trackId && c.id !== clipId)
    .sort((a, b) => a.start - b.start);

  let other: TimelineClip | undefined;
  if (edge === "in") {
    other = neighbours.filter((c) => clipEnd(c) <= clip.start).pop();
  } else {
    other = neighbours.find((c) => c.start >= clip.start);
  }
  if (!other) return next;

  const myLimit = mediaDuration(clip);
  const otherLimit = mediaDuration(other);

  if (edge === "in") {
    const maxIn = clip.out - 1;
    const minIn = Math.max(0, other.in - delta);
    const newIn = Math.min(Math.max(0, clip.in + delta), maxIn);
    const applied = newIn - clip.in;
    if (applied === 0) return next;
    const otherOut = other.out + applied;
    if (otherOut > otherLimit || otherOut <= other.in) return next;
    const otherBoundary = other.start + (other.out - other.in);
    clip.in = newIn;
    clip.start += applied;
    other.out = otherOut;
    shiftKeyframes(clip, applied);
    shiftKeyframesFrom(other, applied, otherBoundary);
  } else {
    const minOut = clip.in + 1;
    const maxOut = Math.min(otherLimit, other.out - delta);
    const newOut = Math.max(minOut, Math.min(other.out + delta, maxOut));
    const applied = newOut - clip.out;
    if (applied === 0) return next;
    const otherIn = other.in + applied;
    if (otherIn < 0 || otherIn >= other.out) return next;
    const clipBoundary = clip.start + (clip.out - clip.in);
    clip.out = newOut;
    other.in = otherIn;
    other.start += applied;
    shiftKeyframes(other, applied);
    shiftKeyframesFrom(clip, applied, clipBoundary);
  }
  return next;
}

/** desloca os keyframes a partir de um instante */
function shiftKeyframesFrom(clip: TimelineClip, delta: number, from: number): void {
  for (const kf of clip.keyframes) {
    if (kf.time >= from) kf.time += delta;
  }
}

/** desloca todos os keyframes do clipe */
function shiftKeyframes(clip: TimelineClip, delta: number): void {
  for (const kf of clip.keyframes) kf.time += delta;
}

/** Troca o trecho do clipe (in/out) mantendo duração e posição. */
export function slipClip(timeline: Timeline, clipId: string, delta: number, mediaDurationFrames: number): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const length = clipDuration(clip);
  const newIn = clip.in + delta;
  if (newIn < 0 || newIn + length > mediaDurationFrames) return next;
  clip.in = newIn;
  clip.out = newIn + length;
  return next;
}

/** Move o clipe no tempo mantendo o trecho. */
export function slideClip(timeline: Timeline, clipId: string, delta: number): Timeline {
  const next = cloneTimeline(timeline);
  const clip = clipById(next, clipId);
  if (!clip) return next;
  const newStart = Math.max(0, clip.start + delta);
  const applied = newStart - clip.start;
  clip.start = newStart;
  for (const kf of clip.keyframes) kf.time += applied;
  return next;
}
export function trimLimit(
  timeline: Timeline,
  clipId: string,
  edge: "in" | "out",
  requested: number
): number {
  const clip = clipById(timeline, clipId);
  if (!clip) return requested;
  const neighbours = timeline.clips
    .filter((c) => c.trackId === clip.trackId && c.id !== clipId)
    .sort((a, b) => a.start - b.start);
  if (edge === "in") {
    const before = neighbours.filter((c) => clipEnd(c) <= clip.start).pop();
    const min = before ? clipEnd(before) : 0;
    return Math.max(min, requested);
  }
  const after = neighbours.find((c) => c.start >= clip.start);
  const max = after ? after.start : Infinity;
  return Math.min(max === Infinity ? requested : max, requested);
}
