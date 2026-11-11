import { store } from "../core/state.ts";
import { el, clear } from "../dom.ts";
import { toast } from "../components/toast.ts";
import type { Timeline } from "../../../shared/types.ts";

export interface AudioPage {
  container: HTMLElement;
  destroy(): void;
}

/** Página de áudio (S06): mixer enxuto — nível, pan, mute e solo por faixa. */
export function createAudioPage(): AudioPage {
  const container = el("div", { class: "page page--audio" });
  const mixer = el("div", { class: "mixer" });

  container.append(
    el("header", { class: "panel-header" }, [el("h2", { class: "panel-title", text: "Áudio" })]),
    mixer
  );

  function commit(mutate: (timeline: Timeline) => void): void {
    const timeline = store.timeline;
    if (!timeline) return;
    const next = structuredClone(timeline);
    mutate(next);
    store.commitTimeline(next);
  }

  function render(): void {
    clear(mixer);
    const timeline = store.timeline;
    if (!timeline) {
      mixer.append(el("p", { class: "muted", text: "Abra um projeto." }));
      return;
    }
    const audioTracks = timeline.tracks.filter((t) => t.kind === "audio").sort((a, b) => a.index - b.index);
    if (!audioTracks.length) {
      mixer.append(el("p", { class: "muted", text: "Nenhuma faixa de áudio na timeline." }));
      return;
    }

    for (const track of audioTracks) {
      const strip = el("div", { class: "channel-strip" });

      const mute = el("input", { type: "checkbox", class: "toggle" }) as HTMLInputElement;
      mute.checked = track.muted;
      mute.setAttribute("aria-label", `Silenciar ${track.name}`);
      mute.addEventListener("change", () => {
        commit((t) => {
          const target = t.tracks.find((x) => x.id === track.id);
          if (target) target.muted = mute.checked;
        });
      });

      const solo = el("input", { type: "checkbox", class: "toggle" }) as HTMLInputElement;
      solo.checked = track.solo;
      solo.setAttribute("aria-label", `Solo em ${track.name}`);
      solo.addEventListener("change", () => {
        commit((t) => {
          const target = t.tracks.find((x) => x.id === track.id);
          if (target) target.solo = solo.checked;
        });
      });

      const fader = el("input", {
        type: "range",
        class: "range range--vertical",
        min: "0",
        max: "2",
        step: "0.01",
        value: String(track.volume),
      }) as HTMLInputElement;
      fader.setAttribute("aria-label", `Volume de ${track.name}`);
      const value = el("span", { class: "range-value", text: track.volume.toFixed(2) });
      fader.addEventListener("input", () => {
        const v = Number(fader.value);
        value.textContent = v.toFixed(2);
        commit((t) => {
          const target = t.tracks.find((x) => x.id === track.id);
          if (target) target.volume = v;
        });
      });

      const pan = el("input", {
        type: "range",
        class: "range",
        min: "-1",
        max: "1",
        step: "0.01",
        value: String(track.pan),
      }) as HTMLInputElement;
      pan.setAttribute("aria-label", `Panorama de ${track.name}`);
      const panValue = el("span", { class: "range-value", text: track.pan.toFixed(2) });
      pan.addEventListener("input", () => {
        const v = Number(pan.value);
        panValue.textContent = v.toFixed(2);
        commit((t) => {
          const target = t.tracks.find((x) => x.id === track.id);
          if (target) target.pan = v;
        });
      });

      strip.append(
        el("span", { class: "channel-name", text: track.name }),
        fader,
        value,
        el("label", { class: "range-row" }, [el("span", { class: "range-label", text: "pan" }), pan, panValue]),
        el("div", { class: "channel-toggles" }, [mute, solo])
      );
      mixer.append(strip);
    }

    const master = el("div", { class: "channel-strip channel-strip--master" }, [
      el("span", { class: "channel-name", text: "MESTRE" }),
      el("p", { class: "muted small", text: "Nível master fixo em 0 dB. Use o volume das faixas." }),
    ]);
    mixer.append(master);
  }

  const unsubscribes = [store.on("timeline", render), store.on("project", render)];
  render();

  return {
    container,
    destroy(): void {
      unsubscribes.forEach((fn) => fn());
      void toast;
    },
  };
}
