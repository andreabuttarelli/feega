import type { Page } from '@playwright/test';

export type MarkBox = { x: number; y: number; width: number; height: number };

const SELECTION_IDS = /^(pick|group):|^many$/;
const DOM_SELECTION = '[data-testid="frame-selection"], [data-testid="frame-group-selection"]';

export async function selectionBoxes(page: Page): Promise<MarkBox[]> {
  return page.evaluate(
    ([pattern, dom]) => {
      const marks = window.__gpuCanvas?.marks;
      if (!marks) {
        return [...document.querySelectorAll(dom)].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      }
      const pane = document.querySelector('.svelte-flow__pane')!.getBoundingClientRect();
      return marks
        .ids()
        .filter((id) => new RegExp(pattern).test(id))
        .flatMap((id) => {
          const r = marks.rectOf(id);
          return r ? [{ x: pane.x + r.x, y: pane.y + r.y, width: r.w, height: r.h }] : [];
        });
    },
    [SELECTION_IDS.source, DOM_SELECTION] as const
  );
}

export const selectionCount = async (page: Page): Promise<number> => (await selectionBoxes(page)).length;

export const selectionBox = async (page: Page): Promise<MarkBox | null> => (await selectionBoxes(page))[0] ?? null;
