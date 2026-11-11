import { el } from "../dom.ts";

export type ToastKind = "info" | "success" | "warning" | "error";

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = el("div", { class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(container);
  }
  return container;
}

export function toast(message: string, kind: ToastKind = "info", timeoutMs = 3200): void {
  const host = ensureContainer();
  const node = el("div", { class: `toast toast--${kind}`, role: kind === "error" ? "alert" : "status" }, [message]);
  host.append(node);
  const remove = (): void => {
    node.classList.add("is-leaving");
    window.setTimeout(() => node.remove(), 180);
  };
  node.addEventListener("click", remove);
  window.setTimeout(remove, kind === "error" ? Math.max(timeoutMs, 6000) : timeoutMs);
}
