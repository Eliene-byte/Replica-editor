/** Modelo de dados do Corte Leve. Espelha replica/schema.sql. */

export type MediaKind = "video" | "audio" | "image";
export type TrackKind = "video" | "audio";
export type KeyframeProperty = "opacity" | "volume" | "x" | "y" | "scale" | "rotation";

export interface ProjectSettings {
  fps: number;
  width: number;
  height: number;
  sampleRate: number;
  proxyEnabled: boolean;
  proxyScale: number;
  renderPath: string;
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  kind: MediaKind;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  hasAudio: boolean;
  thumb?: string;
  proxy?: string;
  status: "importing" | "ready" | "error";
  contentHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Bin {
  id: string;
  name: string;
  parentId: string | null;
  itemIds: string[];
}

export interface Keyframe {
  id: string;
  property: KeyframeProperty;
  time: number; // frame absoluto na timeline
  value: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ClipColor {
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  temperature: number;
  tint: number;
  curve: Array<{ x: number; y: number }> | null;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  mediaId: string;
  titleId?: string;
  start: number; // frame na timeline
  in: number; // frame de entrada na midia
  out: number; // frame de saida na midia (exclusivo)
  enabled: boolean;
  transform: { x: number; y: number; scale: number; rotation: number };
  opacity: number;
  volume: number;
  speed: number;
  color: ClipColor;
  keyframes: Keyframe[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  index: number;
  name: string;
  height: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  pan: number;
}

export interface Transition {
  id: string;
  clipAId: string;
  clipBId: string;
  kind: "cross" | "dip-to-black";
  durationFrames: number;
  position: number;
}

export interface Marker {
  id: string;
  time: number;
  color: string;
  label: string;
}

export interface Timeline {
  id: string;
  name: string;
  durationFrames: number;
  tracks: Track[];
  clips: TimelineClip[];
  transitions: Transition[];
  markers: Marker[];
}

export interface Title {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  media: MediaItem[];
  bins: Bin[];
  timelines: Timeline[];
  activeTimelineId: string;
  titles: Title[];
}

export type RenderStatus = "queued" | "rendering" | "done" | "failed" | "cancelled";

export interface RenderJob {
  id: string;
  projectId: string;
  timelineId: string;
  presetId: string;
  idempotencyKey: string;
  status: RenderStatus;
  progress: number;
  outputPath?: string;
  outputName?: string;
  error?: string;
  log: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  fps: 30,
  width: 1920,
  height: 1080,
  sampleRate: 48000,
  proxyEnabled: true,
  proxyScale: 4,
  renderPath: "renders",
};

export function emptyTimeline(id: string, fps: number): Timeline {
  return {
    id,
    name: "Timeline 1",
    durationFrames: 0,
    tracks: [
      { id: `${id}_v1`, kind: "video", index: 1, name: "V1", height: 64, muted: false, solo: false, locked: false, volume: 1, pan: 0 },
      { id: `${id}_a1`, kind: "audio", index: 1, name: "A1", height: 48, muted: false, solo: false, locked: false, volume: 1, pan: 0 },
    ],
    clips: [],
    transitions: [],
    markers: [],
  };
}
