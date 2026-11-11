import { store } from "../core/state.ts";
import { el, clear } from "../dom.ts";
import type { Keyframe, KeyframeProperty, TimelineClip } from "../../../shared/types.ts";
import { removeKeyframe, setClipProperty, setKeyframe, valueAt } from "../core/model.ts";import { formatTimecode } from "../../../shared/time.ts";

export interface Inspector {
  container: HTMLElement;
}

/** Campos numéricos com rótulo, valor e botão de keyframe. */
function numberField(
  label: string,
  value: number,
  onChange: (value: number) => void,
  options: { step?: number; min?: number; max?: number; keyframe?: () => void } = {}
): HTMLElement {
  const input = el("input", {
    class: "field field--number",
    type: "number",
    value: String(value),
    step: String(options.step ?? 1),
    min: options.min !== undefined ? String(options.min) : undefined,
    max: options.max !== undefined ? String(options.max) : undefined,
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) onChange(parsed);
  });
  const row = el("div", { class: "field-row" }, [el("label", { class: "field-label", text: label }), input]);
  if (options.keyframe) {
    const button = el("button", { class: "icon-btn icon-btn--tiny", type: "button", title: "Adicionar keyframe" }, ["◆"]);
    button.addEventListener("click", options.keyframe);
    row.append(button);
  }
  return row;
}

