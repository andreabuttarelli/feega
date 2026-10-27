import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';
import { openTerminal, signInCli, typeCommand } from '../terminal';

const PLAN = {
  nodes: [
    { sourceIndex: 0, type: 'text', data: { prompt: 'Product name' }, x: 0, y: 0 },
    { sourceIndex: 1, type: 'image', data: { prompt: 'Studio product photo on warm paper, soft shadow, 3:4' }, x: 400, y: 0 }
  ],
  edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: 'derives_from', targetHandle: 'text' }]
};
const ROWS = [['Ceramic mug'], ['Linen tote bag'], ['Walnut desk lamp']];

test('run a technique on a list, stop at the cost', async ({ page, session, admin }) => {
  const name = 'product-shot';
  const cli = signInCli(process.env.E2E_BASE_URL!);
  const made = await admin
    .from('techniques' as never)
    .insert({ org_id: session.orgId, name, plan: PLAN, inputs: [{ node: 0, type: 'text' }], outputs: [{ node: 1, type: 'image' }], actor_kind: 'user', actor_id: session.userId } as never)
    .select('id')
    .single();
  expect(made.error?.message).toBeUndefined();
  const techniqueId = (made.data as unknown as { id: string }).id;

  try {
    await installCursor(page);
    await openCanvas(page, session);

    await recordDemo(page, { slug: 'batch-technique', title: 'run a technique on a list' }, async (d) => {
      await d.click(page.getByRole('button', { name: 'Templates', exact: true }));
      await d.click(page.getByTestId('technique-pick').filter({ hasText: name }));
      await page.waitForTimeout(2500);
      await page.waitForTimeout(2500);
      const node = page.locator('[data-testid="gpu-node"]').first();
      const box = (await node.boundingBox())!;
      const grip = { x: box.x + 24, y: box.y + box.height - 24 };
      await d.click(grip);
      await d.click(grip, { button: 'right' });
      await d.click(page.getByRole('menuitem', { name: /Run on a list/ }));
      await d.type(page.getByTestId('technique-rows-text'), ROWS.map((r) => r[0]).join('\n'));
      await expect(page.getByTestId('technique-rows-count')).toContainText('3 rows');
      await d.click(page.getByTestId('technique-rows-estimate'));
      await expect(page.getByTestId('technique-rows-cost')).toBeVisible({ timeout: 30_000 });
      await d.wait(3000);
      await openTerminal(page);
      const input = JSON.stringify({ techniqueId, rows: ROWS });
      await typeCommand(page, d, `feega canvas $P preview_technique_rows --input '{"techniqueId":"$T","rows":[["Ceramic mug"],["Linen tote bag"],["Walnut desk lamp"]]}'`, () => cli.run(['canvas', session.projectId, 'preview_technique_rows', '--input', input]));
    });
  } finally {
    await admin.from('techniques' as never).delete().eq('id', techniqueId);
  }
});
