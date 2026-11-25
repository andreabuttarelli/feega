export type View = { key: string; build: () => HTMLElement; patch?: (root: HTMLElement) => void };

export type Props = { class?: string; text?: string; html?: string; on?: () => void; title?: string };

export const el = (tag: string, props: Props = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  node.className = props.class ?? '';
  if (props.text !== undefined) {
    node.textContent = props.text;
  }
  if (props.html !== undefined) {
    node.innerHTML = props.html;
  }
  if (props.title) {
    node.title = props.title;
  }
  if (props.on) {
    node.addEventListener('click', props.on);
  }
  node.append(...children);
  return node;
};

export const run = (action: () => Promise<unknown>) => () => void action();

export const pill = (text: string, kind: string, on: () => void) => el('button', { class: `pill ${kind}`, text, on });
