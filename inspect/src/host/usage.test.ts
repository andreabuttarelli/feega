import { describe, expect, it } from 'vitest';
import { SettingKey } from '../settings';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditKind, editorOf, fileFirstEdit, installIdOf, nodeUsageEnabled, usageSession, type Identity, type UsageEvent, type UsageHost } from './usage';

const identity: Identity = { installId: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', version: '0.2.9', editor: 'vscode', os: 'darwin', arch: 'arm64', device: 'desktop' };

function setup(enabled = () => true, extra: Partial<UsageHost> = {}) {
  const sent: UsageEvent[][] = [];
  let clock = 1_000;
  let tick: (() => void) | null = null;
  const session = usageSession(
    {
      identity: () => identity,
      enabled,
      send: async (events) => void sent.push(events),
      now: () => clock,
      every: (_ms, run) => ((tick = run), () => (tick = null)),
      newId: () => '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77',
      ...extra
    }
  );
  return { session, sent, advance: (ms: number) => (clock += ms), tick: () => tick?.(), ticking: () => tick !== null };
}

describe('usageSession', () => {
  it('sends the whole session in one batch when it ends', async () => {
    const t = setup();
    t.session.begin();
    t.session.edit();
    t.session.edit();
    t.advance(90_000);
    await t.session.end();

    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].map((e) => e.event)).toEqual(['session_start', 'edit', 'edit', 'session_end']);
    expect(t.sent[0][3]).toMatchObject({ duration_ms: 90_000, edit_count: 2 });
    expect(t.sent[0][0]).toMatchObject({ install_id: identity.installId, ext_version: '0.2.9', editor: 'vscode', os: 'darwin', arch: 'arm64', device: 'desktop', session_id: '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77' });
  });

  it('every event carries exactly the fields the server accepts', async () => {
    const t = setup();
    t.session.begin();
    await t.session.end();

    expect(Object.keys(t.sent[0][0]).sort()).toEqual(['arch', 'device', 'editor', 'event', 'ext_version', 'install_id', 'os', 'session_id']);
  });

  it('the interval flushes what is queued and the end sends only the rest', async () => {
    const t = setup();
    t.session.begin();
    t.session.edit();
    t.tick();
    await Promise.resolve();
    t.session.edit();
    await t.session.end();

    expect(t.sent.map((batch) => batch.map((e) => e.event))).toEqual([['session_start', 'edit'], ['edit', 'session_end']]);
  });

  it('ends once, and ignores edits after the end', async () => {
    const t = setup();
    t.session.begin();
    await t.session.end();
    await t.session.end();
    t.session.edit();

    expect(t.sent).toHaveLength(1);
    expect(t.ticking()).toBe(false);
  });

  it('never builds the identity while telemetry is off', async () => {
    let built = 0;
    const session = usageSession({ identity: () => (built++, identity), enabled: () => false, send: async () => undefined, every: () => () => undefined });
    session.begin();
    session.edit();
    await session.end();

    expect(built).toBe(0);
  });

  it('sends nothing while telemetry is off', async () => {
    const t = setup(() => false);
    t.session.begin();
    t.session.edit();
    t.tick();
    await t.session.end();

    expect(t.sent).toEqual([]);
  });

  it('turning telemetry off mid-session drops what was queued', async () => {
    let on = true;
    const t = setup(() => on);
    t.session.begin();
    t.session.edit();
    on = false;
    t.session.recheck();
    on = true;
    await t.session.end();

    expect(t.sent.flatMap((b) => b.map((e) => e.event))).toEqual(['session_end']);
  });

  it('a failing send never throws', async () => {
    const throwing = usageSession({
      identity: () => identity,
      enabled: () => true,
      send: () => {
        throw new Error('offline');
      },
      now: () => 0,
      every: () => () => undefined,
      newId: () => '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77'
    });
    const rejecting = usageSession({ identity: () => identity, enabled: () => true, send: () => Promise.reject(new Error('503')), now: () => 0, every: () => () => undefined, newId: () => '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77' });

    throwing.begin();
    rejecting.begin();
    await expect(throwing.end()).resolves.toBeUndefined();
    await expect(rejecting.end()).resolves.toBeUndefined();
  });
});

const firstEditFlag = () => {
  let seen = false;
  return { seen: () => seen, mark: () => void (seen = true) };
};

