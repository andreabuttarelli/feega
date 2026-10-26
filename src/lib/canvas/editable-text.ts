import { MARKER_ATTR } from '@feega/motion-core/motion/hyperframes/text-body';

export type Span = { start: number; end: number };
type Point = { node: Node; offset: number };

const EMPTY_LINE = '​';
const NEWLINE = '\n';
const AFTER = 1;

const visible = (data: string) => data.replaceAll(EMPTY_LINE, '');

function blocksOf(root: HTMLElement): Node[][] {
  const blocks: Node[][] = [];
  for (const child of root.childNodes) {
    if (child.nodeName === 'DIV' || !blocks.length) {
      blocks.push([child]);
      continue;
    }
    blocks.at(-1)!.push(child);
  }
  return blocks;
}

function textsOf(nodes: Node[]): Text[] {
  const texts: Text[] = [];
  const visit = (node: Node) => {
    if (node instanceof Element && node.hasAttribute(MARKER_ATTR)) {
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      texts.push(node as Text);
      return;
    }
    node.childNodes.forEach(visit);
  };
  nodes.forEach(visit);
  return texts;
}

export function textOf(root: HTMLElement): string {
  return blocksOf(root)
    .map((block) => textsOf(block).map((t) => visible(t.data)).join(''))
    .join(NEWLINE);
}

export function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const caret = root.ownerDocument.createRange();
  caret.setStart(node, offset);
  let total = 0;
  for (const [i, block] of blocksOf(root).entries()) {
    if (i > 0) {
      if (caret.comparePoint(block[0], 0) === AFTER) {
        return total;
      }
      total += NEWLINE.length;
    }
    for (const text of textsOf(block)) {
      if (text === node) {
        return total + visible(text.data.slice(0, offset)).length;
      }
      if (caret.comparePoint(text, 0) === AFTER) {
        return total;
      }
      total += visible(text.data).length;
    }
  }
  return total;
}

function rawIndex(data: string, wanted: number): number {
  let seen = 0;
  for (let i = 0; i < data.length; i++) {
    if (seen === wanted) {
      return i;
    }
    if (data[i] !== EMPTY_LINE) {
      seen++;
    }
  }
  return data.length;
}

export function pointAt(root: HTMLElement, offset: number): Point {
  let rest = offset;
  const blocks = blocksOf(root);
  for (const block of blocks) {
    for (const text of textsOf(block)) {
      const length = visible(text.data).length;
      if (rest <= length) {
        return { node: text, offset: rawIndex(text.data, rest) };
      }
      rest -= length;
    }
    if (rest === 0) {
      return { node: block[0], offset: block[0].childNodes.length };
    }
    rest -= NEWLINE.length;
  }
  return { node: root, offset: root.childNodes.length };
}

export function selectionIn(root: HTMLElement): Span | null {
  const picked = root.ownerDocument.getSelection();
  if (!picked?.anchorNode || !picked.focusNode || !root.contains(picked.anchorNode) || !root.contains(picked.focusNode)) {
    return null;
  }
  const [a, b] = [offsetOf(root, picked.anchorNode, picked.anchorOffset), offsetOf(root, picked.focusNode, picked.focusOffset)];
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function rangeOf(root: HTMLElement, span: Span): Range {
  const [from, to] = [pointAt(root, span.start), pointAt(root, span.end)];
  const range = root.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

export function select(root: HTMLElement, span: Span) {
  const picked = root.ownerDocument.getSelection();
  if (!picked) {
    return;
  }
  picked.removeAllRanges();
  picked.addRange(rangeOf(root, span));
}
