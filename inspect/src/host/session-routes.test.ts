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

function setup(files: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'feega-session-routes-'));
  for (const file of ['package.json', ...files]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), file === 'package.json' ? '{"dependencies":{"astro":"1"}}' : '');
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

const routesSent = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Routes) as Extract<ViewMessage, { kind: ToView.Routes }>[];

describe('pages of the project', () => {
  it('sends the file-based routes when the view asks', async () => {
    const { sent, send } = setup(['src/routes/+page.svelte', 'src/routes/blog/[slug]/+page.svelte']);

    await send({ kind: ToHost.Routes });

    expect(routesSent(sent).at(-1)?.routes).toEqual([
      { route: '/', dynamic: false },
      { route: '/blog/[slug]', dynamic: true }
    ]);
  });

  it('includes a page created from the view in the routes sent right after', async () => {
    const { sent, send } = setup(['src/pages/index.astro', 'src/layouts/Layout.astro']);

    await send({ kind: ToHost.NewPage, route: 'about', item: null });

    expect(routesSent(sent).at(-1)?.routes.map((r) => r.route)).toEqual(['/', '/about']);
  });
});
