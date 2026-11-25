import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { LiveProp } from '@feega/live-edit/live-fields';
import { newSid } from '../../packages/share-protocol/src/sid';
import { editorServer, type EditorServer } from '../../inspect/src/host/editor-server';
import { memoryAccountStore } from '../../inspect/src/host/account';
import { memoryOnboardingStore } from '../../inspect/src/host/onboarding';
import type { Platform } from '../../inspect/src/host/platform';
import { inspectSession } from '../../inspect/src/host/session';
import { cloudShare } from '../../inspect/src/host/share/share-port-factory';
import { Gate, SOCKET_PATH, ShareState, ToHost, ToView, type EditAsk, type HostMessage, type ViewMessage } from '../../inspect/src/messages';
import { BOOT_MS, HOUR_S, LOOPBACK, WAIT_MS, bootRelay, cookieOf, openVisitor, sleep, token, until, type Relay, type Visitor } from './rig';

const FIXTURE = join(__dirname, '../../inspect/src/host/impact-fixtures/react');
const CARD_CSS = 'src/components/Card.module.css';
const BUTTON_CSS = 'src/components/Button.module.css';
const HERO_CSS = 'src/components/Hero.css';

const colour = (at: string): EditAsk => ({ at, prop: LiveProp.Color, value: 'blue', css: { color: 'blue' } });
const card = colour('src/components/Card.tsx:4:10');
const button = colour('src/components/Button.tsx:4:10');
const hero = colour('src/components/Hero.tsx:4:10');

const send = (visitor: Visitor, message: HostMessage) => visitor.socket.send(JSON.stringify(message));
const heard = (visitor: Visitor): ViewMessage[] => visitor.inbox.map((text) => JSON.parse(text) as ViewMessage);
const lastHistory = (visitor: Visitor) => [...heard(visitor)].reverse().find((m) => m.kind === ToView.History) as Extract<ViewMessage, { kind: ToView.History }> | undefined;

