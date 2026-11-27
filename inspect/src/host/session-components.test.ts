import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
  return { sent, send: (m: HostMessage) => deliver(m) };
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
      { name: 'Card', file: 'src/lib/Card.svelte', folder: 'lib', uses: 1 },
      { name: 'Button', file: 'src/lib/ui/Button.svelte', folder: 'lib/ui', uses: 1 }
    ]);
  });

  it('leaves the pages out', async () => {
    const { sent, send } = setup({ 'src/routes/+page.svelte': '<h1 />' });

    await send({ kind: ToHost.Components });

    expect(componentsSent(sent).at(-1)?.components).toEqual([]);
  });
});
