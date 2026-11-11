import type { Project, Timeline } from "../../../shared/types.ts";
import { api } from "./api.ts";

export type Tool = "select" | "razor" | "roll" | "slip" | "slide";
export type PageId = "media" | "cut" | "edit" | "color" | "audio" | "deliver";

export interface AppState {
  project: Project | null;
  page: PageId;
  selectedClipIds: string[];
  selectedMediaId: string | null;
  sourceMediaId: string | null;
  sourceIn: number | null;
  sourceOut: number | null;
  playhead: number;
  zoom: number; // pixels por frame
  tool: Tool;
  snap: boolean;
  ripple: boolean;
  playing: boolean;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
}

type Listener = () => void;

const HISTORY_LIMIT = 60;

class Store {
  state: AppState = {
    project: null,
    page: "edit",
    selectedClipIds: [],
    selectedMediaId: null,
    sourceMediaId: null,
    sourceIn: null,
    sourceOut: null,
    playhead: 0,
    zoom: 2,
    tool: "select",
    snap: true,
    ripple: true,
    playing: false,
    dirty: false,
    saving: false,
    lastSavedAt: null,
  };

  private listeners = new Map<string, Set<Listener>>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private saveTimer: number | null = null;

  on(event: string, listener: Listener): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((fn) => fn());
    if (event !== "*") this.listeners.get("*")?.forEach((fn) => fn());
  }

  get timeline(): Timeline | null {
    const project = this.state.project;
    if (!project) return null;
    return project.timelines.find((t) => t.id === project.activeTimelineId) ?? project.timelines[0] ?? null;
  }

  setProject(project: Project | null): void {
    this.state.project = project;
    this.undoStack = [];
    this.redoStack = [];
    this.state.selectedClipIds = [];
    this.state.playhead = 0;
    this.state.dirty = false;
    this.emit("project");
    this.emit("timeline");
  }

  /** Aplica uma nova timeline e registra no histórico (undo/redo). */
  commitTimeline(next: Timeline, options: { history?: boolean } = {}): void {
    const project = this.state.project;
    const timeline = this.timeline;
    if (!project || !timeline) return;
    if (options.history !== false) {
      this.undoStack.push(JSON.stringify({ id: timeline.id, data: timeline }));
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    }
    const index = project.timelines.findIndex((t) => t.id === timeline.id);
    if (index >= 0) project.timelines[index] = next;
    this.state.dirty = true;
    this.emit("timeline");
    this.scheduleSave();
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    const current = this.timeline;
    if (current) this.redoStack.push(JSON.stringify({ id: current.id, data: current }));
    const parsed = JSON.parse(snapshot) as { id: string; data: Timeline };
    const project = this.state.project;
    if (!project) return;
    const index = project.timelines.findIndex((t) => t.id === parsed.id);
    if (index >= 0) project.timelines[index] = parsed.data;
    this.state.selectedClipIds = [];
    this.state.dirty = true;
    this.emit("timeline");
    this.scheduleSave();
  }

  redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    const current = this.timeline;
    if (current) this.undoStack.push(JSON.stringify({ id: current.id, data: current }));
    const parsed = JSON.parse(snapshot) as { id: string; data: Timeline };
    const project = this.state.project;
    if (!project) return;
    const index = project.timelines.findIndex((t) => t.id === parsed.id);
    if (index >= 0) project.timelines[index] = parsed.data;
    this.state.dirty = true;
    this.emit("timeline");
    this.scheduleSave();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Snapshot da timeline atual, para voltar a um estado durante um arrasto. */
  snapshotTimeline(): string | null {
    const timeline = this.timeline;
    if (!timeline) return null;
    return JSON.stringify({ id: timeline.id, data: timeline });
  }

  /** Coloca um snapshot no histórico (usado no fim de um arrasto longo). */
  pushHistory(snapshot: string): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  select(clipIds: string[]): void {
    this.state.selectedClipIds = clipIds;
    this.emit("selection");
  }

  setPlayhead(frame: number): void {
    const max = this.timeline?.durationFrames ?? 0;
    this.state.playhead = Math.max(0, Math.min(max, Math.round(frame)));
    this.emit("playhead");
  }

  setTool(tool: Tool): void {
    this.state.tool = tool;
    this.emit("tool");
  }

  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.2, Math.min(40, zoom));
    this.emit("timeline");
  }

  scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.save(), 700);
  }

  async save(): Promise<void> {
    const project = this.state.project;
    if (!project || !this.state.dirty) return;
    this.state.saving = true;
    this.emit("saving");
    try {
      const response = await api.saveProject(project.id, {
        timelines: project.timelines,
        bins: project.bins,
        settings: project.settings,
        activeTimelineId: project.activeTimelineId,
        titles: project.titles,
      });
      this.state.project = response.project;
      this.state.dirty = false;
      this.state.lastSavedAt = new Date().toISOString();
    } catch (err) {
      this.emit("error");
      console.error("falha ao salvar", err);
    } finally {
      this.state.saving = false;
      this.emit("saving");
    }
  }
}

export const store = new Store();
