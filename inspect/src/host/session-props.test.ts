import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Gate, ToHost, ToView, type ApplyAsk, type ReadAsk, type HostMessage, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const HOME = "import Card from './Card';\n\nexport default () => (\n  <main>\n    <Card title={post.title} />\n  </main>\n);\n";

function setup(settings: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'feega-props-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'src/Home.tsx'), HOME);
  writeFileSync(join(root, 'src/Card.tsx'), 'export default function Card() { return <div />; }\n');
  const sent: ViewMessage[] = [];
  let deliver: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => void sent.push(m),
    receive: (cb: (m: HostMessage) => unknown) => (deliver = cb),
    settings: () => settings,
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    watchFiles: () => ({ dispose: () => undefined })
  } as unknown as Platform;
  inspectSession(platform, root);
  writeFileSync(join(root, 'src/Page.svelte'), "<script>\n  import Card from './Card.svelte';\n</script>\n\n<main>\n  <Card title=\"Hi\" size={post.size} />\n</main>\n");
  return { sent, deliver: (m: HostMessage) => deliver(m), text: () => readFileSync(join(root, 'src/Home.tsx'), 'utf8') };
}

const read: ReadAsk = { component: 'src/Card.svelte', usage: 'src/Page.svelte:5:1', which: { index: 0, count: 1 } };

const ask: ApplyAsk = { component: 'src/Card.tsx', usage: 'src/Home.tsx:4:3', set: { title: 'New' }, remove: [] };

describe('apply props in the session', () => {
  it('holds an edit that would replace an expression and shows the diff', async () => {
    const { sent, deliver, text } = setup();

    await deliver({ kind: ToHost.ApplyProps, ask });

    expect(text()).toBe(HOME);
    expect(sent.find((m) => m.kind === ToView.PropsPreview)).toMatchObject({ reason: expect.stringContaining('title'), files: [{ path: 'src/Home.tsx' }] });
  });

  it('writes what the diff showed once approved', async () => {
    const { sent, deliver, text } = setup();

    await deliver({ kind: ToHost.ApplyProps, ask, gate: Gate.Apply });

    expect(text()).toContain('title="New"');
    expect(sent.some((m) => m.kind === ToView.Edited && m.ok)).toBe(true);
  });

  it('writes without asking when the usage holds a literal', async () => {
    const { sent, deliver, text } = setup();

    await deliver({ kind: ToHost.ApplyProps, ask: { ...ask, set: { size: 3 } } });

    expect(text()).toContain('size={3}');
    expect(sent.some((m) => m.kind === ToView.PropsPreview)).toBe(false);
  });

  it('does not ask when previews are off', async () => {
    const { sent, deliver, text } = setup({ [SettingKey.PreviewUnknown]: false });

    await deliver({ kind: ToHost.ApplyProps, ask });

    expect(text()).toContain('title="New"');
    expect(sent.some((m) => m.kind === ToView.PropsPreview)).toBe(false);
  });
});

describe('props at the usage in the session', () => {
  it('answers with the literals, the dynamic names and the component', async () => {
    const { sent, deliver } = setup();

    await deliver({ kind: ToHost.ReadProps, ask: read });

    expect(sent.find((m) => m.kind === ToView.UsageProps)).toEqual({ kind: ToView.UsageProps, component: 'src/Card.svelte', values: { title: 'Hi' }, dynamic: ['size'], spread: false });
  });

  it('answers with nothing when the usage cannot be found', async () => {
    const { sent, deliver } = setup();

    await deliver({ kind: ToHost.ReadProps, ask: { ...read, usage: 'src/Missing.svelte:1:1' } });

    expect(sent.find((m) => m.kind === ToView.UsageProps)).toEqual({ kind: ToView.UsageProps, component: 'src/Card.svelte', values: {}, dynamic: [], spread: false });
  });
});
