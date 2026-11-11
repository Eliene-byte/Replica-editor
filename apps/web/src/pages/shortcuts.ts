import { el } from "../dom.ts";
import { store } from "../core/state.ts";
import { razorAt } from "../core/model.ts";

export interface ShortcutHandlers {
  togglePlay(): void;
  stop(): void;
  deleteSelected(): void;
  addMarker(): void;
}

const SHORTCUTS: Array<[string, string]> = [
  ["Espaço", "reproduzir / pausar"],
  ["J / K / L", "parar / reproduzir"],
  ["← / →", "mover o cursor 1 frame"],
  ["Shift + ← / →", "mover o cursor 1 segundo"],
  ["I / O", "marcar entrada / saída"],
  ["B", "ferramenta de corte"],
  ["V", "ferramenta de seleção"],
  ["R / Y / U", "ajuste fino: roll, slip, slide"],
  ["N", "ligar / desligar encaixe"],
  ["M", "marcar ponto"],
  ["Delete", "remover clipe selecionado"],
  ["Ctrl + Z", "desfazer"],
  ["Ctrl + Shift + Z", "refazer"],
  ["Ctrl + = / -", "aproximar / afastar"],
  ["?", "esta lista"],
];

export function installShortcuts(handlers: ShortcutHandlers): () => void {
  const onKey = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (target?.isContentEditable) return;

    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (key === "=" || key === "+")) {
      event.preventDefault();
      store.setZoom(store.state.zoom * 1.25);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "-") {
      event.preventDefault();
      store.setZoom(store.state.zoom / 1.25);
      return;
    }
    if (event.ctrlKey || event.metaKey) return;

    switch (key) {
      case " ":
        event.preventDefault();
        handlers.togglePlay();
        break;
      case "k":
        handlers.stop();
        break;
      case "v":
        store.setTool("select");
        break;
      case "b": {
        store.setTool("razor");
        break;
      }
      case "r":
        store.setTool("roll");
        break;
      case "y":
        store.setTool("slip");
        break;
      case "u":
        store.setTool("slide");
        break;
      case "n":
        store.state.snap = !store.state.snap;
        store.emit("tool");
        break;
      case "m":
        handlers.addMarker();
        break;
      case "delete":
      case "backspace":
        event.preventDefault();
        handlers.deleteSelected();
        break;
      case "arrowleft":
        event.preventDefault();
        store.setPlayhead(store.state.playhead - (event.shiftKey ? fps() : 1));
        break;
      case "arrowright":
        event.preventDefault();
        store.setPlayhead(store.state.playhead + (event.shiftKey ? fps() : 1));
        break;
      default:
        break;
    }
  };

  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}

function fps(): number {
  return store.state.project?.settings.fps ?? 30;
}

export interface ShortcutsOverlay {
  container: HTMLElement;
  toggle(): void;
}

export function createShortcutsOverlay(): ShortcutsOverlay {
  const table = el("table", { class: "shortcut-table" }, [
    el("thead", {}, [el("tr", {}, [el("th", { text: "Atalho" }), el("th", { text: "Ação" })])]),
    el(
      "tbody",
      {},
      SHORTCUTS.map(([key, action]) => el("tr", {}, [el("td", {}, [el("kbd", { text: key })]), el("td", { text: action })]))
    ),
  ]);

  const container = el("div", { class: "dialog dialog--sheet", role: "dialog", "aria-modal": "true", "aria-label": "Atalhos" }, [
    el("div", { class: "dialog-panel" }, [
      el("h2", { class: "panel-title", text: "Atalhos de teclado" }),
      table,
      el("div", { class: "dialog-actions" }, [
        el("button", { class: "btn", type: "button", onClick: () => container.remove() }, ["Fechar"]),
      ]),
    ]),
  ]);

  return {
    container,
    toggle(): void {
      if (container.isConnected) container.remove();
      else document.body.append(container);
    },
  };
}

export function razorAtPlayhead(): void {
  const timeline = store.timeline;
  if (!timeline) return;
  store.commitTimeline(razorAt(timeline, store.state.playhead));
}
