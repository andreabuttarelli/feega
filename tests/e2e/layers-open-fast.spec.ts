import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const TEMPLATES_DIR = 'src/lib/motion/template';
const POSTER_ID = /\$\{BUILTIN_PREFIX\}(poster-[a-z0-9-]+)/g;
const BUILTIN = 'builtin:';
const PORTRAIT = '4:5';
const VIDEOS = 5;
const ELEMENTS_BUDGET_MS = 500;
const PARTS_BUDGET_MS = 300;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SPACING = 1200;

const posterTemplates = () =>
  [...new Set(readdirSync(TEMPLATES_DIR).flatMap((dir) => {
    const file = `${TEMPLATES_DIR}/${dir}/template.ts`;
    const view = `${TEMPLATES_DIR}/${dir}/view.ts`;
    const named = existsSync(view) && /data-part|part\('/.test(readFileSync(view, 'utf8'));
    return named && existsSync(file) ? [...readFileSync(file, 'utf8').matchAll(POSTER_ID)].map((m) => `${BUILTIN}${m[1]}`) : [];
  }))];

async function insertTemplate(page: Page, path: string, template: string, x: number) {
  const form = { template, format: PORTRAIT, x: String(x), y: '0' };
  const res = await page.request.post(`${path}?/frame_template`, { form, headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin } });
  expect(res.ok(), `${template} inserted`).toBe(true);
}

async function countProbes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __probes: number };
    w.__probes = 0;
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) {
          if (n instanceof Element && (n.matches('[data-testid=parts-probe]') || n.querySelector('[data-testid=parts-probe]'))) {
            w.__probes++;
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

const framesWith = (page: Page, kinds: string[]) =>
  page.getByTestId('layers').locator('[data-kind]').evaluateAll((rows, wanted) => {
    const hit = new Set<string>();
    let node = '';
    for (const r of rows) {
      const kind = r.getAttribute('data-kind') ?? '';
      if (kind === 'node') {
        node = r.getAttribute('data-layer') ?? '';
      } else if (wanted.includes(kind)) {
        hit.add(node);
      }
    }
    return hit.size;
  }, kinds);

test.describe('Layers on canvas open @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('every poster template lists its parts from data, with no probe player', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const posters = posterTemplates();
    expect(posters.length).toBeGreaterThan(20);
    for (let i = 0; i < VIDEOS; i++) {
      const node = await seedNode({ type: 'motion', x: -(i + 1) * SPACING, y: 0, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await gotoHydrated(page, path);
    for (const [i, template] of posters.entries()) {
      await insertTemplate(page, path, template, i * SPACING);
    }

    await countProbes(page);
    await gotoHydrated(page, path);
    const opened = Date.now();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();

    await expect.poll(() => framesWith(page, ['clip', 'group', 'track']), { timeout: 30_000, intervals: [25] }).toBe(VIDEOS + posters.length);
    const elements = Date.now() - opened;
    await expect.poll(() => framesWith(page, ['part']), { timeout: 30_000, intervals: [25] }).toBe(posters.length);
    const parts = Date.now() - opened;
    const probes = await page.evaluate(() => (window as unknown as { __probes: number }).__probes);
    console.log(`after hydration: elements of ${VIDEOS + posters.length} frames ${elements} ms, parts of ${posters.length} posters ${parts} ms, probe players ${probes}`);

    expect(probes, 'no poster is rendered to list its parts').toBe(0);
    expect(elements, `elements within ${ELEMENTS_BUDGET_MS} ms`).toBeLessThan(ELEMENTS_BUDGET_MS);
    expect(parts, `parts within ${PARTS_BUDGET_MS} ms`).toBeLessThan(PARTS_BUDGET_MS);
  });

  test('a part picked in Layers is selected before the preview has loaded', async ({ page, session }) => {
    test.setTimeout(120_000);
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    await gotoHydrated(page, path);
    await insertTemplate(page, path, `${BUILTIN}poster-checker-steps`, 0);
    await page.addInitScript(() => {
      const define = customElements.define.bind(customElements);
      customElements.define = (name, ctor, options) => (name === 'hyperframes-player' ? undefined : define(name, ctor, options));
      (window as unknown as { __ready: number }).__ready = 0;
      addEventListener('message', (e) => {
        if ((e.data as { type?: string })?.type === 'ready') {
          (window as unknown as { __ready: number }).__ready++;
        }
      });
    });
    await gotoHydrated(page, path);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const step = page.getByTestId('layers').locator('[data-layer$="#title:1"]');
    await step.click();
    await expect(page.getByTestId('part-text')).toHaveValue('small', { timeout: 15_000 });
    await expect(step).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => (window as unknown as { __ready: number }).__ready), 'no preview had loaded').toBe(0);
  });
});
