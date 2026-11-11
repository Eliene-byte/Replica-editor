import { store } from "../core/state.ts";
import { el, clear } from "../dom.ts";
import { createViewer } from "../components/viewer.ts";
import { toast } from "../components/toast.ts";
import { formatTimecode } from "../../../shared/time.ts";

export interface ColorPage {
  container: HTMLElement;
  destroy(): void;
}

/**
 * Página de cor (S05) — versão enxuta do painel de correção:
 * elevação, ganho, temperatura, tinta e saturação por clipe.
 * Sem nodes, sem PowerWindows, sem tracking: fora do escopo do hardware-alvo.
 */
export function createColorPage(): ColorPage {
  const container = el("div", { class: "page page--color" });
  const viewer = createViewer();
  const controls = el("div", { class: "color-controls" });

  container.append(
    el("header", { class: "panel-header" }, [el("h2", { class: "panel-title", text: "Cor" })]),
    el("div", { class: "color-grid" }, [el("div", { class: "panel" }, [viewer.container]), controls])
  );

  function selectedClip() {
    const timeline = store.timeline;
    if (!timeline) return null;
    return timeline.clips.find((c) => c.id === store.state.selectedClipIds[0]) ?? null;
  }

  function render(): void {
    clear(controls);
    const timeline = store.timeline;
    const clip = selectedClip();
    const project = store.state.project;

    if (!project || !timeline) {
      controls.append(el("p", { class: "muted", text: "Abra um projeto." }));
      return;
    }
    if (!clip) {
      controls.append(
        el("p", { class: "muted", text: "Selecione um clipe na timeline para corrigir a cor dele." })
      );
      return;
    }

    const media = project.media.find((m) => m.id === clip.mediaId);
    controls.append(
      el("h3", { class: "panel-subtitle", text: media?.name ?? "clipe" }),
      el("p", {
        class: "muted small",
        text: `in ${formatTimecode(clip.in, project.settings.fps)} · out ${formatTimecode(clip.out, project.settings.fps)}`,
      })
    );

    const apply = (patch: Partial<typeof clip.color>): void => {
      const next = structuredClone(store.timeline!);
      const target = next.clips.find((c) => c.id === clip.id);
      if (!target) return;
      target.color = { ...target.color, ...patch };
      store.commitTimeline(next);
      preview();
    };

    const slider = (label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement => {
      const input = el("input", { type: "range", class: "range", min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
      input.value = String(value);
      const output = el("span", { class: "range-value", text: value.toFixed(2) });
      input.addEventListener("input", () => {
        const v = Number(input.value);
        output.textContent = v.toFixed(2);
        onInput(v);
      });
      return el("label", { class: "range-row" }, [el("span", { class: "range-label", text: label }), input, output]);
    };

    const lift = clip.color.lift[0];
    const gain = clip.color.gain[0];
    const saturation = 1 + clip.color.gamma[0];

    controls.append(
      slider("Elevação", lift, -0.5, 0.5, 0.01, (v) => apply({ lift: [v, clip.color.lift[1], clip.color.lift[2]] })),
      slider("Ganho", gain, 0, 2, 0.01, (v) => apply({ gain: [v, clip.color.gain[1], clip.color.gain[2]] })),
      slider("Saturação", saturation, 0, 2, 0.01, (v) => apply({ gamma: [v - 1, clip.color.gamma[1], clip.color.gamma[2]] })),
      slider("Temperatura", clip.color.temperature, -50, 50, 1, (v) => apply({ temperature: v })),
      slider("Tinta", clip.color.tint, -50, 50, 1, (v) => apply({ tint: v }))
    );

    const reset = el("button", { class: "btn", type: "button" }, ["Redefinir cor"]);
    reset.addEventListener("click", () => {
      apply({
        lift: [0, 0, 0],
        gamma: [0, 0, 0],
        gain: [1, 1, 1],
        temperature: 0,
        tint: 0,
      });
      toast("Cor redefinida", "info");
    });
    controls.append(reset);
    preview();
  }

  function preview(): void {
    const clip = selectedClip();
    if (!clip || !viewer.video) return;
    const c = clip.color;
    const gain = c.gain[0];
    const contrast = 1 + (gain - 1) * 0.6;
    const brightness = 1 + c.lift[0] + c.temperature * 0.004;
    const saturation = 1 + c.gamma[0];
    const sepia = Math.max(0, c.temperature) * 0.004;
    const hue = c.tint * 0.6;
    viewer.video.style.filter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(
      3
    )}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`;
  }

  const unsubscribes = [
    store.on("selection", render),
    store.on("timeline", render),
    store.on("project", render),
  ];
  render();

  return {
    container,
    destroy(): void {
      unsubscribes.forEach((fn) => fn());
    },
  };
}
