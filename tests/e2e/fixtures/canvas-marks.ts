import type { Page } from '@playwright/test';

export type MarkBox = { x: number; y: number; width: number; height: number };

const SELECTION_IDS = /^(pick|group):|^many$/;
const PICK_IDS = /^pick:/;
const GROUP_IDS = /^(group:|many$)/;
const DOM_PICK = '[data-testid="frame-selection"]';
const DOM_GROUP = '[data-testid="frame-group-selection"]';
const HOVER_IDS = /^hover:/;
const DOM_HOVER = '[data-testid="frame-pick-box"], [data-testid="view-pick-box"], [data-testid="frame-layer-hover-box"]';
const DOM_HANDLE = '[data-testid="frame-selection-handle"]';
const HANDLE_SIZE_PX = 8;
const HANDLE_UNITS = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]] as const;
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

async function boxesOf(page: Page, pattern: RegExp, dom: string): Promise<MarkBox[]> {
  return page.evaluate(
    ([source, selector]) => {
      const marks = window.__gpuCanvas?.marks;
      if (!marks) {
        return [...document.querySelectorAll(selector)].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      }
      const pane = document.querySelector('.svelte-flow__pane')!.getBoundingClientRect();
      return marks
        .ids()
        .filter((id) => new RegExp(source).test(id))
        .flatMap((id) => {
          const r = marks.rectOf(id);
          return r ? [{ x: pane.x + r.x, y: pane.y + r.y, width: r.w, height: r.h }] : [];
        });
    },
    [pattern.source, dom] as const
  );
}

export const hoverBoxes = (page: Page): Promise<MarkBox[]> => boxesOf(page, HOVER_IDS, DOM_HOVER);

export const hoverCount = async (page: Page): Promise<number> => (await hoverBoxes(page)).length;

const handlesAround = (box: MarkBox): MarkBox[] =>
  HANDLE_UNITS.map(([u, v]) => ({
    x: box.x + u * box.width - HANDLE_SIZE_PX / 2,
    y: box.y + v * box.height - HANDLE_SIZE_PX / 2,
    width: HANDLE_SIZE_PX,
    height: HANDLE_SIZE_PX
  }));

export async function handleBoxes(page: Page): Promise<MarkBox[]> {
  const hasMarks = await page.evaluate(() => Boolean(window.__gpuCanvas?.marks));
  if (!hasMarks) {
    return boxesOf(page, /^$/, DOM_HANDLE);
  }
  const sel = await selectionBox(page);
  if (!sel) {
    return [];
  }
  return handlesAround(sel);
}

export const handleCount = async (page: Page): Promise<number> => (await handleBoxes(page)).length;

async function idsOf(page: Page, pattern: RegExp, dom: string, attr: string): Promise<string[]> {
  return page.evaluate(
    ([source, selector, attribute]) => {
      const marks = window.__gpuCanvas?.marks;
      if (!marks) {
        return [...document.querySelectorAll(selector)].map((el) => el.getAttribute(attribute) ?? '');
      }
      return marks
        .ids()
        .filter((id) => new RegExp(source).test(id))
        .map((id) => id.split(':').slice(2).join(':'));
    },
    [pattern.source, dom, attr] as const
  );
}

export async function selectedClip(page: Page): Promise<string | null> {
  const ids = await idsOf(page, /^pick:/, '[data-testid="frame-selection"]', 'data-clip');
  return ids[0] ?? null;
}

export async function hoveredClip(page: Page): Promise<string | null> {
  const ids = await idsOf(page, HOVER_IDS, DOM_HOVER, 'data-hovered');
  return ids[0] ?? null;
}

export const pickBoxes = (page: Page): Promise<MarkBox[]> => boxesOf(page, PICK_IDS, DOM_PICK);

export const pickCount = async (page: Page): Promise<number> => (await pickBoxes(page)).length;

export const pickBox = async (page: Page): Promise<MarkBox | null> => (await pickBoxes(page))[0] ?? null;

export const groupBox = async (page: Page): Promise<MarkBox | null> => (await boxesOf(page, GROUP_IDS, DOM_GROUP))[0] ?? null;

export async function groupHandleBoxes(page: Page): Promise<MarkBox[]> {
  const hasMarks = await page.evaluate(() => Boolean(window.__gpuCanvas?.marks));
  if (!hasMarks) {
    return boxesOf(page, /^$/, `${DOM_GROUP} ${DOM_HANDLE}`);
  }
  const box = await groupBox(page);
  return box ? handlesAround(box) : [];
}
