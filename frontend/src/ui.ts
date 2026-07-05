// Helpers mínimos de DOM.
export const app = () => document.getElementById("app")!;

export function el(tag: string, props: Record<string, any> = {}, children: (Node | string)[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") node.innerHTML = v;
    else if (k.includes("-")) node.setAttribute(k, v); // data-*, aria-*, etc.
    else (node as any)[k] = v;
  }
  for (const c of children) node.append(c);
  return node;
}

export function render(...nodes: Node[]) {
  const root = app();
  root.innerHTML = "";
  root.append(...nodes);
}

export function toast(msg: string) {
  const t = el("div", { class: "toast" }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
