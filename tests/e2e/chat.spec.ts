import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.describe('chat @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('i due turni sopravvivono al reload', async ({ page, session, admin }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale');

    const prompt = 'Rispondi solo con la parola: pronto';
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('#chat-composer-input').fill(prompt);
    await page.locator('#chat-composer-input').press('Enter');
    await expect(page.locator('.msg.is-assistant').last()).toContainText(/pronto/i, { timeout: 60_000 });

    await expect
      .poll(async () => (await admin.from('chat_messages').select('role').eq('org_id', session.orgId)).data?.length, { timeout: 15_000 })
      .toBe(2);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('.msg.is-user')).toContainText(prompt);
    await expect(page.locator('.msg.is-assistant')).toContainText(/pronto/i);
  });
});
