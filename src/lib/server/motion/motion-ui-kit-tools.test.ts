import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { writeComponent } from '$lib/motion/custom/ops';
import { UI_KINDS, UI_KIT, UiKind } from '$lib/motion/ui-kit/kit';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const check = vi.fn(async () => null);
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run, check };
}

describe('the UI recreation kit', () => {
  it.each(UI_KINDS.map((k) => [k]))('%s is a component the editor accepts: it lints and declares its params', (kind) => {
    const piece = UI_KIT[kind];
    const written = writeComponent(newMotionDoc(MotionFormat.Landscape), piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });

    expect(written.ok ? Object.keys(written.doc.components[piece.name].propsSchema.properties) : written.error).toEqual(expect.arrayContaining(['font', 'ink', 'accent', 'radius', 'zoom']));
  });

  it('add_ui puts a live piece of product UI on the timeline with its content and brand style, without spending the code budget', async () => {
    const { session, run } = setup();
    const added = await run('add_ui', { kind: UiKind.LinkShortener, start: 1, duration: 3, props: { url: 'https://dub.co/blog', short: 'dub.sh/blog', accent: '#3b82f6' } });
    const clip = findClip(session.doc, String(added.clip_id))!.clip;

    expect(added.ok).toBe(true);
    expect(clip.component).toBe('Custom');
    expect(clip.props).toMatchObject({ name: 'UiLinkShortener', url: 'https://dub.co/blog', short: 'dub.sh/blog' });
    expect(session.doc.components.UiLinkShortener).toBeDefined();
    expect(session.codeWrites).toBe(0);
  });

  it('a second piece of the same kind reuses the component', async () => {
    const { session, run } = setup();
    await run('add_ui', { kind: UiKind.StatCards, start: 0, duration: 2 });
    await run('add_ui', { kind: UiKind.StatCards, start: 2, duration: 2, props: { chart: 'bar' } });

    expect(session.doc.components.UiStatCards.version).toBe(1);
  });

  it('refuses a prop the piece does not have', async () => {
    const { run } = setup();

    expect((await run('add_ui', { kind: UiKind.Qr, start: 0, duration: 2, props: { colour: 'red' } })).ok).toBe(false);
  });

  it('the launch film prompt asks to recreate SaaS UI from the kit, not to show screenshots', () => {
    const text = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    expect(text).toContain('add_ui');
    expect(text).toContain('never as screenshots');
  });
});
