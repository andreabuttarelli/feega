import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '@feega/live-edit/live-fields';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const AT = 'src/Page.svelte:1:1';
const PADDING = { at: AT, prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 };

function setup() {
  const sent: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const dir = mkdtempSync(join(tmpdir(), 'feega-session-revert-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }));
  writeFileSync(join(dir, 'src/Page.svelte'), '<section class="px-4 py-8"></section>\n');
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  inspectSession(platform, dir);
  return { sent, send: (m: HostMessage) => handle(m) };
}

const edited = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Edited);

describe('reverting a single change', () => {
  it('tells the view the source went back, so live previews are dropped', async () => {
    const { sent, send } = setup();
    await send({ kind: ToHost.Edit, ask: PADDING });
    const history = sent.filter((m) => m.kind === ToView.History).at(-1) as Extract<ViewMessage, { kind: ToView.History }>;
    sent.length = 0;
    await send({ kind: ToHost.Revert, id: history.changes[0].id });

    expect(edited(sent)).toEqual([expect.objectContaining({ ok: true, fromHistory: true })]);
  });

  it('an edit is not flagged as from history', async () => {
    const { sent, send } = setup();
    await send({ kind: ToHost.Edit, ask: PADDING });

    expect(edited(sent)).toEqual([expect.objectContaining({ ok: true })]);
    expect(edited(sent)[0]).not.toHaveProperty('fromHistory', true);
  });
});

describe('reverting everything', () => {

  it('also tells the view the source went back', async () => {

    const { sent, send } = setup();

    await send({ kind: ToHost.Edit, ask: PADDING });

    sent.length = 0;

    await send({ kind: ToHost.Revert, id: null });



    expect(edited(sent)).toEqual([expect.objectContaining({ ok: true, fromHistory: true })]);

  });

});
