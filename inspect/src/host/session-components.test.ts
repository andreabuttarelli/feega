import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

function setup(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'feega-session-components-'));
  for (const [file, text] of Object.entries({ 'package.json': '{"dependencies":{"svelte":"5","@sveltejs/kit":"2"}}', ...files })) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  const sent: ViewMessage[] = [];
  let deliver: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => void sent.push(m),
    receive: (cb: (m: HostMessage) => unknown) => (deliver = cb),
    settings: () => ({ [SettingKey.PreviewUnknown]: false }),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    watchFiles: () => ({ dispose: () => undefined })
  } as unknown as Platform;
  inspectSession(platform, root);
  return { root, sent, send: (m: HostMessage) => deliver(m) };
}

const componentsSent = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Components) as Extract<ViewMessage, { kind: ToView.Components }>[];

describe('components of the project', () => {
  it('sends every component with its folder and how many files use it, when the view asks', async () => {
    const { sent, send } = setup({
      'src/lib/ui/Button.svelte': '<button><slot /></button>',
      'src/lib/Card.svelte': '<script>\nimport Button from "./ui/Button.svelte";\n</script>\n<Button />',
      'src/routes/+page.svelte': '<script>\nimport Card from "$lib/Card.svelte";\n</script>\n<Card />'
    });

    await send({ kind: ToHost.Components });

    expect(componentsSent(sent).at(-1)?.components).toEqual([
      { name: 'Card', file: 'src/lib/Card.svelte', folder: 'lib', uses: 1, examples: [{ id: 'src/routes/+page.svelte:4', file: 'src/routes/+page.svelte', line: 4, props: {}, unresolved: [] }] },
      { name: 'Button', file: 'src/lib/ui/Button.svelte', folder: 'lib/ui', uses: 1, examples: [{ id: 'src/lib/Card.svelte:4', file: 'src/lib/Card.svelte', line: 4, props: {}, unresolved: [] }] }
    ]);
  });

  it('leaves the pages out', async () => {
    const { sent, send } = setup({ 'src/routes/+page.svelte': '<h1 />' });

    await send({ kind: ToHost.Components });

    expect(componentsSent(sent).at(-1)?.components).toEqual([]);
  });
});

const LIVE_WAIT_MS = 1500;
const FIXTURE_SETTLE_MS = 400;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('the project changing while the view is open', () => {
  it('pushes the new page and the new component without being asked, and drops the deleted one', async () => {
    const { root, sent, send } = setup({ 'src/routes/+page.svelte': '<h1 />', 'src/lib/Card.svelte': '<div />' });
    await pause(FIXTURE_SETTLE_MS);
    await send({ kind: ToHost.Routes });
    await send({ kind: ToHost.Components });
    await pause(FIXTURE_SETTLE_MS);

    mkdirSync(join(root, 'src/routes/pricing'), { recursive: true });
    writeFileSync(join(root, 'src/routes/pricing/+page.svelte'), '<h1 />');
    writeFileSync(join(root, 'src/lib/Badge.svelte'), '<b />');
    rmSync(join(root, 'src/lib/Card.svelte'));
    await pause(LIVE_WAIT_MS);

    const routes = sent.filter((m) => m.kind === ToView.Routes) as Extract<ViewMessage, { kind: ToView.Routes }>[];
    expect(routes.at(-1)?.routes.map((r) => r.route)).toEqual(['/', '/pricing']);
    expect(componentsSent(sent).at(-1)?.components.map((c) => c.name)).toEqual(['Badge']);
  });
});
