import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { RENDER_BUCKET, mintRenderLink, renderOnPage, renderedAsset, seedMotion } from './fixtures/render-link';

const DOCS = ['flat', 'mattes', 'three', 'particles'];
const MIN_PSNR_DB = 40;
const RENDER_TIMEOUT_MS = 180_000;
const EXACT = '?capture=exact';

function averagePsnr(a: string, b: string): number {
  const run = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${a}" -i "${b}" -lavfi psnr -f null - 2>&1`], { encoding: 'utf8' });
  const match = /average:(inf|[\d.]+)/.exec(run);
  expect(match, run.slice(-400)).not.toBeNull();
  return match![1] === 'inf' ? Infinity : Number(match![1]);
}

test.describe('fast capture matches the exact capture @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(RENDER_TIMEOUT_MS * 3);

  for (const name of DOCS) {
    test(`${name}: PSNR ≥ ${MIN_PSNR_DB} dB`, async ({ page, session, admin, seedNode }) => {
      const doc = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/render-parity', `${name}.json`), 'utf8'));
      const nodeId = await seedMotion(admin, session, seedNode, doc);
      const dir = mkdtempSync(join(tmpdir(), `parity-${name}-`));
      const files: string[] = [];

      for (const query of [EXACT, '']) {
        const link = await mintRenderLink(admin, session, nodeId);
        await gotoHydrated(page, `${link.url}${query}`);
        const ms = await renderOnPage(page, RENDER_TIMEOUT_MS);
        test.info().annotations.push({ type: query ? 'exact-ms' : 'fast-ms', description: String(ms) });

        const asset = await renderedAsset(admin, link.runId);
        const { data } = await admin.storage.from(RENDER_BUCKET).download(asset.url);
        const file = join(dir, `${query ? 'exact' : 'fast'}.mp4`);
        writeFileSync(file, Buffer.from(await data!.arrayBuffer()));
        files.push(file);
        await admin.storage.from(RENDER_BUCKET).remove([asset.url]);
      }

      expect(averagePsnr(files[0], files[1])).toBeGreaterThanOrEqual(MIN_PSNR_DB);
    });
  }
});
