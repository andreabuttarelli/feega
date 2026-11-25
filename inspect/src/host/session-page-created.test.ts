import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { PageTarget } from '@feega/live-edit/page-rule';
import { ToHost, ToView, type EditAsk, type HostMessage, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'feega-created-'));
  mkdirSync(join(root, 'src/layouts'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'src/layouts/Layout.astro'), '<html><body><slot /></body></html>\n');
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
  return { sent, send: (ask: EditAsk) => deliver({ kind: ToHost.Edit, ask }) };
}

const body = (color: string): EditAsk => ({ at: 'page', page: PageTarget.Body, prop: LiveProp.Color, value: color, css: { 'background-color': color } });

const edited = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Edited) as Extract<ViewMessage, { kind: ToView.Edited }>[];

describe('page style written to a new block', () => {
  it('hands the view the rule to inject, only for the write that created the block', async () => {
    const { sent, send } = setup();

    await send(body('#111111'));
    await send(body('#222222'));

    const [first, second] = edited(sent);
    expect(first.inject).toEqual({ 'background-color': '#111111' });
    expect(second.inject).toBeUndefined();
  });
});
