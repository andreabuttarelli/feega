import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT!;
const KIND = process.env.INSPECT_APP_KIND as 'svelte' | 'react';
const SHOTS = join(homedir(), 'Documents/feega-videos/library-panel');
mkdirSync(SHOTS, { recursive: true });

const TARGETS = {
  svelte: { component: 'src/lib/components/feega/Pricing.svelte', page: 'src/routes/+page.svelte', sheet: 'src/app.css', tokens: 'src/lib/components/feega/tokens.css', import: "import Pricing from '$lib/components/feega/Pricing.svelte';" },
  react: { component: 'src/components/feega/Pricing.tsx', page: 'src/App.jsx', sheet: 'src/index.css', tokens: 'src/components/feega/tokens.css', import: "import { Pricing } from './components/feega/Pricing';" }
};
const target = TARGETS[KIND];

function prepare() {
  const sheet = join(APP, target.sheet);
  if (!existsSync(sheet)) {
    writeFileSync(sheet, 'body { margin: 0; }\n');
  }
  const entry = KIND === 'svelte' ? 'src/routes/+layout.svelte' : 'src/main.jsx';
  const text = readFileSync(join(APP, entry), 'utf8');
  const line = KIND === 'svelte' ? "import '../app.css';" : "import './index.css';";
  if (!text.includes(line)) {
    writeFileSync(join(APP, entry), KIND === 'svelte' ? text.replace('let { children }', `${line}\n  let { children }`) : `${line}\n${text}`);
  }
}

const read = (path: string) => readFileSync(join(APP, path), 'utf8');
const check = (label: string, ok: boolean) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) {
    process.exitCode = 1;
  }
};

prepare();
const panel = await openPanel(APP);
const { page, frame } = panel;

await panel.pickAt('#title');
await page.locator('[data-testid=add-button]').click();
await page.locator('[data-testid=add-menu] [data-op=library]').click();
await page.locator('[data-testid=library]').waitFor();
await page.locator('[data-testid=library-item]').first().waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, `${KIND}-1-library-sections.png`) });
check('Library lists sections', (await page.locator('[data-testid=library-item]').count()) > 5);

await page.locator('[data-testid=library-search]').fill('pricing');
const card = page.locator('[data-testid=library-item][data-id=pricing]');
await card.waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, `${KIND}-2-library-search.png`) });

await card.locator('[data-testid=library-insert]').click();
await frame.locator('.fl-pricing').waitFor({ timeout: 30_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, `${KIND}-3-inserted.png`) });

check('component file written', existsSync(join(APP, target.component)));
check('tokens.css written', existsSync(join(APP, target.tokens)));
check('import added to the page', read(target.page).includes(target.import));
check('usage added to the page', read(target.page).includes('<Pricing />'));
check('tokens imported from the global stylesheet', read(target.sheet).includes('feega/tokens.css'));
check('fonts wired', read(target.sheet).includes('fonts.googleapis.com'));
check('preview renders the item', (await frame.locator('.fl-pricing').count()) === 1);

await panel.edits.undo();
await page.waitForTimeout(1500);
check('undo removes the component file', !existsSync(join(APP, target.component)));
check('undo restores the page', !read(target.page).includes('<Pricing />') && !read(target.page).includes(target.import));
check('undo restores the stylesheet', !read(target.sheet).includes('tokens.css'));

await panel.close();
