import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { Gate, ToHost, ToView, type Authored, type EditAsk, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const FIXTURE = join(__dirname, 'impact-fixtures/react');
const ADA = { userId: 'ada', name: 'Ada' };
const BO = { userId: 'bo', name: 'Bo' };

function setup(live = false) {
  const root = mkdtempSync(join(tmpdir(), 'feega-collab-'));
  cpSync(FIXTURE, root, { recursive: true });
  const sent: ViewMessage[] = [];
  let deliver: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => void sent.push(m),
    receive: (cb: (m: HostMessage) => unknown) => (deliver = cb),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    watchFiles: () => ({ dispose: () => undefined }),
    share: live ? { editorUrl: async () => 'http://127.0.0.1:1/', control: () => ({ start: async () => ({ id: 's', url: 'https://x.test', expiresAt: '2026-11-25T00:00:00Z' }), stop: async () => undefined, kick: () => undefined, setRole: async () => undefined }) } : undefined
  } as unknown as Platform;
  inspectSession(platform, root);
  const text = (file: string) => readFileSync(join(root, file), 'utf8');
  const history = () => [...sent].reverse().find((m) => m.kind === ToView.History) as Extract<ViewMessage, { kind: ToView.History }>;
  return { sent, text, history, send: (m: Authored) => deliver(m) };
}

const colour = (at: string): EditAsk => ({ at, prop: LiveProp.Color, value: 'blue', css: { color: 'blue' } });
const card = colour('src/components/Card.tsx:4:10');
const button = colour('src/components/Button.tsx:4:10');
const hero = colour('src/components/Hero.tsx:4:10');

describe('guest edits in the host session', () => {
  it('applies concurrent guest edits on different elements, both reach the source', async () => {
    const { send, text } = setup();

    await Promise.all([send({ kind: ToHost.Edit, ask: card, by: ADA }), send({ kind: ToHost.Edit, ask: button, by: BO })]);

    expect(text('src/components/Card.module.css')).toContain('color: blue');
    expect(text('src/components/Button.module.css')).toContain('color: blue');
  });

  it('lists each guest edit with the name of its author, oldest last', async () => {
    const { send, history } = setup();

    await Promise.all([send({ kind: ToHost.Edit, ask: card, by: ADA }), send({ kind: ToHost.Edit, ask: button, by: BO })]);

    expect(history().changes.map((c) => [c.at, c.by])).toEqual([
      ['src/components/Button.tsx:4:10', 'Bo'],
      ['src/components/Card.tsx:4:10', 'Ada']
    ]);
  });

  it('leaves the host own edits without an author', async () => {
    const { send, history } = setup();

    await send({ kind: ToHost.Edit, ask: card });

    expect(history().changes[0].by).toBeUndefined();
  });

  it('holds a guest edit of unknown impact for the host and names the guest', async () => {
    const { send, sent, text } = setup();
    const before = text('src/components/Hero.css');

    await send({ kind: ToHost.Edit, ask: hero, by: ADA });

    expect(text('src/components/Hero.css')).toBe(before);
    expect(sent.find((m) => m.kind === ToView.Preview)).toMatchObject({ by: ADA });
  });

  it('attributes the approved edit to the guest, though the host applies it', async () => {
    const { send, text, history } = setup();
    await send({ kind: ToHost.Edit, ask: hero, by: ADA });

    await send({ kind: ToHost.Edit, ask: hero, gate: Gate.Apply });

    expect(text('src/components/Hero.css')).toContain('color: blue');
    expect(history().changes[0].by).toBe('Ada');
  });

  it('never lets a guest approve their own edit', async () => {
    const { send, text } = setup();
    const before = text('src/components/Hero.css');

    await send({ kind: ToHost.Edit, ask: hero, gate: Gate.Apply, by: ADA });

    expect(text('src/components/Hero.css')).toBe(before);
  });

  it('lets the host undo a guest edit from the list', async () => {
    const { send, text, history } = setup();
    const before = text('src/components/Card.module.css');
    await send({ kind: ToHost.Edit, ask: card, by: ADA });

    await send({ kind: ToHost.Revert, id: history().changes[0].id });

    expect(text('src/components/Card.module.css')).toBe(before);
    expect(history().changes).toEqual([]);
  });

  it('shows the host selection and pointer to the guests while live', async () => {
    const { send, sent } = setup(true);
    await send({ kind: ToHost.ShareStart, name: 'x', canEdit: true });

    await send({ kind: ToHost.Selected, at: { file: 'a.tsx', line: 1, col: 2 } });
    await send({ kind: ToHost.Cursor, at: { x: 3, y: 4 } });

    expect(sent.filter((m) => m.kind === ToView.Peers).at(-1)).toMatchObject({ peers: [{ userId: 'host', selection: 'a.tsx:1:2', cursor: { x: 3, y: 4 } }] });
  });
});
