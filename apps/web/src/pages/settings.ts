import { store } from "../core/state.ts";
import { el } from "../dom.ts";
import { toast } from "../components/toast.ts";

export interface SettingsDialog {
  open(): void;
}

/** Modal de configurações do projeto (S08). */
export function createSettingsDialog(): SettingsDialog {
  const dialog = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": "Configurações" });
  let lastFocused: HTMLElement | null = null;

  function close(): void {
    dialog.remove();
    lastFocused?.focus();
  }

  function open(): void {
    const project = store.state.project;
    if (!project) return;
    lastFocused = document.activeElement as HTMLElement;
    const settings = project.settings;

    const fps = el("input", { class: "field field--number", type: "number", min: "1", max: "120", value: String(settings.fps) }) as HTMLInputElement;
    const width = el("input", { class: "field field--number", type: "number", min: "16", value: String(settings.width) }) as HTMLInputElement;
    const height = el("input", { class: "field field--number", type: "number", min: "16", value: String(settings.height) }) as HTMLInputElement;
    const proxy = el("input", { type: "checkbox", class: "toggle" }) as HTMLInputElement;
    proxy.checked = settings.proxyEnabled;
    const proxyScale = el("input", {
      class: "field field--number",
      type: "number",
      min: "2",
      max: "16",
      value: String(settings.proxyScale),
    }) as HTMLInputElement;

    const save = el("button", { class: "btn btn--primary", type: "button" }, ["Salvar"]);
    save.addEventListener("click", () => {
      const next = structuredClone(store.state.project!);
      next.settings = {
        ...next.settings,
        fps: Number(fps.value) || next.settings.fps,
        width: Number(width.value) || next.settings.width,
        height: Number(height.value) || next.settings.height,
        proxyEnabled: proxy.checked,
        proxyScale: Number(proxyScale.value) || next.settings.proxyScale,
      };
      store.commitTimeline(store.timeline!); // força o autosave com o novo estado
      store.state.project = next;
      store.state.dirty = true;
      void store.save();
      toast("Configurações salvas", "success");
      close();
    });

    const cancel = el("button", { class: "btn", type: "button" }, ["Cancelar"]);
    cancel.addEventListener("click", close);

    dialog.append(
      el("div", { class: "dialog-panel" }, [
        el("h2", { class: "panel-title", text: "Configurações do projeto" }),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "FPS" }), fps]),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Largura" }), width]),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Altura" }), height]),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Usar proxy" }), proxy]),
        el("label", { class: "field-row" }, [el("span", { class: "field-label", text: "Divisor do proxy" }), proxyScale]),
        el("div", { class: "dialog-actions" }, [cancel, save]),
      ])
    );

    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    fps.focus();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog.isConnected) close();
  });

  return { open };
}
