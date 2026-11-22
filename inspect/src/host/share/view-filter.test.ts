import { describe, expect, it } from 'vitest';
import { ServerState, ToView } from '../../messages';
import { viewForVisitor } from './view-filter';

const ORIGIN = 'https://abcdefghij.sessions.test';
const asText = (value: unknown) => JSON.stringify(value);

describe('viewForVisitor', () => {
  it('points the app at the visitor origin and reports the real address', () => {
    const out = viewForVisitor(asText({ kind: ToView.App, url: 'http://127.0.0.1:5173/', route: '/a' }), ORIGIN);

    expect(JSON.parse(out.text!)).toEqual({ kind: ToView.App, url: `${ORIGIN}/`, route: '/a' });
    expect(out.appUrl).toBe('http://127.0.0.1:5173/');
  });

  it('never tells a visitor who the host is', () => {
    expect(viewForVisitor(asText({ kind: ToView.Account, state: 'signed-in', email: 'me@x.com' }), ORIGIN).text).toBeNull();
  });

  it('does not show a visitor the share controls', () => {
    expect(viewForVisitor(asText({ kind: ToView.Share, state: 'live', url: 'https://x' }), ORIGIN).text).toBeNull();
  });

  it('keeps the host machine out of the server status', () => {
    const info = { url: 'http://127.0.0.1:5173/', framework: 'svelte', command: 'npm run dev', pid: 42, port: 5173, attached: false, startedAt: 1, lastError: 'at /Users/me/x.ts', keptMinutes: 0 };

    const out = JSON.parse(viewForVisitor(asText({ kind: ToView.Server, state: ServerState.Running, info }), ORIGIN).text!);

    expect(out.state).toBe(ServerState.Running);
    expect(out.info).toEqual({ url: `${ORIGIN}/`, framework: 'svelte', command: '', pid: null, port: 0, attached: false, startedAt: 1, lastError: '', keptMinutes: 0 });
  });

  it('passes everything else through untouched', () => {
    const text = asText({ kind: ToView.Status, text: 'hi' });

    expect(viewForVisitor(text, ORIGIN)).toEqual({ text });
    expect(viewForVisitor('not json', ORIGIN)).toEqual({ text: 'not json' });
  });
});
