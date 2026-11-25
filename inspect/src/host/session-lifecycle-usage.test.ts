import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AddPlace } from '@feega/live-edit/add-node';
import type { Catalog, CatalogItem } from '../../../packages/library/src/catalog';
import { OnboardingOutcome, OnboardingStep, ToHost, type HostMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import { Stored, type Platform } from './platform';
import { inspectSession } from './session';
import { HintSurface, nodeHintFs } from './skill-hint';
import { Device, Editor, type UsageEvent } from './usage';

const item = (id: string, tier: 'free' | 'pro'): CatalogItem => ({
  id,
  name: id,
  description: 'd',
  category: 'section',
  tags: [],
  frameworks: ['html', 'svelte', 'react', 'vue', 'astro'],
  dependencies: [],
  fonts: [],
  tier,
  component: tier === 'free' ? 'FreeItem' : 'ProItem',
  files: { svelte: tier === 'free' ? [{ name: 'FreeItem.svelte', text: '<section></section>\n' }] : [], react: [], vue: [], astro: [] },
  page: '<html></html>'
});

const CATALOG: Catalog = { tokens: ':root{}\n', items: [item('free-item', 'free'), item('pro-item', 'pro')] };
const AT = 'src/routes/+page.svelte:2:3';
const LIFECYCLE_NOISE = ['opened', 'session_start', 'session_end'];

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'feega-lifecycle-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const SVELTEKIT = {
  'package.json': JSON.stringify({ dependencies: { '@sveltejs/kit': '2', svelte: '5' }, devDependencies: { vite: '6' } }),
  'src/routes/+page.svelte': '<main>\n  <h1>Title</h1>\n</main>\n',
  'src/app.css': 'body { margin: 0; }\n',
  'vite.config.ts': "import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [sveltekit()] });\n"
};

function setup(files: Record<string, string> = SVELTEKIT, extra: Record<string, unknown> = {}) {
  const sent: UsageEvent[] = [];
  const stored = new Map<string, unknown>();
  let handle: (m: HostMessage) => unknown = () => undefined;
  const root = project(files);
  const platform = {
    version: '1',
    launcher: '',
    send: () => undefined,
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: (key: string) => stored.get(key),
    store: async (key: string, value: unknown) => void stored.set(key, value),
    log: () => undefined,
    notify: () => undefined,
    warn: async () => false,
    library: async () => CATALOG,
    proFiles: async () => [{ path: 'ProItem.svelte', content: '<section></section>\n' }],
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    usage: {
      identity: () => ({ installId: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', version: '1.0.0', editor: Editor.Npx, os: 'linux', arch: 'x64', device: Device.Cli }),
      enabled: () => true,
      send: async (events: UsageEvent[]) => void sent.push(...events),
      every: () => () => undefined
    },
    ...extra
  } as unknown as Platform;
  const session = inspectSession(platform, root);
  const send = async (m: HostMessage) => {
    await handle(m);
    await new Promise((r) => setTimeout(r, 20));
  };
  const events = async () => {
    await session.stop();
    return sent.map((e) => e.event).filter((e) => !LIFECYCLE_NOISE.includes(e));
  };
  return { sent, stored, send, events, root };
}

describe('onboarding in the usage stream', () => {
  it('reports started, each step and how it ended', async () => {
    const t = setup();
    await t.send({ kind: ToHost.Ready });
    await t.send({ kind: ToHost.OnboardingStep, step: OnboardingStep.Agent });
    await t.send({ kind: ToHost.OnboardingDone, outcome: OnboardingOutcome.Finished });

    expect(await t.events()).toEqual(['onboarding_started', 'onboarding_step', 'onboarding_step', 'onboarding_finished']);
    expect(t.sent.filter((e) => e.event === 'onboarding_step').map((e) => [e.step, e.outcome])).toEqual([['agent', 'viewed'], ['agent', 'completed']]);
  });

  it('reports a skip as skipped, not finished', async () => {
    const t = setup();
    await t.send({ kind: ToHost.OnboardingDone, outcome: OnboardingOutcome.Skipped });

    expect(await t.events()).toEqual(['onboarding_skipped']);
  });

  it('keeps the step ids the server accepts', () => {
    expect(Object.values(OnboardingStep)).toEqual(['welcome', 'agent', 'local_agents', 'agents', 'sign_in', 'support']);
  });
});

describe('setup in the usage stream', () => {
  it('reports the project setup applied', async () => {
    const t = setup();
    await t.send({ kind: ToHost.AddPlugin });

    expect(await t.events()).toEqual(['setup_applied']);
  });

  it('reports the project setup failed', async () => {
    const t = setup({ 'package.json': '{' });
    await t.send({ kind: ToHost.AddPlugin });

    expect(await t.events()).toEqual(['setup_failed']);
  });
});

describe('library in the usage stream', () => {
  it.each([
    ['free-item', 'free'],
    ['pro-item', 'pro']
  ])('reports %s as tier %s with the catalog id only', async (id, tier) => {
    const t = setup();
    await t.send({ kind: ToHost.LibraryInsert, id, at: AT, place: AddPlace.After });

    expect(await t.events()).toContain('library_insert');
    const sent = t.sent.find((e) => e.event === 'library_insert');
    expect(sent?.tier).toBe(tier);
    expect(sent?.library_item).toBe(id);
    expect(sent?.library_category).toBe('section');
  });
});

describe('skill hint in the usage stream', () => {
  const hinted = () => {
    const home = project({ 'home/.keep': '' });
    return setup({ ...SVELTEKIT, 'AGENTS.md': '' }, { skillHint: { fs: nodeHintFs, home: join(home, 'home'), surface: HintSurface.Panel } });
  };

  it('reports the hint shown', async () => {
    const t = hinted();
    await t.send({ kind: ToHost.Ready });

    expect(await t.events()).toContain('skill_hint_shown');
  });

  it('reports the skill installed once, after a hint was shown', async () => {
    const t = hinted();
    t.stored.set(Stored.SkillHintShown, true);
    writeFileSync(join(t.root, 'skills-lock.json'), '{"feega":{}}');
    await t.send({ kind: ToHost.Ready });
    await t.send({ kind: ToHost.Ready });

    expect((await t.events()).filter((e) => e === 'skill_installed')).toHaveLength(1);
  });

  it('does not report an install that was never hinted', async () => {
    const t = hinted();
    writeFileSync(join(t.root, 'skills-lock.json'), '{"feega":{}}');
    await t.send({ kind: ToHost.Ready });

    expect(await t.events()).not.toContain('skill_installed');
  });
});