describe('usageSession funnel', () => {
  it('sends preview_ready once per session', async () => {
    const t = setup();
    t.session.begin();
    t.session.previewReady();
    t.session.previewReady();
    await t.session.end();

    expect(t.sent[0].map((e) => e.event)).toEqual(['session_start', 'preview_ready', 'session_end']);
  });

  it('sends first_edit once per install, before the edit', async () => {
    const firstEdit = firstEditFlag();
    const t = setup(() => true, { firstEdit });
    t.session.begin();
    t.session.edit();
    t.session.edit();
    await t.session.end();

    expect(t.sent[0].map((e) => e.event)).toEqual(['session_start', 'first_edit', 'edit', 'edit', 'session_end']);

    const next = setup(() => true, { firstEdit });
    next.session.begin();
    next.session.edit();
    await next.session.end();

    expect(next.sent[0].map((e) => e.event)).toEqual(['session_start', 'edit', 'session_end']);
  });

  it('edit events carry the edit kind', async () => {
    const t = setup();
    t.session.begin();
    t.session.edit(EditKind.Style);
    t.session.edit();
    await t.session.end();

    expect(t.sent[0].filter((e) => e.event === 'edit').map((e) => e.edit_kind)).toEqual(['style', 'other']);
  });

  it('every event carries framework and signed_in as known at send time', async () => {
    let facts = { framework: null as string | null, signedIn: false };
    const t = setup(() => true, { facts: () => facts });
    t.session.begin();
    facts = { framework: 'next', signedIn: true };
    t.session.edit(EditKind.Text);
    await t.session.end();

    expect(t.sent[0].every((e) => e.framework === 'next' && e.signed_in === true)).toBe(true);
  });

  it('omits framework while it is unknown', async () => {
    const t = setup(() => true, { facts: () => ({ framework: null, signedIn: false }) });
    t.session.begin();
    await t.session.end();

    expect(t.sent[0][0]).not.toHaveProperty('framework');
    expect(t.sent[0][0]).toMatchObject({ signed_in: false });
  });

  it('sends no funnel event while telemetry is off', async () => {
    const t = setup(() => false, { firstEdit: firstEditFlag() });
    t.session.begin();
    t.session.previewReady();
    t.session.edit();
    await t.session.end();

    expect(t.sent).toEqual([]);
  });
});

describe('fileFirstEdit', () => {
  it('is unseen until marked, then stays seen', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feega-first-')), 'nested', 'first-edit');
    const flag = fileFirstEdit(path);

    expect(flag.seen()).toBe(false);
    flag.mark();

    expect(fileFirstEdit(path).seen()).toBe(true);
  });
});

describe('installIdOf', () => {
  it('creates an id once and reuses it', async () => {
    const stored = new Map<string, string>();
    const store = { get: () => stored.get('id'), set: async (id: string) => void stored.set('id', id) };
    const first = installIdOf(store, () => 'a0000000-0000-4000-8000-000000000000');
    const second = installIdOf(store, () => 'b0000000-0000-4000-8000-000000000000');

    expect(first).toBe('a0000000-0000-4000-8000-000000000000');
    expect(second).toBe(first);
  });

  it('replaces a stored value that is not a uuid', async () => {
    const store = { get: () => 'garbage', set: async () => undefined };

    expect(installIdOf(store, () => 'c0000000-0000-4000-8000-000000000000')).toBe('c0000000-0000-4000-8000-000000000000');
  });
});

describe('editorOf', () => {
  it.each([
    ['Visual Studio Code', 'vscode'],
    ['Visual Studio Code - Insiders', 'vscode'],
    ['Cursor', 'cursor'],
    ['Windsurf', 'windsurf'],
    ['VSCodium', 'vscodium'],
    ['Something Else', 'vscode']
  ])('%s is %s', (appName, expected) => {
    expect(editorOf(appName)).toBe(expected);
  });
});

describe('nodeUsageEnabled', () => {
  const settings = (value: unknown) => ({ [SettingKey.Telemetry]: value }) as never;

  it('is on by default', () => {
    expect(nodeUsageEnabled({}, settings(true))).toBe(true);
  });

  it.each([
    ['FEEGA_TELEMETRY=0', { FEEGA_TELEMETRY: '0' }],
    ['DO_NOT_TRACK=1', { DO_NOT_TRACK: '1' }]
  ])('%s turns it off', (_name, env) => {
    expect(nodeUsageEnabled(env, settings(true))).toBe(false);
  });

  it('the setting turns it off', () => {
    expect(nodeUsageEnabled({}, settings(false))).toBe(false);
  });
});
