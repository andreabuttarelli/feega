export type DrawnNode = { tag: string; className: string; textContent: string; innerHTML: string; style: Record<string, unknown>; attrs: Record<string, string>; children: DrawnNode[] };

const FRAME = { width: 1920, height: 1080 };
const SEED = 42;
const LCG = { multiplier: 16807, modulus: 2147483647 };

function node(tag: string): DrawnNode {
  const style: Record<string, unknown> = {};
  style.setProperty = (k: string, v: string) => (style[k] = v);
  const n = { tag, className: '', textContent: '', innerHTML: '', style, attrs: {} as Record<string, string>, children: [] as DrawnNode[], clientWidth: FRAME.width, clientHeight: FRAME.height };
  return Object.assign(n, { appendChild: (c: DrawnNode) => n.children.push(c), setAttribute: (k: string, v: string) => (n.attrs[k] = v) });
}

const fakeDocument = { createElement: node, createElementNS: (_: string, tag: string) => node(tag) };

export function drawPiece(js: string, props: Record<string, unknown>, duration: number): (t: number) => DrawnNode {
  const root = node('root');
  const updates: (() => void)[] = [];
  let now = 0;
  let seed = SEED;
  const rand = () => {
    seed = (seed * LCG.multiplier) % LCG.modulus;
    return seed / LCG.modulus;
  };
  const param = (key: string, fallback: unknown) => (key in props ? props[key] : fallback);
  const tl = { to: (_: unknown, o: { onUpdate: (this: { time: () => number }) => void }) => updates.push(() => o.onUpdate.call({ time: () => now })) };
  new Function('root', 'param', 'tl', 'duration', 'rand', 'document', js)(root, param, tl, duration, rand, fakeDocument);
  return (t: number) => {
    now = t;
    updates.forEach((u) => u());
    return root;
  };
}

const BLOCK_TAG = 'div';
const MIN_EMPTY_ROWS = 3;
const CARD = /\bcard\b/;

const hidden = (n: DrawnNode) => n.style.opacity === '0' || n.style.display === 'none';

const textOf = (n: DrawnNode): string => (hidden(n) ? '' : `${n.textContent}${n.children.map(textOf).join('')}`).trim();

const drawsIcon = (n: DrawnNode): boolean => n.innerHTML.length > 0 || n.children.some(drawsIcon);

const shapeOnly = (n: DrawnNode) => n.tag === BLOCK_TAG && !hidden(n) && !textOf(n) && !drawsIcon(n);

function emptyRows(n: DrawnNode): string[] {
  const groups = new Map<string, number>();
  n.children.filter((c) => shapeOnly(c) && c.children.length > 0).forEach((c) => groups.set(c.className, (groups.get(c.className) ?? 0) + 1));
  return [...groups].filter(([, count]) => count >= MIN_EMPTY_ROWS).map(([cls, count]) => `${count} rows "${cls}" with no text`);
}

const emptyCard = (n: DrawnNode) => (CARD.test(n.className) && shapeOnly(n) && n.children.length > 0 ? [`a card "${n.className}" with only shapes`] : []);

export function placeholders(tree: DrawnNode): string[] {
  return [...emptyRows(tree), ...emptyCard(tree), ...tree.children.flatMap(placeholders)];
}
