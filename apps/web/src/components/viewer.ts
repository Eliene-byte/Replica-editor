import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { icon, iconButton } from "../icons.ts";
import { el } from "../dom.ts";
import { formatTimecode } from "../../../shared/time.ts";
import type { MediaItem } from "../../../shared/types.ts";

export interface Viewer {
  container: HTMLElement;
  video: HTMLVideoElement;
  show(media: MediaItem | null): void;
  toggle(): void;
  seekSeconds(seconds: number): void;
  currentSeconds(): number;
}

export function createViewer(): Viewer {
  const video = document.createElement("video");
  video.className = "viewer-video";
  video.preload = "metadata";
  video.playsInline = true;
  video.controls = false;

  const timecode = el("span", { class: "timecode", text: "00:00:00:00" });
  const bar = el("div", { class: "viewer-transport" });

  const scrub = el("input", {
    class: "scrub",
    type: "range",
    min: "0",
    max: "1000",
    value: "0",
    "aria-label": "Posição da reprodução",
  }) as HTMLInputElement;
  scrub.addEventListener("input", () => {
    const media = store.state.project?.media.find((m) => m.id === store.state.sourceMediaId);
    if (!media) return;
    viewer.seekSeconds((Number(scrub.value) / 1000) * (media.durationFrames / (media.fps || fps())));
  });

  const playBtn = iconButton("play", "Reproduzir (espaço)", () => viewer.toggle());
  const inBtn = iconButton("start", "Marcar entrada (I)", () => markIn());
  const outBtn = iconButton("end", "Marcar saída (O)", () => markOut());
  const markLabel = el("span", { class: "viewer-marks", text: "entrada — / saída —" });

  bar.append(playBtn, inBtn, outBtn, markLabel, el("span", { class: "spacer" }), timecode);

  const empty = el(
    "div",
    { class: "viewer-empty" },
    [el("p", { text: "Nada carregado" }), el("small", { text: "Escolha um clipe no pool de mídia." })]
  );

  const container = el("div", { class: "viewer" }, [video, empty, el("div", { class: "viewer-scrub" }, [scrub]), bar]);
  let current: MediaItem | null = null;

  function projectId(): string {
    return store.state.project?.id ?? "";
  }

  function markIn(): void {
    const seconds = viewer.currentSeconds();
    store.state.sourceIn = Math.max(0, Math.round(seconds * fps()));
    updateMarks();
  }

  function markOut(): void {
    const seconds = viewer.currentSeconds();
    store.state.sourceOut = Math.max(0, Math.round(seconds * fps()));
    updateMarks();
  }

  function updateMarks(): void {
    const rate = fps();
    const inn = store.state.sourceIn;
    const out = store.state.sourceOut;
    markLabel.textContent = `entrada ${inn === null ? "—" : formatTimecode(inn, rate)} / saída ${
      out === null ? "—" : formatTimecode(out, rate)
    }`;
  }

  function fps(): number {
    return store.state.project?.settings.fps ?? 30;
  }

  const viewer: Viewer = {
    container,
    video,
    show(media: MediaItem | null): void {
      current = media;
      if (media) store.state.sourceMediaId = media.id;
      empty.style.display = media ? "none" : "flex";
      if (!media) {
        video.removeAttribute("src");
        video.load();
        updateMarks();
        return;
      }
      const pid = projectId();
      // proxy quando existe (hardware fraco), senão o original
      const proxy = media.proxy ? api.proxyUrl(pid, media.id) : api.streamUrl(pid, media.id);
      video.src = proxy;
      video.load();
      video.addEventListener("loadedmetadata", updateMarks, { once: true });
      updateMarks();
    },
    toggle(): void {
      if (!current) return;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    },
    seekSeconds(seconds: number): void {
      if (!current) return;
      video.currentTime = Math.max(0, seconds);
    },
    currentSeconds(): number {
      return video.currentTime || 0;
    },
  };

  video.addEventListener("play", () => {
    playBtn.replaceChildren(icon("pause"));
    playBtn.title = "Pausar (espaço)";
  });
  video.addEventListener("pause", () => {
    playBtn.replaceChildren(icon("play"));
    playBtn.title = "Reproduzir (espaço)";
  });
  video.addEventListener("timeupdate", () => {
    const media = store.state.project?.media.find((m) => m.id === store.state.sourceMediaId);
    if (media && media.durationFrames > 0) {
      const ratio = viewer.currentSeconds() / (media.durationFrames / (media.fps || fps()));
      scrub.value = String(Math.round(Math.min(1, Math.max(0, ratio)) * 1000));
    }
    if (store.state.playing) return;
    timecode.textContent = formatTimecode(Math.round(viewer.currentSeconds() * fps()), fps());
  });

  return viewer;
}
