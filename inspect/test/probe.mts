import { openPanel } from './harness.mts';

const panel = await openPanel(process.argv[2]);
await panel.page.waitForTimeout(3000);
await panel.page.screenshot({ path: '/private/tmp/claude-501/-Users-andreabuttarelli-Documents-GitHub-dazero/1ef646a9-66cd-4872-b3d2-4ba2df96ee08/scratchpad/next-probe.png' });
console.log('cards', await panel.frame.locator('#card').count(), 'url', panel.url);
await panel.close();
process.exit(0);
