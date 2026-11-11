import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { el, clear } from "../dom.ts";
import { icon } from "../icons.ts";
import { formatDuration } from "../../../shared/time.ts";
import type { MediaItem } from "../../../shared/types.ts";

export interface MediaPool {
  container: HTMLElement;
  refresh(): void;
}

export function createMediaPool(handlers: {
  onOpen(media: MediaItem): void;
  onAppend(media: MediaItem): void;
}): MediaPool {
  const search = el("input", {
    class: "field",
    type: "search",
    placeholder: "filtrar por nome",
    "aria-label": "Filtrar mídia por nome",
  }) as HTMLInputElement;

  const grid = el("div", { class: "pool-grid" });
  const empty = el(
    "div",
    { class: "pool-empty" },
    [el("p", { text: "Nenhuma mídia ainda" }), el("small", { text: "Arraste arquivos aqui ou use Importar." })]
  );

  const listBtn = el("button", { class: "icon-btn", type: "button", "aria-label": "Alternar grade e lista", title: "Alternar grade e lista" }, ["☰"]);
  listBtn.addEventListener("click", () => {
    const isList = grid.classList.toggle("pool-grid--list");
    listBtn.classList.toggle("is-on", isList);
  });

  const container = el("div", { class: "pool" }, [
    el("div", { class: "pool-toolbar" }, [search, listBtn]),
    grid,
    empty,
  ]);
  let filter = "";

  search.addEventListener("input", () => {
    filter = search.value.trim().toLowerCase();
    render();
  });

  function render(): void {
    const project = store.state.project;
    clear(grid);
    if (!project) return;
    const items = project.media.filter((m) => !filter || m.name.toLowerCase().includes(filter));
    empty.style.display = items.length ? "none" : "flex";
    for (const item of items) {
      grid.append(renderItem(item, project.id));
    }
  }

  function renderItem(item: MediaItem, projectId: string): HTMLElement {
    const thumb = el("img", {
      class: "pool-thumb",
      src: api.thumbUrl(projectId, item.id),
      alt: `Miniatura de ${item.name}`,
      loading: "lazy",
      draggable: "false",
    });
    thumb.addEventListener("error", () => {
      thumb.replaceWith(el("div", { class: "pool-thumb pool-thumb--fallback" }, [icon("film", 18)]));
    });

    const card = el(
      "button",
      {
        class: "pool-item",
        type: "button",
        draggable: "true",
        title: `${item.name} — ${formatDuration(item.durationFrames, fps())}`,
      },
      [
        thumb,
        el("span", { class: "pool-name", text: item.name }),
        el("span", { class: "pool-meta", text: `${formatDuration(item.durationFrames, fps())} · ${item.width}×${item.height}` }),
      ]
    );

    card.addEventListener("click", () => {
      store.state.selectedMediaId = item.id;
      handlers.onOpen(item);
    });
    card.addEventListener("dblclick", () => handlers.onAppend(item));
    card.addEventListener("dragstart", (event) => {
      const dragEvent = event as DragEvent;
      dragEvent.dataTransfer?.setData("application/x-replica-media", item.id);
      dragEvent.dataTransfer?.setData("text/plain", item.name);
      if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = "copy";
    });

    if (store.state.selectedMediaId === item.id) card.classList.add("is-selected");
    return card;
  }

  function fps(): number {
    return store.state.project?.settings.fps ?? 30;
  }

  const unsubscribes = [store.on("project", render), store.on("timeline", render)];

  render();

  return {
    container,
    refresh(): void {
      render();
    },
    destroy(): void {
      unsubscribes.forEach((fn) => fn());
    },
  } as MediaPool & { destroy(): void };
}
