import { createClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, createE2eSession, teardownE2eSession, signInE2e } from './fixtures/session';

/**
 * LA TELA, DAL VERO BROWSER — due percorsi critici, non una copertura esaustiva. @real: richiede
 * uno stack disposable (E2E_REAL_STACK=1), lo stesso cancello di `onboarding.real.spec.ts` — qui
 * in più la sessione crea org/progetto/tela veri e li smonta in `finally` (vedi
 * fixtures/session.ts).
 */
test.describe('canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('la tela si apre senza 500 e senza overlay di errore', async ({ page, session }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    if (response) expect(response.status()).toBeLessThan(400);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await expect(page.locator('.svelte-flow')).toBeVisible();
    expect(consoleErrors, `console errors on canvas load: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('un nodo testo genera davvero: prompt, Genera, il testo compare senza ricaricare', async ({ page, session, seedNode }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale, unico step a pagamento');

    await seedNode({ type: 'text', data: { prompt: 'Scrivi una sola parola: pronto.', model: 'google/gemini-2.5-flash' } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const node = page.locator('.svelte-flow__node').last();
    await node.click();
    await node.getByRole('button', { name: /^Generate/ }).click();

    await expect(node.locator('.gen-text')).not.toBeEmpty({ timeout: 60_000 });
  });

  test('il testo generato compare senza ricaricare, anche se il prompt cambia mentre gira', async ({ page, session, seedNode }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale, unico step a pagamento');

    await seedNode({ type: 'text', data: { prompt: 'Scrivi una sola parola: pronto.', model: 'google/gemini-2.5-flash' } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const node = page.locator('.svelte-flow__node').last();
    await node.click();
    const prompt = node.getByPlaceholder('What should it be about…');
    await node.getByRole('button', { name: /^Generate/ }).click();

    await prompt.pressSequentially(' Grazie.');

    await expect(node.locator('.gen-text')).not.toBeEmpty({ timeout: 60_000 });
    await expect(prompt).toHaveValue('Scrivi una sola parola: pronto. Grazie.');
  });

  test('le modifiche di un agente arrivano sulla tela aperta senza ricaricare', async ({ page, session, seedNode }) => {
    const typed = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'Mine' } });
    const edited = await seedNode({ type: 'doc', x: 600, y: 0, data: { content: 'Before agent', public: false } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const anon = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const signedIn = await anon.auth.signInWithPassword({ email: session.email, password: session.password });
    const headers = { authorization: `Bearer ${signedIn.data.session!.access_token}` };
    const rows = `/api/v1/org/rows?org=${session.orgId}`;

    const typedNode = page.locator(`.svelte-flow__node[data-id="${typed.id}"]`);
    const editedNode = page.locator(`.svelte-flow__node[data-id="${edited.id}"]`);
    const prompt = typedNode.getByPlaceholder('What should it be about…');
    await typedNode.click();
    await prompt.click();
    await prompt.press('End');
    const typing = prompt.pressSequentially(' and still typing', { delay: 120 });

    const byId = (id: string) => [{ column: 'id', op: 'eq', value: id }];
    const content = await page.request.put(rows, { headers, data: { table: 'nodes', where: byId(edited.id), values: { data: { content: 'After agent' } } } });
    expect(content.ok()).toBe(true);
    const moved = await page.request.put(rows, { headers, data: { table: 'nodes', where: byId(edited.id), values: { x: 900 } } });
    expect(moved.ok()).toBe(true);
    const wired = await page.request.post(rows, {
      headers,
      data: { table: 'nodes_connections', values: { canvas_id: session.canvasId, source_node_id: edited.id, target_node_id: typed.id } }
    });
    expect(wired.ok()).toBe(true);
    const created = await page.request.post(rows, {
      headers,
      data: { table: 'nodes', values: { project_id: session.projectId, canvas_id: session.canvasId, type: 'doc', x: 300, y: 0, data: { content: 'Born from agent', public: false } } }
    });
    expect(created.ok()).toBe(true);

    await expect(editedNode).toContainText('After agent', { timeout: 2_000 });
    await expect(page.getByText('Born from agent')).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('.svelte-flow__edge')).toHaveCount(1, { timeout: 2_000 });
    await expect(editedNode).toHaveAttribute('style', /translate\(900px/, { timeout: 2_000 });

    await typing;
    await expect(prompt).toHaveValue('Mine and still typing');
  });

  test('a zero-credit org sees a readable message, not a generic save failure', async ({ page }) => {
    const session = await createE2eSession({ withCredits: false });
    try {
      await signInE2e(page, session);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByRole('button', { name: 'Text', exact: true }).click();

      const node = page.locator('.svelte-flow__node').last();
      await node.click();
      await node.getByLabel('Modello').selectOption({ index: 1 });
      await node.getByPlaceholder('What should it be about…').fill('Scrivi una sola parola: pronto.');
      await node.getByRole('button', { name: 'Generate' }).click();

      await expect(page.getByRole('alert')).toContainText(/credit/i, { timeout: 15_000 });
      await expect(page.getByRole('link', { name: 'Buy credits' })).toBeVisible();
    } finally {
      await teardownE2eSession(session);
    }
  });
});
