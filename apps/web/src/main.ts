import { store, type PageId } from "./core/state.ts";
import { el, clear } from "./dom.ts";
import { icon, iconButton } from "./icons.ts";
import { toast } from "./components/toast.ts";
import { createManagerPage } from "./pages/manager.ts";
import { createMediaPage } from "./pages/media.ts";
import { createEditPage } from "./pages/edit.ts";
import { createColorPage } from "./pages/color.ts";
import { createAudioPage } from "./pages/audio.ts";
import { createDeliverPage } from "./pages/deliver.ts";
import { createSettingsDialog } from "./pages/settings.ts";
import { createShortcutsOverlay, installShortcuts } from "./pages/shortcuts.ts";
import { api } from "./core/api.ts";

const ROUTES: Array<{ id: PageId | "manager"; hash: string; label: string; icon: string }> = [
  { id: "media", hash: "#/media", label: "Mídia", icon: "film" },
  { id: "cut", hash: "#/cut", label: "Corte", icon: "razor" },
  { id: "edit", hash: "#/edit", label: "Edição", icon: "select" },
  { id: "color", hash: "#/color", label: "Cor", icon: "color" },
  { id: "audio", hash: "#/audio", label: "Áudio", icon: "audio" },
  { id: "deliver", hash: "#/deliver", label: "Exportar", icon: "export" },
];

interface PageInstance {
  container: HTMLElement;
  destroy(): void;
}

const app = document.getElementById("app");
if (!app) throw new Error("#app não encontrado");

const content = el("main", { class: "content", id: "content" });
const topbar = el("header", { class: "topbar" });
const nav = el("nav", { class: "nav", "aria-label": "Páginas do editor" });
const brand = el("div", { class: "brand" }, [
  el("span", { class: "brand-mark", text: "CL" }),
  el("span", { class: "brand-name", text: "Corte Leve" }),
]);
const projectInfo = el("div", { class: "project-info" });
const status = el("span", { class: "save-status", text: "" });

const settingsDialog = createSettingsDialog();
const shortcutsOverlay = createShortcutsOverlay();

let current: PageInstance | null = null;
let editorController: { togglePlay(): void; stop(): void; deleteSelected(): void; addMarker(): void } | null = null;

function navigate(hash: string): void {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

function renderTopbar(): void {
  clear(nav);
  const project = store.state.project;
  for (const route of ROUTES) {
    const button = el("button", { class: "nav-item", type: "button", "data-route": route.hash }, [
      icon(route.icon, 14),
      el("span", { text: route.label }),
    ]);
    button.addEventListener("click", () => {
      if (!project && route.id !== "manager") {
        toast("Abra um projeto primeiro", "warning");
        return;
      }
      navigate(route.hash);
    });
    if (window.location.hash === route.hash) button.classList.add("is-active");
    nav.append(button);
  }
}

function renderProjectInfo(): void {
  clear(projectInfo);
  const project = store.state.project;
  if (!project) return;
  projectInfo.append(
    el("span", { class: "project-name", text: project.name }),
    el("span", { class: "muted small", text: `${project.settings.fps} fps · ${project.settings.width}×${project.settings.height}` })
  );
}

function renderStatus(): void {
  if (!store.state.project) {
    status.textContent = "";
    return;
  }
  status.textContent = store.state.saving ? "salvando..." : store.state.dirty ? "não salvo" : "salvo";
  status.className = `save-status ${store.state.dirty ? "is-dirty" : ""}`;
}

async function render(): Promise<void> {
  renderTopbar();
  renderProjectInfo();
  renderStatus();
  const hash = window.location.hash || "#/manager";
  current?.destroy();
  current = null;
  editorController = null;
  clear(content);

  if (hash === "#/manager" || !store.state.project) {
    const page = createManagerPage(navigate);
    current = page;
    content.append(page.container);
    return;
  }

  switch (hash) {
    case "#/media": {
      const page = createMediaPage(navigate);
      current = page;
      content.append(page.container);
      break;
    }
    case "#/cut": {
      const page = createEditPage({ compact: true });
      current = page;
      editorController = page;
      content.append(page.container);
      break;
    }
    case "#/color": {
      const page = createColorPage();
      current = page;
      content.append(page.container);
      break;
    }
    case "#/audio": {
      const page = createAudioPage();
      current = page;
      content.append(page.container);
      break;
    }
    case "#/deliver": {
      const page = createDeliverPage();
      current = page;
      content.append(page.container);
      break;
    }
    default: {
      const page = createEditPage();
      current = page;
      editorController = page;
      content.append(page.container);
      break;
    }
  }
}

const settingsBtn = iconButton("settings", "Configurações do projeto", () => settingsDialog.open());
const shortcutsBtn = iconButton("keyboard", "Atalhos de teclado", () => shortcutsOverlay.toggle());
const exitBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Fechar projeto"]);
exitBtn.addEventListener("click", async () => {
  await store.save();
  store.setProject(null);
  navigate("#/manager");
});

topbar.append(brand, nav, el("span", { class: "spacer" }), projectInfo, status, shortcutsBtn, settingsBtn, exitBtn);
app.append(topbar, content);

window.addEventListener("hashchange", () => void render());
store.on("project", () => {
  renderProjectInfo();
  renderStatus();
});
store.on("saving", renderStatus);

installShortcuts({
  togglePlay: () => editorController?.togglePlay(),
  stop: () => editorController?.stop(),
  deleteSelected: () => editorController?.deleteSelected(),
  addMarker: () => editorController?.addMarker(),
});

window.addEventListener("beforeunload", (event) => {
  if (store.state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

// diagnóstico no console: o servidor responde?
void api.health().then(
  (health) => {
    if (!health.ffmpeg) {
      toast("ffmpeg não encontrado — export indisponível até o CI baixar o pacote", "warning");
    }
  },
  () => undefined
);

void render();
