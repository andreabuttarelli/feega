import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { Gate, ImpactKind, ToHost, ToView, type EditAsk, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const FILES: Record<string, string> = {
  'package.json': '{}',
  'src/app.css': '.card {\n  padding: 8px;\n}\n.solo {\n  color: red;\n}\n',
  'src/a.html': '<p class="card">a</p>\n<p class="card solo">b</p>\n',
  'src/b.html': '<p class="card">c</p>\n'
};

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'feega-classes-session-'));
  Object.entries(FILES).forEach(([name, text]) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  });
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
    watchFiles: () => ({ dispose: () => undefined })
  } as unknown as Platform;
  const session = inspectSession(platform, root);
  return { session, sent, deliver: (m: HostMessage) => deliver(m), css: () => readFileSync(join(root, 'src/app.css'), 'utf8') };
}

const edit = (name: string): EditAsk => ({ at: 'src/a.html:1:1', prop: LiveProp.Padding, css: { padding: '24px' }, cls: { name, file: 'src/app.css' } });

describe('classes in the session', () => {
  it('answers a Classes message with the classes of the element and their counts', async () => {
    const { sent, deliver } = setup();

    await deliver({ kind: ToHost.Classes, at: 'src/a.html:2:1' });

    const view = sent.find((m) => m.kind === ToView.Classes);
    expect(view).toMatchObject({ view: { at: 'src/a.html:2:1', element: [{ name: 'card', elements: 3, files: 2 }, { name: 'solo', elements: 1, files: 1 }] } });
  });

  it('answers an Impact of a class with its elements and files', async () => {
    const { sent, deliver } = setup();

    await deliver({ kind: ToHost.Impact, id: 1, ask: edit('card') });

    expect(sent.find((m) => m.kind === ToView.Impact)).toMatchObject({ impact: { kind: ImpactKind.Class, name: 'card', elements: 3 } });
  });

  it('holds an edit of a class used in many elements and shows the diff', async () => {
    const { session, sent, css } = setup();
    const before = css();

    await session.edit(edit('card'));

    expect(css()).toBe(before);
    expect(sent.find((m) => m.kind === ToView.Preview)).toMatchObject({ reason: '.card is used in 3 elements, 2 files', files: [{ path: 'src/app.css', removed: ['  padding: 8px;'], added: ['  padding: 24px;'] }] });
  });

  it('Apply writes the class rule and the history records it', async () => {
    const { session, sent, css } = setup();
    await session.edit(edit('card'));

    await session.edit(edit('card'), Gate.Apply);

    expect(css()).toContain('padding: 24px;');
    expect(sent.filter((m) => m.kind === ToView.History).pop()).toMatchObject({ changes: [{ scope: 'class .card', files: ['src/app.css'] }] });
  });

  it('writes at once a class used in a single element', async () => {
    const { session, sent, css } = setup();

    await session.edit({ ...edit('solo'), css: { color: 'blue' } });

    expect(css()).toContain('color: blue;');
    expect(sent.some((m) => m.kind === ToView.Preview)).toBe(false);
  });

  it('the class view sees the rule an edit just wrote', async () => {
    const { session, sent, deliver } = setup();
    await session.edit({ ...edit('solo'), css: { color: 'blue' } });

    await deliver({ kind: ToHost.Classes, at: 'src/a.html:2:1' });

    const view = sent.filter((m) => m.kind === ToView.Classes).pop();
    expect(view).toMatchObject({ view: { element: [{ name: 'card' }, { name: 'solo', home: { declarations: { color: 'blue' } } }] } });
  });
});
