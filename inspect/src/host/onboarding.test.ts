import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Onboarding, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { deviceOnboardingStore, fileOnboardingStore, globalStateOnboardingStore, memoryOnboardingStore, type OnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const freshPath = () => join(mkdtempSync(join(tmpdir(), 'feega-onb-')), 'feega', 'onboarding.json');

const globalState = () => {
  const held = new Map<string, unknown>();
  return globalStateOnboardingStore({ get: (k: string) => held.get(k), update: async (k: string, v: unknown) => void held.set(k, v) });
};

const STORES: [string, () => OnboardingStore][] = [
  ['memory', memoryOnboardingStore],
  ['file', () => fileOnboardingStore(freshPath())],
  ['global state', globalState]
];

describe.each(STORES)('the %s onboarding store', (_name, make) => {
  it('starts pending and stays seen once marked', async () => {
    const store = make();

    expect(await store.read()).toBe(Onboarding.Pending);
    await store.markSeen();

    expect(await store.read()).toBe(Onboarding.Seen);
  });
});

describe('the file onboarding store', () => {
  it('is remembered by the next run on the same device', async () => {
    const path = freshPath();
    await fileOnboardingStore(path).markSeen();

    expect(await fileOnboardingStore(path).read()).toBe(Onboarding.Seen);
  });

  it('treats an unreadable file as pending', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feega-onb-')), 'onboarding.json');
    await writeFile(path, '{nope');

    expect(await fileOnboardingStore(path).read()).toBe(Onboarding.Pending);
  });
});

function setup() {
  const sent: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const onboarding = memoryOnboardingStore();
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: { read: async () => null, write: async () => undefined, clear: async () => undefined },
    onboarding
  } as unknown as Platform;
  inspectSession(platform, mkdtempSync(join(tmpdir(), 'feega-onb-s-')));
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { sent, onboarding, send: (m: HostMessage) => handle(m), until };
}

const states = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Onboarding).map((m) => (m as Extract<ViewMessage, { kind: ToView.Onboarding }>).state);

describe('onboarding in the session', () => {
  it('ready on a new device asks the view to show it', async () => {
    const t = setup();
    t.send({ kind: ToHost.Ready });
    await t.until(() => states(t.sent).length > 0);

    expect(states(t.sent)).toEqual([Onboarding.Pending]);
  });

  it('done is remembered, so the next ready stays quiet', async () => {
    const t = setup();
    t.send({ kind: ToHost.OnboardingDone });
    await t.until(() => false);
    t.send({ kind: ToHost.Ready });
    await t.until(() => states(t.sent).length > 0);

    expect(await t.onboarding.read()).toBe(Onboarding.Seen);
    expect(states(t.sent)).toEqual([Onboarding.Seen]);
  });
});

describe('the device onboarding store', () => {
  it('is seen in VS Code once npx or the desktop app showed it on this device', async () => {
    const path = freshPath();
    await fileOnboardingStore(path).markSeen();

    expect(await deviceOnboardingStore(globalState(), path).read()).toBe(Onboarding.Seen);
  });

  it('is seen by npx and the desktop app once VS Code showed it on this device', async () => {
    const path = freshPath();
    await deviceOnboardingStore(globalState(), path).markSeen();

    expect(await fileOnboardingStore(path).read()).toBe(Onboarding.Seen);
  });

  it('stays seen in a VS Code profile that already showed it', async () => {
    const state = globalState();
    await state.markSeen();

    expect(await deviceOnboardingStore(state, freshPath()).read()).toBe(Onboarding.Seen);
  });
});
