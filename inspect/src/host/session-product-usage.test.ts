import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ToHost, WebviewUsage, type HostMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { Device, Editor, type UsageEvent } from './usage';

const AT = 'src/Page.svelte:1:1';

function setup() {
  const sent: UsageEvent[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const dir = mkdtempSync(join(tmpdir(), 'feega-product-usage-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }));
  writeFileSync(join(dir, 'src/Page.svelte'), '<h1 class="text-2xl">Hello</h1>\n');
  const platform = {
    version: '1',
    launcher: '',
    send: () => undefined,
    receive: (fn: (m: HostMessage) => unknown) => void (handle = fn),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    usage: {
      identity: () => ({ installId: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', version: '1', editor: Editor.Cursor, os: 'darwin', arch: 'arm64', device: Device.Desktop }),
      enabled: () => true,
      send: async (events: UsageEvent[]) => void sent.push(...events),
      every: () => () => undefined
    }
  } as unknown as Platform;
  const session = inspectSession(platform, dir);
  const send = async (m: HostMessage) => {
    await handle(m);
    await new Promise((r) => setTimeout(r, 20));
  };

  return { session, sent, send };
}

describe('product events in the session', () => {
  it('an edit reports its target, category, file type and lines but no path, value or class', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Edit, ask: { at: AT, prop: LiveProp.Color, value: '#ff0000' } });
    await t.session.stop();

    const edit = t.sent.find((e) => e.event === 'edit');
    expect(edit).toMatchObject({ target: 'tailwind_class', prop_category: 'color', file_ext: 'svelte', breakpoint: 'base', state: 'default', source: 'manual', lines_added: 1, lines_removed: 1, files_count: 1 });
    const wire = JSON.stringify(t.sent);
    expect(wire).not.toContain('Page.svelte');
    expect(wire).not.toContain('ff0000');
    expect(wire).not.toContain('text-2xl');
    expect(t.sent.at(-1)).toMatchObject({ event: 'session_end', diff_count: 1, lines_added: 1, lines_removed: 1, files_count: 1 });
  });

  it('an undo reports a revert and is not a new diff', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Edit, ask: { at: AT, prop: LiveProp.Color, value: '#ff0000' } });
    await t.send({ kind: ToHost.Undo });
    await t.session.stop();

    expect(t.sent.map((e) => e.event)).toContain('edit_reverted');
    expect(t.sent.filter((e) => e.event === 'edit').map((e) => e.source)).toEqual(['manual', 'revert']);
    expect(t.sent.at(-1)).toMatchObject({ diff_count: 1 });
  });

  it('a selection reports an event and nothing about the element', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Selected, at: { file: 'src/Page.svelte', line: 1, col: 1 } });
    await t.session.stop();

    expect(t.sent.map((e) => e.event)).toContain('element_selected');
    expect(JSON.stringify(t.sent)).not.toContain('Page.svelte');
  });

  it('the webview reports copy for agent and its own errors by class', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Usage, event: WebviewUsage.CopyForAgent });
    await t.send({ kind: ToHost.Usage, event: WebviewUsage.ErrorWebview, dims: { error_class: 'TypeError', area: 'webview' } });
    await t.session.stop();

    expect(t.sent.find((e) => e.event === 'copy_for_agent')).toBeDefined();
    expect(t.sent.find((e) => e.event === 'error_webview')).toMatchObject({ error_class: 'TypeError', area: 'webview' });
  });

  it('focus mode reports its mode, prop changes report a control kind and a count, the grid reports itself', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Usage, event: WebviewUsage.FocusOpened, dims: { variant: 'focus', mode: 'mount' } });
    await t.send({ kind: ToHost.Usage, event: WebviewUsage.FocusPropsChanged, dims: { control: 'select', prop_count: 2 } });
    await t.send({ kind: ToHost.Usage, event: WebviewUsage.FocusVariantsShown });
    await t.session.stop();

    expect(t.sent.find((e) => e.event === 'focus_opened')).toMatchObject({ variant: 'focus', mode: 'mount' });
    expect(t.sent.find((e) => e.event === 'focus_props_changed')).toMatchObject({ control: 'select', prop_count: 2 });
    expect(t.sent.map((e) => e.event)).toContain('focus_variants_shown');
  });

  it('reports nothing of an AI chat the user never started', async () => {
    const t = setup();
    await t.send({ kind: ToHost.AiCancel });
    await t.session.stop();

    expect(t.sent.map((e) => e.event)).not.toContain('ai_cancel');
  });
});