export function createInspector(): Inspector {
  const container = el("aside", { class: "inspector", "aria-label": "Propriedades do clipe" });

  function render(): void {
    clear(container);
    const project = store.state.project;
    if (!project) return;
    const timeline = store.timeline;
    const clip = timeline?.clips.find((c) => c.id === store.state.selectedClipIds[0]) ?? null;

    if (!clip) {
      container.append(
        el("h2", { class: "panel-title", text: "Propriedades" }),
        el("p", { class: "muted", text: "Selecione um clipe na timeline para editar." })
      );
      return;
    }

    const media = project.media.find((m) => m.id === clip.mediaId);
    const fps = project.settings.fps;

    container.append(
      el("h2", { class: "panel-title", text: "Propriedades" }),
      el("p", { class: "muted small", text: media?.name ?? "clipe" }),
      el("p", {
        class: "muted small",
        text: `entrada ${formatTimecode(clip.in, fps)} · saída ${formatTimecode(clip.out, fps)} · duração ${formatTimecode(
          clip.out - clip.in,
          fps
        )}`,
      })
    );

    const commit = (next: any): void => store.commitTimeline(next);

    container.append(el("h3", { class: "panel-subtitle", text: "Vídeo" }));
    container.append(
      numberField("Posição X", clip.transform.x, (v) => commit(setClipProperty(store.timeline!, clip.id, "x", v)), {
        step: 1,
        keyframe: () => addKeyframe(clip, "x"),
      }),
      numberField("Posição Y", clip.transform.y, (v) => commit(setClipProperty(store.timeline!, clip.id, "y", v)), {
        step: 1,
        keyframe: () => addKeyframe(clip, "y"),
      }),
      numberField("Escala", clip.transform.scale, (v) => commit(setClipProperty(store.timeline!, clip.id, "scale", v)), {
        step: 0.05,
        min: 0.05,
        max: 10,
        keyframe: () => addKeyframe(clip, "scale"),
      }),
      numberField("Rotação", clip.transform.rotation, (v) => commit(setClipProperty(store.timeline!, clip.id, "rotation", v)), {
        step: 1,
        keyframe: () => addKeyframe(clip, "rotation"),
      }),
      numberField("Opacidade", clip.opacity, (v) => commit(setClipProperty(store.timeline!, clip.id, "opacity", v)), {
        step: 0.05,
        min: 0,
        max: 1,
        keyframe: () => addKeyframe(clip, "opacity"),
      })
    );

    container.append(el("h3", { class: "panel-subtitle", text: "Áudio e velocidade" }));
    container.append(
      numberField("Volume", clip.volume, (v) => commit(setClipProperty(store.timeline!, clip.id, "volume", v)), {
        step: 0.05,
        min: 0,
        max: 2,
        keyframe: () => addKeyframe(clip, "volume"),
      }),
      numberField("Velocidade", clip.speed, (v) => {
        const next = structuredClone(store.timeline!);
        const target = next.clips.find((c) => c.id === clip.id);
        if (target) target.speed = v;
        commit(next);
      }, { step: 0.05, min: 0.1, max: 4 })
    );

    const enabled = el("input", { type: "checkbox", class: "toggle" }) as HTMLInputElement;
    enabled.checked = clip.enabled;
    enabled.addEventListener("change", () => {
      const next = structuredClone(store.timeline!);
      const target = next.clips.find((c) => c.id === clip.id);
      if (target) target.enabled = enabled.checked;
      commit(next);
    });
    container.append(el("label", { class: "field-row" }, [enabled, el("span", { text: "Clip habilitado" })]));

    if (clip.keyframes.length) {
      container.append(el("h3", { class: "panel-subtitle", text: "Keyframes" }));
      const list = el("ul", { class: "kf-list" });
      for (const kf of clip.keyframes) {
        const remove = el("button", { class: "icon-btn icon-btn--tiny", type: "button", title: "Remover keyframe" }, ["×"]);
        remove.addEventListener("click", () => {
          store.commitTimeline(removeKeyframe(store.timeline!, clip.id, kf.id));
        });
        list.append(
          el("li", {}, [
            el("span", { text: `${kf.property} · ${formatTimecode(kf.time, fps)} = ${kf.value.toFixed(2)}` }),
            remove,
          ])
        );
      }
      container.append(list);
    }

    container.append(el("h3", { class: "panel-subtitle", text: "Curva" }));
    container.append(keyframeCurve(clip, fps));
  }

  /**
   * Editor de curva: mostra a propriedade ao longo do clipe e deixa arrastar
   * os pontos. Arrastar um ponto muda o valor no frame; clicar fora cria um
   * keyframe novo.
   */
  function keyframeCurve(clip: TimelineClip, fps: number): HTMLElement {
    const properties: KeyframeProperty[] = ["opacity", "volume", "x", "y", "scale"];
    let property: KeyframeProperty = "opacity";

    const canvas = el("canvas", { class: "kf-canvas", width: "248", height: "96" }) as HTMLCanvasElement;
    const select = el("select", { class: "field", "aria-label": "Propriedade da curva" }) as HTMLSelectElement;
    for (const item of properties) {
      select.append(el("option", { value: item, text: item }));
    }

    const duration = Math.max(1, clip.out - clip.in);
    const start = clip.start;

    const points = (): Keyframe[] =>
      clip.keyframes
        .filter((kf) => kf.property === property)
        .sort((a, b) => a.time - b.time);

    function draw(): void {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim() || "#1d222a";
      ctx.fillRect(0, 0, w, h);

      // linha do tempo
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#262c36";
      ctx.beginPath();
      ctx.moveTo(0, h - 16);
      ctx.lineTo(w, h - 16);
      ctx.stroke();

      // curva
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--wave").trim() || "#5ec8b5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const time = start + (duration * i) / steps;
        const value = valueAt(clip, property, time);
        const x = (i / steps) * w;
        const y = h - 16 - value * (h - 24);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // pontos
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ffb020";
      for (const point of points()) {
        const x = ((point.time - start) / duration) * w;
        const y = h - 16 - point.value * (h - 24);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // cursor
      const cursorX = ((store.state.playhead - start) / duration) * w;
      if (cursorX >= 0 && cursorX <= w) {
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--playhead").trim() || "#ff4d6d";
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, h);
        ctx.stroke();
      }
    }

    function timeFromX(x: number): number {
      return Math.round(start + (x / canvas.width) * duration);
    }

    function valueFromY(y: number): number {
      return Math.min(1, Math.max(0, (canvas.height - 16 - y) / (canvas.height - 24)));
    }

    canvas.addEventListener("pointerdown", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const time = timeFromX(x);
      const value = valueFromY(y);
      const near = points().find((p) => Math.abs(((p.time - start) / duration) * canvas.width - x) < 6);
      const targetTime = near ? near.time : time;
      const id = near ? near.id : `kf_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
      store.commitTimeline(setKeyframe(store.timeline!, clip.id, property, targetTime, value, id));
    });

    select.addEventListener("change", () => {
      property = select.value as KeyframeProperty;
      draw();
    });

    draw();
    const unsubscribe = store.on("playhead", draw);
    const box = el("div", { class: "kf-editor" }, [select, canvas]);
    // a assinatura da página recria o inspetor a cada mudanca; o desenho
    // acompanha o cursor enquanto o inspetor existir
    queueMicrotask(() => {
      const observer = new MutationObserver(() => {
        if (!canvas.isConnected) {
          unsubscribe();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    return box;
  }

  function addKeyframe(clip: TimelineClip, property: KeyframeProperty): void {
    const timeline = store.timeline;
    if (!timeline) return;
    const time = store.state.playhead;
    const value = valueAt(clip, property, time);
    store.commitTimeline(setKeyframe(timeline, clip.id, property, time, value, `kf_${Date.now()}`));
  }

  const unsubscribes = [store.on("selection", render), store.on("timeline", render), store.on("project", render)];
  render();

  return {
    container,
    destroy(): void {
      unsubscribes.forEach((fn) => fn());
    },
  } as Inspector & { destroy(): void };
}
