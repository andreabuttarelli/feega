import { BRIDGE_READY, INSPECT, INSPECT_RESULT, LOCAL_ORIGIN, LOCATION, MODE, PREVIEW, PREVIEW_CLEAR, PREVIEW_SETTLE, PREVIEW_SETTLED, SCROLL, SCROLLED, HIDE, TREE, TREE_RESULT, type LayerNode, TEXT_DONE, TEXT_EDIT, type Mode, type Move, type Pick, type Source } from '../messages';

type Inspected = { source: Source; component: Source | null; html: string; rect: Pick['rect']; styles: Record<string, string>; classes: string; rem: number; viewport: number; ownText: boolean; elements: number; name: string; parentWidth: number; instances: number; classCount: number; ancestors: Pick['ancestors'] };

const TAG = /^<([a-zA-Z][\w-]*)/;
const SOURCE_ATTR = 'data-feega-src';

const pickOf = (r: Inspected | null): Pick | null =>
  r ? { source: r.source, component: r.component, tag: r.html.match(TAG)?.[1] ?? '', rect: r.rect, styles: r.styles, classes: r.classes, rem: r.rem, viewport: r.viewport, ownText: r.ownText, elements: r.elements, name: r.name, parentWidth: r.parentWidth, instances: r.instances, classCount: r.classCount, ancestors: r.ancestors } : null;

export const sourceText = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export type PageEvents = {
  ready: (path: string) => void;
  moved: (path: string) => void;
  scrolled: () => void;
  tree: (tree: LayerNode[]) => void;
  settled: (source: string, unapplied: string[]) => void;
  text: (source: string, text: string) => void;
};

export function pageBridge(frame: () => HTMLIFrameElement | null, on: PageEvents) {
  const waiting = new Map<number, (pick: Pick | null) => void>();
  let next = 0;

  window.addEventListener('message', (event) => {
    if (!LOCAL_ORIGIN.test(event.origin)) {
      return;
    }
    const data = event.data;
    if (data?.type === BRIDGE_READY) {
      on.ready(data.path ?? '/');
      return;
    }
    if (data?.type === TREE_RESULT) {
      on.tree(data.tree);
      return;
    }
    if (data?.type === SCROLLED) {
      on.scrolled();
      return;
    }
    if (data?.type === LOCATION) {
      on.moved(data.path);
      return;
    }
    if (data?.type === PREVIEW_SETTLED) {
      on.settled(data.source, data.unapplied);
      return;
    }
    if (data?.type === TEXT_DONE) {
      on.text(data.source, data.text);
      return;
    }
    if (event.data?.type !== INSPECT_RESULT) {
      return;
    }
    waiting.get(event.data.id)?.(pickOf(event.data.result));
    waiting.delete(event.data.id);
  });

  function send(message: Record<string, unknown>) {
    const target = frame();
    const origin = target?.src ? new URL(target.src).origin : null;
    if (target?.contentWindow && origin) {
      target.contentWindow.postMessage(message, origin);
    }
  }

  function inspect(query: { x: number; y: number } | { selector: string } | { from: string; move: Move }): Promise<Pick | null> {
    const id = ++next;
    return new Promise((resolve) => {
      waiting.set(id, resolve);
      send({ type: INSPECT, id, ...query });
    });
  }

  return {
    at: (x: number, y: number) => inspect({ x, y }),
    move: (from: Source, move: Move) => inspect({ from: sourceText(from), move }),
    again: (source: Source) => inspect({ selector: `[${SOURCE_ATTR}="${sourceText(source)}"]` }),
    preview: (source: Source, style: Record<string, string>) => send({ type: PREVIEW, source: sourceText(source), style }),
    clear: (source: Source) => send({ type: PREVIEW_CLEAR, source: sourceText(source) }),
    settle: (source: Source) => send({ type: PREVIEW_SETTLE, source: sourceText(source) }),
    tree: () => send({ type: TREE }),
    hide: (source: Source, hidden: boolean) => send({ type: HIDE, source: sourceText(source), hidden }),
    mode: (mode: Mode) => send({ type: MODE, mode }),
    scroll: (dx: number, dy: number) => send({ type: SCROLL, dx, dy }),
    editText: (x: number, y: number) => send({ type: TEXT_EDIT, x, y })
  };
}
