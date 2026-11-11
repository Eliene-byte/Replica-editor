import { store } from "../core/state.ts";
import { api } from "../core/api.ts";
import { el, clear } from "../dom.ts";
import { icon } from "../icons.ts";
import { toast } from "../components/toast.ts";

export interface ManagerPage {
  container: HTMLElement;
  destroy(): void;
}

export function createManagerPage(navigate: (route: string) => void): ManagerPage {
  const container = el("div", { class: "page page--manager" });
  const list = el("div", { class: "project-list" });

  const newButton = el("button", { class: "btn btn--primary", type: "button" }, ["Novo projeto"]);
  newButton.addEventListener("click", async () => {
    const name = window.prompt("Nome do projeto", "Meu projeto");
    if (name === null) return;
    try {
      const { project } = await api.createProject(name.trim() || "Projeto sem nome");
      store.setProject(project);
      toast("Projeto criado", "success");
      navigate("#/edit");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  });

  container.append(
    el("header", { class: "manager-header" }, [
      el("div", {}, [
        el("h1", { class: "title", text: "Projetos" }),
        el("p", { class: "muted", text: "Cada projeto guarda mídia, timeline e render no seu disco." }),
      ]),
      newButton,
    ]),
    list
  );

  async function render(): Promise<void> {
    clear(list);
    list.append(el("p", { class: "muted", text: "Carregando..." }));
    try {
      const { projects } = await api.listProjects();
      clear(list);
      if (!projects.length) {
        list.append(
          el("div", { class: "empty-state" }, [
            el("p", { text: "Nenhum projeto ainda" }),
            el("small", { text: "Crie o primeiro para começar a cortar." }),
          ])
        );
        return;
      }
      for (const project of projects) {
        const card = el("article", { class: "project-card" }, [
          el("h3", { text: project.name }),
          el("p", { class: "muted small", text: `${project.mediaCount} mídia(s) · ${new Date(project.updatedAt).toLocaleString()}` }),
        ]);
        const open = el("button", { class: "btn btn--primary", type: "button" }, ["Abrir"]);
        open.addEventListener("click", async () => {
          try {
            const { project: full } = await api.loadProject(project.id);
            store.setProject(full);
            navigate("#/edit");
          } catch (err) {
            toast((err as Error).message, "error");
          }
        });
        const remove = el("button", { class: "btn btn--danger", type: "button", "aria-label": `Apagar ${project.name}` }, [
          icon("trash", 14),
        ]);
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Apagar o projeto "${project.name}" e a mídia dele?`)) return;
          await api.deleteProject(project.id);
          toast("Projeto apagado", "info");
          void render();
        });
        card.append(el("div", { class: "project-actions" }, [open, remove]));
        list.append(card);
      }
    } catch (err) {
      clear(list);
      list.append(el("p", { class: "error", text: `Não foi possível carregar os projetos: ${(err as Error).message}` }));
    }
  }

  const unsubscribe = store.on("project", () => void render());
  void render();

  return {
    container,
    destroy(): void {
      unsubscribe();
    },
  };
}
