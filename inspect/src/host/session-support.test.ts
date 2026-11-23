import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { SUPPORT_ITEMS, SupportItem } from '../support';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { memorySupportStore } from './support';
import { Device, Editor, type UsageEvent } from './usage';

const SHARE = SUPPORT_ITEMS.find((i) => i.id === SupportItem.Share)!;

function setup() {
  const views: ViewMessage[] = [];
  const events: UsageEvent[] = [];
  const opened: string[] = [];
  const copied: string[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const support = memorySupportStore();
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => views.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    notify: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    support,
    openExternal: (url: string) => void opened.push(url),
    copyText: async (text: string) => void copied.push(text),
    usage: {
      identity: () => ({ installId: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', version: '1.0.0', editor: Editor.Npx, os: 'linux', arch: 'x64', device: Device.Cli }),
      enabled: () => true,
      send: async (batch: UsageEvent[]) => void events.push(...batch),
      every: () => () => undefined
    }
  } as unknown as Platform;
  const session = inspectSession(platform, mkdtempSync(join(tmpdir(), 'feega-support-s-')));
  const send = async (m: HostMessage) => {
    await handle(m);
    await new Promise((r) => setTimeout(r, 20));
  };
  const supportViews = () => views.filter((m): m is Extract<ViewMessage, { kind: ToView.Support }> => m.kind === ToView.Support);
  const actions = async () => {
    await session.stop();
    return events.filter((e) => e.event === 'support_action');
  };
  return { send, support, opened, copied, supportViews, actions };
}

describe('support in the session', () => {
  it('ready tells the view what is already done', async () => {
    const t = setup();
    await t.support.mark(SupportItem.Star);
    await t.send({ kind: ToHost.Ready });

    expect(t.supportViews().at(-1)?.done).toEqual([SupportItem.Star]);
  });

  it('a linked item opens its page, is remembered, shown and counted', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Support, item: SupportItem.Discord });

    expect(t.opened).toEqual(['https://discord.gg/PUp37DG6vr']);
    expect(await t.support.read()).toEqual([SupportItem.Discord]);
    expect(t.supportViews().at(-1)?.done).toEqual([SupportItem.Discord]);
    expect((await t.actions()).map((e) => e.item)).toEqual([SupportItem.Discord]);
  });

  it('share copies the text and opens nothing', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Support, item: SupportItem.Share });

    expect(t.copied).toEqual([SHARE.text]);
    expect(t.opened).toEqual([]);
    expect(await t.support.read()).toEqual([SupportItem.Share]);
  });
});
