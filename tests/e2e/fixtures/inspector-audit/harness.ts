import { expect, type Locator, type Page } from '@playwright/test';
import { PLACE } from './fixture';

export const MIN_TARGET_PX = 20;
export const UNDO = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
export const CANVAS_PATH = `/p/${PLACE.projectId}/c/${PLACE.canvasId}`;
const SETTLE_MS = 400;
const MAX_SECTIONS = 30;

export type Clip = { id: string; component: string; props: Record<string, unknown>; [k: string]: unknown };
type Doc = { tracks: { clips: Clip[] }[]; comps: Record<string, { tracks: { clips: Clip[] }[] }>; [k: string]: unknown };

export const inspector = (page: Page) => page.getByTestId('motion-inspector');

export async function openCanvas(page: Page): Promise<void> {
  await page.goto(CANVAS_PATH, { timeout: 180_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  const layers = page.getByTestId('layers');
  const button = page.getByRole('button', { name: 'Layers', exact: true });
  await expect(button).toBeVisible({ timeout: 60_000 });
  await expect(async () => {
    if (!(await layers.isVisible())) {
      await button.click();
    }
    await expect(layers).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

export async function pick(page: Page, nodeId: string, clipId: string): Promise<void> {
  const layers = page.getByTestId('layers');
  const row = layers.locator(`[data-layer="${clipId}"]`);
  if (!(await row.isVisible())) {
    await layers.locator(`[data-layer="${nodeId}"]`).click();
    await expect(row).toBeVisible({ timeout: 30_000 });
  }
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(inspector(page)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(SETTLE_MS);
}

export async function openSections(page: Page): Promise<void> {
  const closed = inspector(page).locator('section[data-section][data-open="false"] .section-head');
  for (let tries = 0; tries < MAX_SECTIONS && (await closed.count()) > 0; tries++) {
    await closed.first().click();
  }
}

export async function docOf(page: Page, nodeId: string): Promise<Doc> {
  const answer = await page.request.get(`/api/v1/projects/${PLACE.projectId}/motion/${nodeId}/agent`);
  expect(answer.ok(), `head of ${nodeId}`).toBe(true);
  return ((await answer.json()) as { head: { doc: Doc } }).head.doc;
}

export function clipIn(doc: Doc, id: string): Clip | undefined {
  const all = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips);
  return all.find((c) => c.id === id);
}

export type Reach = { name: string; width: number; height: number; hit: boolean; coveredBy: string; tabbable: boolean; disabled: boolean };

export async function reach(target: Locator): Promise<Reach> {
  return target.evaluate((el: HTMLElement) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = el.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const top = document.elementFromPoint(x, y);
    const label = top?.closest('label');
    const hit = !!top && (el === top || el.contains(top) || (!!label && label.contains(el)) || (top instanceof HTMLLabelElement && top.control === el));
    const describe = (n: Element | null) => (n ? `${n.tagName.toLowerCase()}${n.getAttribute('data-testid') ? `[data-testid=${n.getAttribute('data-testid')}]` : ''}${n.getAttribute('aria-label') ? `[aria-label=${n.getAttribute('aria-label')}]` : ''}` : 'nothing');
    const labelled = el.getAttribute('aria-labelledby');
    const own = (el as HTMLInputElement).labels?.[0]?.textContent ?? '';
    const name = (el.getAttribute('aria-label') ?? (labelled ? document.getElementById(labelled)?.textContent : '') ?? '') || own || el.getAttribute('title') || el.textContent || (el as HTMLInputElement).placeholder || '';
    const disabled = (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
    return { name: name.trim().replace(/\s+/g, ' '), width: box.width, height: box.height, hit, coveredBy: hit ? '' : describe(top), tabbable: el.tabIndex >= 0 && !disabled, disabled };
  });
}

export async function centre(target: Locator): Promise<{ x: number; y: number }> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, 'the control has a box').not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

export async function press(page: Page, target: Locator): Promise<void> {
  const at = await centre(target);
  await page.mouse.click(at.x, at.y);
}

export async function layerShot(page: Page): Promise<Buffer | null> {
  const box = await page.getByTestId('selection-box').boundingBox().catch(() => null);
  if (!box || box.width < 2 || box.height < 2) {
    return null;
  }
  const view = page.viewportSize()!;
  const x = Math.max(0, box.x - 4);
  const y = Math.max(0, box.y - 4);
  const width = Math.min(view.width - x, box.width + 8);
  const height = Math.min(view.height - y, box.height + 8);
  return width > 1 && height > 1 ? page.screenshot({ clip: { x, y, width, height } }) : null;
}
