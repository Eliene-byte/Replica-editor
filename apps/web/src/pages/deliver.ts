import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { el, clear } from "../dom.ts";
import { toast } from "../components/toast.ts";
import { formatDuration } from "../../../shared/time.ts";
import type { RenderJob } from "../../../shared/types.ts";

export interface DeliverPage {
  container: HTMLElement;
  destroy(): void;
}

/** Página de entrega (S07): presets, fila de render e download. */
export function createDeliverPage(): DeliverPage {
  const container = el("div", { class: "page page--deliver" });
  const queue = el("div", { class: "render-queue" });
  const presetsSelect = el("select", { class: "field", "aria-label": "Preset de exportação" }) as HTMLSelectElement;
  const nameInput = el("input", { class: "field", type: "text", value: "render", "aria-label": "Nome do arquivo" }) as HTMLInputElement;

  const startButton = el("button", { class: "btn btn--primary", type: "button" }, ["Iniciar export"]);
  startButton.addEventListener("click", async () => {
    const project = store.state.project;
    if (!project) {
      toast("Abra um projeto antes de exportar", "warning");
      return;
    }
    const timeline = store.timeline;
    if (!timeline || !timeline.clips.length) {
      toast("A timeline está vazia — nada para exportar", "warning");
      return;
    }
    try {
      startButton.setAttribute("disabled", "true");
      const { job } = await api.enqueueRender({
        projectId: project.id,
        timelineId: timeline.id,
        presetId: presetsSelect.value,
        outputName: nameInput.value.trim() || "render",
      });
      toast("Export enfileirado", "success");
      void renderQueue();
      void job;
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      startButton.removeAttribute("disabled");
    }
  });

  container.append(
    el("header", { class: "panel-header" }, [el("h2", { class: "panel-title", text: "Exportar" })]),
    el("div", { class: "deliver-grid" }, [
      el("div", { class: "panel deliver-form" }, [
        el("h3", { class: "panel-subtitle", text: "Novo export" }),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Preset" }), presetsSelect]),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Nome" }), nameInput]),
        startButton,
        el("p", { class: "muted small", text: "O export usa o ffmpeg do pacote (baixado pelo CI) ou o do sistema." }),
      ]),
      el("div", { class: "panel deliver-queue" }, [el("h3", { class: "panel-subtitle", text: "Fila" }), queue]),
    ])
  );

  async function loadPresets(): Promise<void> {
    try {
      const { presets } = await api.presets();
      clear(presetsSelect);
      for (const preset of presets) {
        presetsSelect.append(el("option", { value: preset.id, text: preset.label }));
      }
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function renderQueue(): Promise<void> {
    clear(queue);
    try {
      const { jobs } = await api.listJobs();
      if (!jobs.length) {
        queue.append(el("p", { class: "muted", text: "A fila está vazia." }));
        return;
      }
      for (const job of jobs) queue.append(renderJob(job));
    } catch (err) {
      queue.append(el("p", { class: "error", text: (err as Error).message }));
    }
  }

  function renderJob(job: RenderJob): HTMLElement {
    const statusLabel: Record<RenderJob["status"], string> = {
      queued: "na fila",
      rendering: "exportando",
      done: "pronto",
      failed: "falhou",
      cancelled: "cancelado",
    };
    const item = el("article", { class: `render-item render-item--${job.status}` }, [
      el("div", { class: "render-head" }, [
        el("strong", { text: job.outputName ?? job.presetId }),
        el("span", { class: `badge badge--${job.status}`, text: statusLabel[job.status] }),
      ]),
    ]);

    if (job.status === "rendering" || job.status === "queued") {
      const bar = el("div", { class: "progress" }, [el("div", { class: "progress-fill" })]);
      (bar.firstElementChild as HTMLElement).style.width = `${Math.round(job.progress * 100)}%`;
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuenow", String(Math.round(job.progress * 100)));
      item.append(bar);
    }

    if (job.status === "done" && job.outputPath) {
      const link = el("a", { class: "btn btn--primary", href: api.renderFileUrl(job.id), download: "" }, ["Baixar"]);
      item.append(link);
    }

    if (job.status === "failed") {
      item.append(el("p", { class: "error small", text: job.error ?? "falha desconhecida" }));
      const details = el("details", {}, [el("summary", { text: "log do ffmpeg" }), el("pre", { class: "log", text: job.log })]);
      item.append(details);
    }

    if (job.status === "queued" || job.status === "rendering") {
      const cancel = el("button", { class: "btn btn--danger", type: "button" }, ["Cancelar"]);
      cancel.addEventListener("click", async () => {
        await api.cancelJob(job.id);
        void renderQueue();
      });
      item.append(cancel);
    }

    return item;
  }

  const unsubscribe = store.on("project", () => void renderQueue());
  void loadPresets();
  void renderQueue();

  const timer = window.setInterval(() => void renderQueue(), 1500);

  return {
    container,
    destroy(): void {
      window.clearInterval(timer);
      unsubscribe();
    },
  };
}

export function describeDuration(job: RenderJob, fps: number): string {
  return formatDuration(0, fps);
}
