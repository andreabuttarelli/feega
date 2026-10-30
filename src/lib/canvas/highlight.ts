import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { instanceOf } from '$lib/motion/main-component';

export enum HighlightKind {
  Element = 'element',
  Node = 'node',
  Component = 'component'
}

export const SELECT_BLUE = '#0099ff';
export const COMPONENT_PURPLE = '#9747ff';

export const HIGHLIGHT: Record<HighlightKind, string> = {
  [HighlightKind.Element]: SELECT_BLUE,
  [HighlightKind.Node]: SELECT_BLUE,
  [HighlightKind.Component]: COMPONENT_PURPLE
};

export const rowHighlight = (row: { instance?: boolean }): HighlightKind => (row.instance ? HighlightKind.Component : HighlightKind.Element);

export const highlightOf = (doc: MotionDoc, clipId: string): HighlightKind => rowHighlight({ instance: instanceOf(doc, clipId) !== null });

export const highlightStyle = (kind: HighlightKind): string => `--highlight:${HIGHLIGHT[kind]}`;
