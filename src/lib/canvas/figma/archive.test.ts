import { describe, expect, it } from 'vitest';
import { cardOverElements, elementsOnly } from '../../../../tests/fixtures/figma/elements';
import { figmaClipboardHtml } from '../../../../tests/fixtures/figma/clipboard';
import { figmaMessage } from './archive';
import { figmaPlan } from './figma-doc';
import { Destination } from './scene';

describe('a synthetic Figma clipboard', () => {
  it('round-trips through the fig-kiwi archive', () => {
    const decoded = figmaMessage(figmaClipboardHtml(elementsOnly()));
    expect(decoded?.nodes.map((n) => n.type)).toEqual(['CANVAS', 'ROUNDED_RECTANGLE', 'ELLIPSE', 'TEXT', 'GROUP', 'ROUNDED_RECTANGLE', 'ROUNDED_RECTANGLE']);
  });

  it('copied elements land as free elements, with no frame', () => {
    const plan = figmaPlan(figmaClipboardHtml(elementsOnly()), () => Math.random().toString(36).slice(2, 10));
    expect(plan?.items.map((i) => i.destination)).toEqual([Destination.Free, Destination.Free, Destination.Free, Destination.Free]);
  });

  it('a frame among elements is the only frame in the paste', () => {
    const plan = figmaPlan(figmaClipboardHtml(cardOverElements()), () => Math.random().toString(36).slice(2, 10));
    expect(plan?.items.filter((i) => i.destination === Destination.Frame)).toHaveLength(1);
  });
});
