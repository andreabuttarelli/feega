import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONE = { width: 390, height: 844 };
const DRAFT = 'a draft that must survive';
const LINES = 60;
const SCROLL_SLACK_PX = 4;

type Probe = { posts: number; push: (text: string) => void; end: () => void };

function heldChatStream() {
  const native = window.fetch.bind(window);
  const encoder = new TextEncoder();
  const frame = (part: unknown) => encoder.encode(`data: ${JSON.stringify(part)}\n\n`);
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const probe = {
    posts: 0,
    push: (text: string) => controller?.enqueue(frame({ type: 'text-delta', delta: text })),
    end: () => {
      controller?.enqueue(frame({ type: 'finish' }));
      controller?.close();
    }
  };
  Object.assign(window, { __chat: probe });
  window.fetch = async (input, init) => {
    if (!String(input instanceof Request ? input.url : input).endsWith('/agent')) {
      return native(input, init);
    }
    if (init?.method !== 'POST') {
      return new Response(JSON.stringify({ messages: [] }), { headers: { 'content-type': 'application/json' } });
    }
    probe.posts++;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  };
}

const chat = (page: Page) => page.evaluate(() => (window as unknown as { __chat: Probe }).__chat.posts);
const push = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __chat: Probe }).__chat.push(t), text);

async function startTurn(page: Page) {
  await page.locator('#chat-composer-input').fill('write a long answer');
  await page.locator('#chat-composer-input').press('Enter');
  await expect.poll(() => chat(page)).toBe(1);
  await push(page, Array.from({ length: LINES }, (_, i) => `line ${i}`).join('\n\n'));
  await expect(page.getByRole('log').getByText('line 59')).toBeVisible();
  await page.locator('#chat-composer-input').fill(DRAFT);
  await page.getByRole('log').evaluate((log) => {
    log.scrollTop = 200;
    log.dispatchEvent(new Event('scroll'));
  });
  await page.evaluate(() => {
    Object.assign(document.querySelector('[data-testid=right-bar]')!, { __kept: true });
    Object.assign(document.querySelector('[role=log]')!, { __kept: true });
  });
}

async function expectSameBar(page: Page) {
  const kept = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid=right-bar]') as unknown as { __kept?: boolean } | null;
    const log = document.querySelector('[role=log]') as unknown as { __kept?: boolean; scrollTop: number } | null;
    return { bar: bar?.__kept ?? false, log: log?.__kept ?? false, count: document.querySelectorAll('[data-testid=right-bar]').length, logs: document.querySelectorAll('[role=log]').length };
  });
  expect(kept, 'the same right bar node, never a second one').toEqual({ bar: true, log: true, count: 1, logs: 1 });
  await expect(page.locator('#chat-composer-input')).toHaveValue(DRAFT);
  expect(Math.abs((await page.getByRole('log').evaluate((log) => log.scrollTop)) - 200)).toBeLessThanOrEqual(SCROLL_SLACK_PX);
}

async function expectStreamGoesOn(page: Page, token: string) {
  await push(page, `\n\n${token}`);
  await expect(page.getByRole('log').getByText(token)).toHaveCount(1);
  await expect(page.getByRole('log').getByText('line 0', { exact: true })).toHaveCount(1);
  expect(await chat(page), 'no new request: the same turn keeps streaming').toBe(1);
}

test.describe('the right bar is one instance across canvas and motion editor @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  let frameId = '';

  test.beforeEach(async ({ session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    frameId = node.id;
  });

  test('desktop: a turn keeps streaming while a frame editor opens and closes', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.addInitScript(heldChatStream);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await startTurn(page);

    await page.locator(`.svelte-flow__node[data-id="${frameId}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expectSameBar(page);
    await expectStreamGoesOn(page, 'in the editor');
    await expect(page.getByTestId('right-bar').getByTestId('side-tab-properties'), 'Properties sits beside Guide in the same bar').toBeVisible();
    await expect(page.getByTestId('right-bar').getByTestId('bar-tab-guide')).toBeVisible();

    await page.getByTestId('right-bar').getByTestId('side-tab-properties').click();
    await expect(page.getByTestId('right-bar').getByLabel('Properties', { exact: true })).toBeVisible();
    await page.getByTestId('right-bar').getByTestId('side-tab-chat').click();

    await page.getByTestId('inline-close').click();
    await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
    await expectSameBar(page);
    await expectStreamGoesOn(page, 'back on the canvas');
    await expect(page.getByTestId('right-bar').getByTestId('side-tab-properties')).toHaveCount(0);
  });

  test('phone: the chat sheet of the editor is the same chat as the canvas one', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(PHONE);
    await page.addInitScript(heldChatStream);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await startTurn(page);

    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    const stage = page.getByTestId('motion-node-stage').first();
    await stage.click({ position: { x: 60, y: 10 } });
    await stage.dblclick({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('phone-tab-chat').click();
    await expectSameBar(page);
    await expectStreamGoesOn(page, 'in the sheet');

    await page.getByTestId('inline-close').click();
    await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expectSameBar(page);
    await expectStreamGoesOn(page, 'back on the phone canvas');
  });
});