describe('a host and two guests editing through the real relay and the real session', () => {
  let relay: Relay;
  let editor: EditorServer;
  let root: string;
  let panel: Visitor;
  let ada: Visitor;
  let bo: Visitor;
  const sid = newSid();
  const read = (file: string) => readFileSync(join(root, file), 'utf8');

  beforeAll(async () => {
    relay = await bootRelay();
    root = mkdtempSync(join(tmpdir(), 'feega-collab-e2e-'));
    cpSync(FIXTURE, root, { recursive: true });
    editor = await editorServer(root, 0);
    const api = {
      startSession: async () => ({ id: sid, url: `http://${sid}.localhost:${relay.port}`, hostToken: await token(sid, 'host', 'host-1', 'Host'), expiresAt: new Date(Date.now() + HOUR_S * 1000).toISOString() }),
      closeSession: async () => ({ snapshotUploadUrl: '' }),
      setMember: async () => undefined
    };
    const { share } = cloudShare({ api: api as never, relayUrl: `ws://${LOOPBACK}:${relay.port}/host`, send: fetch, editorUrl: async () => editor.url });
    const platform = {
      version: '1',
      launcher: '',
      send: editor.transport.send,
      receive: editor.transport.receive,
      settings: () => ({}),
      stored: () => undefined,
      store: async () => undefined,
      log: () => undefined,
      account: memoryAccountStore(),
      onboarding: memoryOnboardingStore(),
      watchFiles: () => ({ dispose: () => undefined }),
      share
    } as unknown as Platform;
    inspectSession(platform, root);

    const port = new URL(editor.url).port;
    const socket = new WebSocket(`ws://${LOOPBACK}:${port}${SOCKET_PATH}`, { headers: { origin: `http://${LOOPBACK}:${port}` } });
    panel = { socket, inbox: [] };
    socket.on('message', (data) => panel.inbox.push(String(data)));
    await new Promise<void>((resolve) => socket.on('open', () => resolve()));
    send(panel, { kind: ToHost.ShareStart, name: 'Landing', canEdit: true });
    await until(() => heard(panel).find((m) => m.kind === ToView.Share && m.state === ShareState.Live));

    ada = await openVisitor(relay, sid, SOCKET_PATH, await cookieOf(sid, 'editor', 'ada', 'Ada'));
    bo = await openVisitor(relay, sid, SOCKET_PATH, await cookieOf(sid, 'editor', 'bo', 'Bo'));
  }, BOOT_MS + WAIT_MS * 3);

  afterAll(async () => {
    [panel, ada, bo].forEach((visitor) => visitor?.socket.terminate());
    await editor?.close();
    relay?.stop();
  });

  it('lands concurrent edits on different elements in the source, each credited to its guest', async () => {
    send(ada, { kind: ToHost.Edit, ask: card });
    send(bo, { kind: ToHost.Edit, ask: button });

    await until(() => (read(CARD_CSS).includes('color: blue') && read(BUTTON_CSS).includes('color: blue') ? true : undefined));
    const history = await until(() => (lastHistory(panel)?.changes.length === 2 ? lastHistory(panel) : undefined));
    expect(history.changes.map((change) => [change.at, change.by]).sort()).toEqual([
      ['src/components/Button.tsx:4:10', 'Bo'],
      ['src/components/Card.tsx:4:10', 'Ada']
    ]);
  });

  it('makes the second guest on the same element wait on the holder, then land after release', async () => {
    const other = { ...card, value: 'green', css: { color: 'green' } };
    send(ada, { kind: ToHost.Edit, ask: other });
    await until(() => (read(CARD_CSS).includes('color: green') ? true : undefined));

    send(bo, { kind: ToHost.Edit, ask: { ...other, value: 'pink', css: { color: 'pink' } } });

    const refusal = await until(() => heard(bo).find((m) => m.kind === ToView.Edited && !m.ok && m.reason === 'Ada is editing this element'));
    expect(refusal).toBeTruthy();
    expect(read(CARD_CSS)).toContain('color: green');
    expect(read(CARD_CSS)).not.toContain('pink');

    ada.socket.terminate();
    await sleep(300);
    send(bo, { kind: ToHost.Edit, ask: { ...other, value: 'pink', css: { color: 'pink' } } });

    await until(() => (read(CARD_CSS).includes('color: pink') ? true : undefined));
  });

  it('holds a guest edit of unknown impact until the host approves it', async () => {
    const before = read(HERO_CSS);

    send(bo, { kind: ToHost.Edit, ask: hero });

    const prompt = await until(() => heard(panel).find((m) => m.kind === ToView.Preview));
    expect(prompt).toMatchObject({ by: { name: 'Bo' } });
    expect(heard(bo).find((m) => m.kind === ToView.Status)).toMatchObject({ text: 'Waiting for the host to approve this change' });
    expect(read(HERO_CSS)).toBe(before);

    send(panel, { kind: ToHost.Edit, ask: hero, gate: Gate.Apply });

    await until(() => (read(HERO_CSS).includes('color: blue') ? true : undefined));
    expect(lastHistory(panel)?.changes[0]).toMatchObject({ at: hero.at, by: 'Bo' });
  });

  it('shows the pointer and selection of each person to the others, never to themselves', async () => {
    const again = await openVisitor(relay, sid, SOCKET_PATH, await cookieOf(sid, 'editor', 'ada', 'Ada'));

    send(again, { kind: ToHost.Cursor, at: { x: 40, y: 50 } });
    send(again, { kind: ToHost.Selected, at: { file: 'src/components/Card.tsx', line: 4, col: 10 } });

    const seenByBo = await until(() => [...heard(bo)].reverse().find((m) => m.kind === ToView.Peers && m.peers.some((p) => p.userId === 'ada' && p.selection)));
    expect(seenByBo).toMatchObject({ peers: [{ userId: 'ada', name: 'Ada', cursor: { x: 40, y: 50 }, selection: 'src/components/Card.tsx:4:10' }] });
    const seenByHost = await until(() => [...heard(panel)].reverse().find((m) => m.kind === ToView.Peers && m.peers.some((p) => p.userId === 'ada' && p.selection)));
    expect(seenByHost).toBeTruthy();
    expect(heard(again).filter((m) => m.kind === ToView.Peers).every((m) => m.kind === ToView.Peers && m.peers.every((p) => p.userId !== 'ada'))).toBe(true);
    again.socket.terminate();
  });
});
