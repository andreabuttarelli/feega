import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openTerminal, signInCli, typeCommand } from '../terminal';

const PRODUCT_PHOTO = '/templates/product-teaser.webp';

test('photo studio batch: price it from the CLI, stop before start', async ({ page, session, admin }) => {
  const cli = signInCli(process.env.E2E_BASE_URL!);
  const dir = mkdtempSync(join(tmpdir(), 'studio-'));
  const source = join(dir, 'ceramic-mug.webp');
  writeFileSync(source, Buffer.from(await (await fetch(`${process.env.E2E_BASE_URL}${PRODUCT_PHOTO}`)).arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-vf', 'scale=1200:-1', join(dir, 'ceramic-mug.jpg')]);
  await installCursor(page);
  await gotoHydrated(page, `/app/studio?project=${session.projectId}`);
  await page.getByTestId('studio-file').setInputFiles({ name: 'ceramic-mug.jpg', mimeType: 'image/jpeg', buffer: readFileSync(join(dir, 'ceramic-mug.jpg')) });
  await expect(page.getByText('Added to your products.')).toBeVisible({ timeout: 30_000 });

  await recordDemo(page, { slug: 'studio-batch-agent-api', title: 'photo studio batches from the CLI' }, async (d) => {
    await d.wait(1200);
    await d.click(page.getByTestId('studio-next-influencer'));
    await d.click(page.getByTestId('studio-skip-influencer'));
    await d.click(page.getByTestId('studio-style-marble'));
    await d.click(page.getByTestId('studio-next-generate'));
    await d.click(page.getByRole('radio', { name: '1', exact: true }));
    await expect(page.getByTestId('studio-cost')).toBeVisible();
    await d.wait(2500);

    const lists = await admin.from('nodes').select('data').eq('project_id', session.projectId).eq('type', 'list');
    const items = (lists.data ?? []).flatMap((n) => ((n.data as { items?: { asset_id: string }[] }).items ?? []));
    const file = join(dir, 'selection.json');
    const selection = { name: 'Mug launch', productIds: [`upload:${items[0].asset_id}`], environments: ['marble'], shots: ['packshot'], variations: 1, model: 'nano-banana-pro' };
    writeFileSync(file, JSON.stringify(selection, null, 2));

    await openTerminal(page);
    await typeCommand(page, d, 'cat selection.json', () => readFileSync(file, 'utf8'));
    await typeCommand(page, d, 'feega studio quote --file selection.json --project $P', () => cli.run(['studio', 'quote', '--file', file, '--project', session.projectId]));
  });
});
