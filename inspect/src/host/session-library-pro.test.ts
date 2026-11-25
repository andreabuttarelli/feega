import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AddPlace } from '@feega/live-edit/add-node';
import type { Catalog, CatalogItem } from '../../../packages/library/src/catalog';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { CloudError, CloudFailure } from './cloud-api';
import { memoryAccountStore } from './account';
import { INCLUDED_IN_CLOUD } from './library';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { PRICING_URL, SEE_PRICING, SIGN_IN, SIGN_IN_FOR_PRO } from './pro-insert';
import { inspectSession } from './session';

const AT = 'src/routes/+page.svelte:2:3';
const COMPONENT = 'src/lib/components/feega/HoverReveal.svelte';

const PRO_ITEM: CatalogItem = {
  id: 'hover-reveal',
  name: 'Hover reveal',
  description: 'd',
  category: 'section',
  tags: [],
  frameworks: ['html', 'svelte', 'react', 'vue', 'astro'],
  dependencies: [],
  fonts: [{ family: 'Inter Tight', weights: [400] }],
  tier: 'pro',
  component: 'HoverReveal',
  files: { svelte: [], react: [], vue: [], astro: [] },
  page: '<html></html>'
};

const CATALOG: Catalog = { tokens: ':root{}\n', items: [PRO_ITEM] };

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'feega-pro-'));
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ dependencies: { '@sveltejs/kit': '2', svelte: '5' } }),
    'src/routes/+page.svelte': '<main>\n  <h1>Title</h1>\n</main>\n',
    'src/app.css': 'body { margin: 0; }\n'
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
}

type Ask = { id: string; framework: string };

function setup(proFiles?: Platform['proFiles'], warnAnswer = false) {
  const sent: ViewMessage[] = [];
  const opened: string[] = [];
  const warned: { text: string; action?: string }[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    library: async () => CATALOG,
    proFiles,
    openExternal: (url: string) => opened.push(url),
    notify: () => undefined,
    warn: async (text: string, action?: string) => {
      warned.push({ text, action });

      return warnAnswer;
    },
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  const root = project();
  inspectSession(platform, root);

  return { root, sent, opened, warned, insert: () => handle({ kind: ToHost.LibraryInsert, id: 'hover-reveal', at: AT, place: AddPlace.After }) };
}

const edited = (sent: ViewMessage[]) => sent.find((m) => m.kind === ToView.Edited) as Extract<ViewMessage, { kind: ToView.Edited }> | undefined;

describe('inserting a Pro library item', () => {
  it('writes the files fetched for the project framework like a free item', async () => {
    const asked: Ask[] = [];
    const { root, sent, insert } = setup(async (id, framework) => {
      asked.push({ id, framework });

      return [{ path: 'HoverReveal.svelte', content: '<section class="fl-hover-reveal"></section>\n' }];
    });

    await insert();

    expect(asked).toEqual([{ id: 'hover-reveal', framework: 'svelte' }]);
    expect(edited(sent)).toMatchObject({ ok: true });
    expect(readFileSync(join(root, COMPONENT), 'utf8')).toContain('fl-hover-reveal');
    expect(readFileSync(join(root, 'src/routes/+page.svelte'), 'utf8')).toContain('<HoverReveal />');
    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain('Inter+Tight');
  });

  it('asks to sign in on a 401 and starts nothing on a no', async () => {
    const { root, sent, warned, insert } = setup(async () => Promise.reject(new CloudError(CloudFailure.NotSignedIn, 'not signed in', 401)));

    await insert();

    expect(edited(sent)).toMatchObject({ ok: false, reason: SIGN_IN_FOR_PRO });
    expect(warned).toEqual([{ text: SIGN_IN_FOR_PRO, action: SIGN_IN }]);
    expect(existsSync(join(root, COMPONENT))).toBe(false);
  });

  it('keeps the Cloud lock on a 402 and offers the pricing page', async () => {
    const { root, sent, warned, opened, insert } = setup(async () => Promise.reject(new CloudError(CloudFailure.PlanRequired, 'plan', 402)), true);

    await insert();

    expect(edited(sent)).toMatchObject({ ok: false, reason: INCLUDED_IN_CLOUD });
    expect(warned).toEqual([{ text: INCLUDED_IN_CLOUD, action: SEE_PRICING }]);
    await vi.waitFor(() => expect(opened).toEqual([PRICING_URL]));
    expect(existsSync(join(root, COMPONENT))).toBe(false);
  });

  it('does not open the pricing page when the offer is declined', async () => {
    const { opened, insert } = setup(async () => Promise.reject(new CloudError(CloudFailure.PlanRequired, 'plan', 402)), false);

    await insert();

    expect(opened).toEqual([]);
  });

  it('stays locked when the editor has no way to reach the server', async () => {
    const { sent, insert } = setup(undefined);

    await insert();

    expect(edited(sent)).toMatchObject({ ok: false, reason: INCLUDED_IN_CLOUD });
  });
});
