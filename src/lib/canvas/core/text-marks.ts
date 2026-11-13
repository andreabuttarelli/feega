import { caretRect, codePointsOf, selectionBoxes, type CaretLine } from '@feega/motion-core/motion/gpu-full/text/caret';
import type { Span } from '$lib/canvas/editable-text';

export type Mark = { left: number; top: number; width: number; height: number };

export type EditMarks = { caret: Mark | null; boxes: Mark[] };

export function editMarks(lines: readonly CaretLine[], text: string, sel: Span, caretWidth: number): EditMarks {
  if (!lines.length) {
    return { caret: null, boxes: [] };
  }

  const from = codePointsOf(text, sel.start);
  const to = codePointsOf(text, sel.end);

  if (from === to) {
    const at = caretRect([...lines], from);
    return { caret: { left: at.x - caretWidth / 2, top: at.top, width: caretWidth, height: at.height }, boxes: [] };
  }

  const boxes = selectionBoxes([...lines], from, to).map((b) => ({ left: b.left, top: b.top, width: b.right - b.left, height: b.height }));
  return { caret: null, boxes };
}
