/**
 * Ícones desenhados para este projeto (traços simples, 24×24).
 * Nada copiado de conjunto de terceiros: cada forma é a mais simples possível.
 */

const ICONS: Record<string, string[]> = {
  play: ["M8 5.5 L18 12 L8 18.5 Z"],
  pause: ["M9 5.5 V18.5", "M15 5.5 V18.5"],
  start: ["M18 6 L10 12 L18 18 Z", "M6 6 V18"],
  end: ["M6 6 L14 12 L6 18 Z", "M18 6 V18"],
  step: ["M8 6 L14 12 L8 18 Z", "M16 6 V18"],
  razor: ["M4 4 L14 14", "M20 4 L10 14", "M6 18 A2.5 2.5 0 1 0 6 13 A2.5 2.5 0 1 0 6 18 Z", "M18 18 A2.5 2.5 0 1 0 18 13 A2.5 2.5 0 1 0 18 18 Z"],
  select: ["M6 4 L18 12 L12.5 13.5 L10 19 Z"],
  magnet: ["M6 4 V11 A6 6 0 0 0 18 11 V4", "M6 8 H10", "M14 8 H18"],
  undo: ["M9 8 H15 A4 4 0 0 1 15 16 H8", "M12 5 L9 8 L12 11"],
  redo: ["M15 8 H9 A4 4 0 0 0 9 16 H16", "M12 5 L15 8 L12 11"],
  upload: ["M12 16 V6", "M8 10 L12 6 L16 10", "M5 19 H19"],
  download: ["M12 6 V16", "M8 12 L12 16 L16 12", "M5 19 H19"],
  trash: ["M5 7 H19", "M9 7 V5 H15 V7", "M7 7 L8 19 H16 L17 7"],
  plus: ["M12 6 V18", "M6 12 H18"],
  close: ["M6 6 L18 18", "M18 6 L6 18"],
  settings: ["M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 Z", "M4 12 H7", "M17 12 H20", "M12 4 V7", "M12 17 V20"],
  folder: ["M4 7 H10 L12 9 H20 V18 H4 Z"],
  wave: ["M3 12 H5 L7 7 L9 17 L11 9 L13 15 L15 10 L17 14 L19 11 L21 13"],
  lock: ["M7 11 V8 A5 5 0 0 1 17 8 V11", "M6 11 H18 V19 H6 Z"],
  solo: ["M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 Z"],
  mute: ["M6 9 H9 L13 5 V19 L9 15 H6 Z", "M17 9 L21 15", "M21 9 L17 15"],
  zoomIn: ["M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 Z", "M16 16 L21 21", "M11 8 V14", "M8 11 H14"],
  zoomOut: ["M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 Z", "M16 16 L21 21", "M8 11 H14"],
  color: ["M12 4 A8 8 0 1 0 12 20 A6 6 0 0 0 12 8 Z"],
  audio: ["M4 10 V14 H7 L11 18 V6 L7 10 Z", "M15 9 A4 4 0 0 1 15 15"],
  export: ["M12 15 V5", "M8 9 L12 5 L16 9", "M5 19 H19"],
  film: ["M4 6 H20 V18 H4 Z", "M4 10 H20", "M4 14 H20", "M9 6 V18", "M15 6 V18"],
  search: ["M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 Z", "M16 16 L21 21"],
  keyboard: ["M3 7 H21 V17 H3 Z", "M7 11 H8", "M11 11 H12", "M15 11 H16", "M7 14 H17"],
  eye: ["M3 12 C6 8 9 6 12 6 C15 6 18 8 21 12 C18 16 15 18 12 18 C9 18 6 16 3 12 Z", "M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 Z"],
  eyeOff: ["M4 4 L20 20", "M9 6 C13 5 17 7 21 12 C19 14 17 16 15 17", "M6 8 C4 10 3 11 3 12 C6 16 9 18 12 18"],
  checker: ["M4 4 H10 V10 H4 Z", "M14 4 H20 V10 H14 Z", "M4 14 H10 V20 H4 Z", "M14 14 H20 V20 H14 Z"],
  roll: ["M3 7 L12 12 L21 7", "M3 17 L12 12 L21 17"],
  slip: ["M4 6 H20 V18 H4 Z", "M8 12 H16", "M10 10 L8 12 L10 14", "M14 10 L16 12 L14 14"],
  slide: ["M4 6 H20 V18 H4 Z", "M1 12 H7", "M17 12 H23", "M5 10 L7 12 L5 14", "M19 10 L17 12 L19 14"],
};

export function icon(name: string, size = 16): SVGSVGElement {
  const paths = ICONS[name] ?? ICONS.select;
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", "0 0 24 24");
  node.setAttribute("width", String(size));
  node.setAttribute("height", String(size));
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "1.6");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    node.append(p);
  }
  return node;
}

export function iconButton(name: string, label: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `icon-btn ${extraClass}`.trim();
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(icon(name));
  button.addEventListener("click", onClick);
  return button;
}
