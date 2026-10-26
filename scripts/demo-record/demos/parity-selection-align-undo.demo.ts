import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, openCanvas } from './seed';
import { openTerminal, signInCli, typeCommand } from '../terminal';

const PICS = ['product-lifestyle', 'moodboard', 'product-teaser', 'thumbnail-cover'];
const AT = [{ x: 0, y: 60 }, { x: 520, y: -80 }, { x: 180, y: 380 }, { x: 760, y: 300 }];
const GRIP_PX = 20;

test('align, tidy and stack a selection', async ({ page, session, admin, seedNode }) => {
  const ids: string[] = [];
  for (const [i, pic] of PICS.entries()) {
    const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'imported', url: asset(`/templates/${pic}.webp`) }).select('id').single();
    expect(row.error).toBeNull();
    const node = await seedNode({ type: 'image', x: AT[i].x, y: AT[i].y, data: { prompt: pic, refId: row.data!.id } });
    ids.push(node.id);
  }
  const cli = signInCli(process.env.E2E_BASE_URL!);
  await installCursor(page);
  await openCanvas(page, session);
  await page.waitForTimeout(2500);

  const grip = async (id: string) => {
    const b = (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;
    return { x: b.x + GRIP_PX, y: b.y + b.height - GRIP_PX };
  };

  await recordDemo(page, { slug: 'parity-selection-align-undo', title: 'align, tidy and stack' }, async (d) => {
    await d.click(await grip(ids[0]));
    await page.keyboard.down('Shift');
    for (const id of ids.slice(1)) {
      await d.click(await grip(id));
    }
    await page.keyboard.up('Shift');
    await d.wait(800);

    for (const action of ['Tidy up', 'Stack']) {
      await d.click(await grip(ids[0]), { button: 'right' });
      await d.click(page.getByRole('menuitem', { name: new RegExp(`^${action}`) }));
      await d.wait(1800);
    }
    await d.key('Meta+Z', '⌘Z');
    await d.wait(1500);

    const op = (name: string, input: object) => () => cli.run(['canvas', session.projectId, name, '--input', JSON.stringify(input)]);
    const shown = (name: string, fields = '') => `feega canvas $P ${name} --input "{\\"canvasId\\":\\"$C\\"${fields}}"`;
    const arrange = { canvasId: session.canvasId, nodeIds: ids };
    const note = { canvasId: session.canvasId, type: 'text', x: 0, y: 0, data: { prompt: 'Draft headline' } };
    await openTerminal(page);
    await typeCommand(page, d, shown('align_nodes', ',\\"nodeIds\\":$NODES,\\"edge\\":\\"top\\"'), op('align_nodes', { ...arrange, edge: 'top' }));
    await typeCommand(page, d, shown('create_node', ',\\"type\\":\\"text\\",\\"data\\":$DRAFT'), op('create_node', note));
    await typeCommand(page, d, shown('undo_last'), op('undo_last', { canvasId: session.canvasId }));
  });
});
