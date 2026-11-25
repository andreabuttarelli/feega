import { describe, expect, it } from 'vitest';
import { ServerState, ToView } from '../../messages';
import { viewForVisitor } from './view-filter';

const ORIGIN = 'https://abcdefghij.sessions.test';
const ADA = { userId: 'ada', name: 'Ada', role: 'editor' as const };
const asText = (value: unknown) => JSON.stringify(value);

describe('viewForVisitor', () => {
  it('points the app at the visitor origin and reports the real address', () => {
    const out = viewForVisitor(asText({ kind: ToView.App, url: 'http://127.0.0.1:5173/', route: '/a' }), ORIGIN, ADA);

    expect(JSON.parse(out.text!)).toEqual({ kind: ToView.App, url: `${ORIGIN}/`, route: '/a' });
    expect(out.appUrl).toBe('http://127.0.0.1:5173/');
  });

  it('never tells a visitor who the host is', () => {
    expect(viewForVisitor(asText({ kind: ToView.Account, state: 'signed-in', email: 'me@x.com' }), ORIGIN, ADA).text).toBeNull();
  });

  it('does not show a visitor the share controls', () => {
    expect(viewForVisitor(asText({ kind: ToView.Share, state: 'live', url: 'https://x' }), ORIGIN, ADA).text).toBeNull();
  });

  it('keeps the host machine out of the server status', () => {
    const info = { url: 'http://127.0.0.1:5173/', framework: 'svelte', command: 'npm run dev', pid: 42, port: 5173, attached: false, startedAt: 1, lastError: 'at /Users/me/x.ts', keptMinutes: 0 };

    const out = JSON.parse(viewForVisitor(asText({ kind: ToView.Server, state: ServerState.Running, info }), ORIGIN, ADA).text!);

    expect(out.state).toBe(ServerState.Running);
    expect(out.info).toEqual({ url: `${ORIGIN}/`, framework: 'svelte', command: '', pid: null, port: 0, attached: false, startedAt: 1, lastError: '', keptMinutes: 0 });
  });

  it('tells the guest whose edit waits that the host has to approve it, and nobody else', () => {
    const held = asText({ kind: ToView.Preview, ask: {}, reason: 'x', files: [{ path: 'src/a.css' }], by: { userId: 'ada', name: 'Ada' } });

    expect(JSON.parse(viewForVisitor(held, ORIGIN, ADA).text!)).toEqual({ kind: ToView.Status, text: 'Waiting for the host to approve this change' });
    expect(viewForVisitor(held, ORIGIN, { ...ADA, userId: 'bo' }).text).toBeNull();
  });

  it('keeps the visitor own pointer and selection out of the peers they see', () => {
    const peers = [{ ...ADA, cursor: { x: 1, y: 1 } }, { userId: 'bo', name: 'Bo', role: 'viewer', selection: 'a:1:1' }];

    const out = JSON.parse(viewForVisitor(asText({ kind: ToView.Peers, peers }), ORIGIN, ADA).text!);

    expect(out.peers).toEqual([peers[1]]);
  });

  it('passes everything else through untouched', () => {
    const text = asText({ kind: ToView.Status, text: 'hi' });

    expect(viewForVisitor(text, ORIGIN, ADA)).toEqual({ text });
    expect(viewForVisitor('not json', ORIGIN, ADA)).toEqual({ text: 'not json' });
  });
});
