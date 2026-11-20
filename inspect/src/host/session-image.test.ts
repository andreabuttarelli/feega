import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

type Chosen = { name: string; bytes: Uint8Array } | null;

function setup(chosen?: Chosen) {
  const sent: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const dir = mkdtempSync(join(tmpdir(), 'feega-session-img-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '1' } }));
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    pickImage: chosen === undefined ? undefined : async () => chosen,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  inspectSession(platform, dir);
  return { dir, sent, send: (m: HostMessage) => handle(m) };
}

const saved = (sent: ViewMessage[]) => sent.find((m) => m.kind === ToView.ImageSaved);

describe('an image chosen for a fill', () => {
  it('an uploaded file is copied into the public folder and its url comes back', async () => {
    const { dir, sent, send } = setup();

    await send({ kind: ToHost.ImageUpload, name: 'hero.jpg', data: Buffer.from([1, 2, 3]).toString('base64') });

    expect(saved(sent)).toEqual({ kind: ToView.ImageSaved, url: '/images/hero.jpg' });
    expect(existsSync(join(dir, 'public/images/hero.jpg'))).toBe(true);
  });

  it('the file picker of the host feeds the same copy', async () => {
    const { dir, sent, send } = setup({ name: 'bg.png', bytes: new Uint8Array([9]) });

    await send({ kind: ToHost.ImageChoose });

    expect(saved(sent)).toEqual({ kind: ToView.ImageSaved, url: '/images/bg.png' });
    expect(existsSync(join(dir, 'public/images/bg.png'))).toBe(true);
  });

  it('a cancelled picker says nothing', async () => {
    const { sent, send } = setup(null);

    await send({ kind: ToHost.ImageChoose });

    expect(saved(sent)).toBeUndefined();
  });

  it('a file that is not an image is reported, not copied', async () => {
    const { dir, sent, send } = setup();

    await send({ kind: ToHost.ImageUpload, name: 'x.js', data: '' });

    expect(saved(sent)).toBeUndefined();
    expect(sent.find((m) => m.kind === ToView.Edited)).toMatchObject({ ok: false });
    expect(existsSync(join(dir, 'public'))).toBe(false);
  });
});
