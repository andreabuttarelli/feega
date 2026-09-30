import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const TYPED = 'The quick brown fox jumps over the lazy dog while saves keep flushing 0123456789 abcdefghijklmnopqrstuvwxyz';
const KEY_DELAY_MS = 30;
const SAVES_SETTLE_MS = 1_500;

test.describe('fast typing @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a peer edit mid-typing neither rolls back the prompt nor steals its focus', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(60_000);
    const typed = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: '' } });
    const peer = await seedNode({ type: 'doc', x: 800, y: 0, data: { content: 'peer', public: false } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const node = page.locator(`.svelte-flow__node[data-id="${typed.id}"]`);
    const prompt = node.getByPlaceholder('What should it be about…');
    await node.click();
    await prompt.click();
    await prompt.pressSequentially(TYPED, { delay: KEY_DELAY_MS });

    const typing = prompt.pressSequentially(TYPED, { delay: KEY_DELAY_MS });
    await admin.from('nodes').update({ x: 900 }).eq('id', peer.id);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await typing;

    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 });
    await page.waitForTimeout(SAVES_SETTLE_MS);
    await expect(prompt).toHaveValue(TYPED + TYPED);
    await expect(prompt).toBeFocused();
    await expect(page.locator(`.svelte-flow__node[data-id="${peer.id}"]`)).toHaveAttribute('style', /translate\(900px/);
  });

  test('two tabs: what one types reaches the other, and the reply comes back', async ({ page, session, seedNode }) => {
    test.setTimeout(60_000);
    const typed = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: '' } });
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);

    const promptIn = (tab: typeof page) => tab.locator(`.svelte-flow__node[data-id="${typed.id}"]`).getByPlaceholder('What should it be about…');
    await page.locator(`.svelte-flow__node[data-id="${typed.id}"]`).click();
    await promptIn(page).click();
    await promptIn(page).pressSequentially(TYPED, { delay: KEY_DELAY_MS });
    await expect(promptIn(other)).toHaveValue(TYPED, { timeout: 10_000 });

    await page.locator('.svelte-flow__pane').click({ position: { x: 5, y: 5 } });
    await other.locator(`.svelte-flow__node[data-id="${typed.id}"]`).click();
    await promptIn(other).click();
    await promptIn(other).press('End');
    await promptIn(other).pressSequentially(' reply', { delay: KEY_DELAY_MS });
    await expect(promptIn(page)).toHaveValue(`${TYPED} reply`, { timeout: 10_000 });
  });
});

