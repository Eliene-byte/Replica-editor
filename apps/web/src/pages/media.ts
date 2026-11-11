import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { el, clear } from "../dom.ts";
import { icon } from "../icons.ts";
import { toast } from "../components/toast.ts";
import { formatDuration } from "../../../shared/time.ts";

export interface MediaPage {
  container: HTMLElement;
  destroy(): void;
}

/** Página de mídia (S02): importar, organizar em bins e inspecionar. */
export function createMediaPage(navigate: (route: string) => void): MediaPage {
  const container = el("div", { class: "page page--media" });
  const bins = el("ul", { class: "bin-tree" });
  const grid = el("div", { class: "media-grid" });
  const status = el("p", { class: "muted small" });
  let activeBin: string | null = null;

  const newBinButton = el("button", { class: "btn", type: "button" }, ["Novo bin"]);
  newBinButton.addEventListener("click", async () => {
    const name = window.prompt("Nome do bin", "Material novo");
    if (!name) return;
    const project = store.state.project;
    if (!project) return;
    const bin = { id: `bin_${Date.now()}`, name: name.trim(), parentId: null, itemIds: [] };
    project.bins = [...project.bins, bin];
    activeBin = bin.id;
    store.state.dirty = true;
    await store.save();
    render();
    toast(`Bin "${bin.name}" criado`, "success");
  });

  const binsPanel = el("aside", { class: "panel panel--bins" }, [
    el("h3", { class: "panel-subtitle", text: "Bins" }),
    newBinButton,
    bins,
  ]);

  const fileInput = el("input", {
    type: "file",
    multiple: "true",
    accept: "video/*,audio/*,image/*",
    class: "visually-hidden",
  }) as HTMLInputElement;

  const importButton = el("button", { class: "btn btn--primary", type: "button" }, [icon("upload", 14), "Importar mídia"]);
  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) void importFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });

  const dropzone = el("div", { class: "dropzone" }, [
    el("strong", { text: "Arraste arquivos aqui" }),
    el("span", { class: "muted", text: "Vídeo, áudio ou imagem. O proxy é gerado em segundo plano." }),
    importButton,
    fileInput,
  ]);

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void importFiles(files);
  });

  container.append(
    el("header", { class: "panel-header" }, [
      el("h2", { class: "panel-title", text: "Mídia" }),
      el("button", { class: "btn", type: "button", onClick: () => navigate("#/edit") }, ["Ir para edição"]),
    ]),
    el("div", { class: "media-grid-layout" }, [
      binsPanel,
      el("div", { class: "panel panel--media" }, [dropzone, status, grid]),
    ])
  );

  async function importFiles(files: File[]): Promise<void> {
    const project = store.state.project;
    if (!project) {
      toast("Abra um projeto antes de importar", "warning");
      return;
    }
    status.textContent = `Importando ${files.length} arquivo(s)...`;
    try {
      const result = await api.importMedia(project.id, files);
      const imported = result.imported.length;
      const skipped = result.skipped.length;
      status.textContent = `${imported} importado(s)${skipped ? `, ${skipped} ignorado(s)` : ""}`;
      if (skipped) {
        toast(`${skipped} arquivo(s) ignorado(s): ${result.skipped[0].reason}`, "warning");
      } else {
        toast(`${imported} arquivo(s) importado(s)`, "success");
      }
      const { project: fresh } = await api.loadProject(project.id);
      store.setProject(fresh);
    } catch (err) {
      status.textContent = "";
      toast((err as Error).message, "error");
    }
  }

  function render(): void {
    const project = store.state.project;
    clear(bins);
    clear(grid);
    if (!project) return;

    const allItem = el("li", { class: `bin-item${activeBin === null ? " is-active" : ""}` }, ["Todos os arquivos"]);
    allItem.addEventListener("click", () => {
      activeBin = null;
      render();
    });
    bins.append(allItem);

    for (const bin of project.bins) {
      const item = el("li", { class: `bin-item${activeBin === bin.id ? " is-active" : ""}` }, [
        `${bin.name} (${bin.itemIds.length})`,
      ]);
      item.addEventListener("click", () => {
        activeBin = bin.id;
        render();
      });
      bins.append(item);
    }
    if (!project.bins.length) {
      bins.append(el("li", { class: "muted small", text: "Nenhum bin ainda" }));
    }

    const visible = activeBin
      ? project.media.filter((m) => project.bins.find((b) => b.id === activeBin)?.itemIds.includes(m.id))
      : project.media;

    if (!visible.length) {
      grid.append(
        el("div", { class: "empty-state" }, [
          el("p", { text: activeBin ? "Este bin está vazio" : "Nenhuma mídia importada" }),
          el("small", { text: activeBin ? "Mova mídia para cá no painel ao lado." : "Use o botão Importar mídia ou arraste arquivos." }),
        ])
      );
      return;
    }

    for (const item of visible) {
      const addToBin = el("button", { class: "btn btn--ghost", type: "button" }, ["+ bin"]);
      addToBin.addEventListener("click", async (event) => {
        event.stopPropagation();
        const project = store.state.project;
        if (!project) return;
        let bin = activeBin ? project.bins.find((b) => b.id === activeBin) : undefined;
        if (!bin) {
          const name = window.prompt("Nome do bin", "Material novo");
          if (!name) return;
          bin = { id: `bin_${Date.now()}`, name: name.trim(), parentId: null, itemIds: [] };
          project.bins = [...project.bins, bin];
          activeBin = bin.id;
        }
        if (!bin.itemIds.includes(item.id)) bin.itemIds = [...bin.itemIds, item.id];
        store.state.dirty = true;
        await store.save();
        render();
        toast(`${item.name} movido para "${bin.name}"`, "success");
      });

      const card = el("article", { class: "media-card" }, [
        el("img", { class: "media-thumb", src: api.thumbUrl(project.id, item.id), alt: `Miniatura de ${item.name}` }),
        el("h4", { text: item.name }),
        el("p", {
          class: "muted small",
          text: `${formatDuration(item.durationFrames, project.settings.fps)} · ${item.width}×${item.height}${
            item.hasAudio ? " · com som" : ""
          }`,
        }),
        el("p", { class: "muted small", text: item.proxy ? "proxy pronto" : item.status === "ready" ? "sem proxy" : item.status }),
        addToBin,
      ]);
      grid.append(card);
    }
  }

  const unsubscribe = store.on("project", render);
  render();

  return {
    container,
    destroy(): void {
      unsubscribe();
    },
  };
}
