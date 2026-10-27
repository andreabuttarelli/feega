import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, openCanvas } from './seed';
import { signInCli, typeCommand } from '../terminal';
import { openTerminalOverlay } from '../terminal-overlay';

const PICS = ['product-lifestyle', 'moodboard', 'product-teaser', 'thumbnail-cover'];
const AT = [{ x: 0, y: 0 }, { x: 460, y: 0 }, { x: 920, y: 0 }, { x: 1380, y: 0 }];
const PICKED = [0, 2];
const GRIP_PX = 20;

test('get_selection returns what the person selected', async ({ page, session, admin, seedNode }) => {
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
  await page.waitForTimeout(2000);

  const grip = async (id: string) => {
    const b = (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;
    return { x: b.x + GRIP_PX, y: b.y + b.height - GRIP_PX };
  };

  await recordDemo(page, { slug: 'get-selection', title: 'agents see your selection' }, async (d) => {
    await d.click(await grip(ids[PICKED[0]]));
    await page.keyboard.down('Shift');
    await d.click(await grip(ids[PICKED[1]]));
    await page.keyboard.up('Shift');
    await d.wait(1500);

    await openTerminalOverlay(page);
    const input = JSON.stringify({ canvasId: session.canvasId });
    await typeCommand(page, d, `feega canvas $P get_selection --input '{"canvasId":"$C"}'`, () => cli.run(['canvas', session.projectId, 'get_selection', '--input', input]));
    await d.wait(2000);
  });
});
