import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';
import { pageOf } from './site-copy';

const SITE = 'https://supasito.com/';
const HOME = '<h1>Every site you run. Up to date. In one place.</h1><p>Say what should change. See it before it goes live.</p><h2>The deal is simple.</h2><p>Free for personal use.</p>';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const site = vi.fn(async () => ({ ok: true as const, site: { url: SITE, logos: [], pages: [pageOf(SITE, HOME)] } }));
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), site });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const source = (quote: string) => ({ url: SITE, quote });

const script = (proof: string) => ({
  research: {
    audience: 'People who run several websites',
    problem: 'Changes scatter across folders and chats',
    struggle: 'Launch on Thursday, a client sends a new price for three sites',
    flow: ['Pick the site', 'Say what should change', 'See the preview', 'Publish'],
    benefits: [{ claim: 'You see every change first', source: source(proof) }],
    numbers: [],
    tone: 'calm and plain',
    promise: { text: 'Every site you run. Up to date. In one place.', source: source('Every site you run. Up to date. In one place.') }
  },
  acts: [
    { act: 'problem', start: 0, end: 3, scene: 'Scattered folders', on_screen: ['The price changed.'], ui: 'Finder: marta-bakery, cardstack-launch, supasito.com, each "edited 9 days ago" with 3 open chats' },
    { act: 'solution', start: 3, end: 7, scene: 'One prompt', on_screen: ['Say what should change.'], ui: 'Sidebar Supasito, Cardstack, Marta’s Bakery; prompt "Set the price to €12"; preview; Publish' },
    { act: 'proof', start: 7, end: 11, scene: 'Preview', on_screen: ['See it before it goes live.'], sources: [source(proof)] },
    { act: 'claim', start: 11, end: 14, scene: 'Logo', on_screen: ['Every site you run. Up to date. In one place.'] }
  ]
});

describe('write_script', () => {
  it('asks to read the site first', async () => {
    const { run } = setup();

    expect(await run('write_script', script('See it before it goes live'))).toMatchObject({ ok: false });
  });

  it('refuses a claim the site never makes', async () => {
    const { run } = setup();
    await run('analyze_site', { url: 'supasito.com' });

    const out = await run('write_script', script('Ship 10x faster'));

    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('Ship 10x faster');
  });

  it('saves a sourced script on the video and returns the brief to show', async () => {
    const { run, session } = setup();
    await run('analyze_site', { url: 'supasito.com' });

    const out = await run('write_script', script('See it before it goes live'));

    expect(out).toMatchObject({ ok: true });
    expect(String(out.brief)).toContain('See the preview');
    expect(session.doc.script?.acts).toHaveLength(4);
  });
});
