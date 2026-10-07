import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { writeComponent } from '$lib/motion/custom/ops';
import { UI_KINDS, UI_KIT, UI_SAFE, UiKind, uiScale } from '$lib/motion/ui-kit/kit';
import { FORMATS } from '$lib/motion/doc';
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

  it.each(UI_KINDS.flatMap((k) => Object.values(MotionFormat).map((f) => [k, f] as const)))('%s fits the safe area of a %s frame by default', (kind, format) => {
    const piece = UI_KIT[kind];
    const frame = FORMATS[format];
    const scale = uiScale(piece, frame, 1);

    expect(piece.size.width * scale).toBeLessThanOrEqual(frame.width * UI_SAFE + 0.5);
    expect(piece.size.height * scale).toBeLessThanOrEqual(frame.height * UI_SAFE + 0.5);
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

  it('the kit carries generic primitives for any product, not only a link shortener', () => {
    const generic = [UiKind.Sidebar, UiKind.Hero, UiKind.PromptBox, UiKind.EditorCanvas, UiKind.CardGrid, UiKind.Pricing, UiKind.Chat, UiKind.Modal, UiKind.Toggle, UiKind.Upload, UiKind.GeneratedResult, UiKind.Cursor];

    expect(generic.every((k) => UI_KINDS.includes(k))).toBe(true);
  });

  it('add_ui and the prompt offer the generic primitives to the agent', () => {
    const { run } = setup();
    const text = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    expect(text).toContain('prompt box');
    expect(text).toContain('pricing');
    return expect(run('add_ui', { kind: UiKind.Chat, start: 0, duration: 3, props: { accent: '#ff5500' } })).resolves.toMatchObject({ ok: true });
  });

  it('mark_story marks each act of the story once, moving it when marked again', async () => {
    const { session, run } = setup();
    await run('mark_story', { beat: 'problem', start: 0 });
    await run('mark_story', { beat: 'solution', start: 3 });
    await run('mark_story', { beat: 'problem', start: 0.5 });

    expect(session.doc.markers).toEqual([{ frame: 15, label: 'story: problem' }, { frame: 90, label: 'story: solution' }]);
  });

  it('the trailer recipe tells the four acts with brand-specific pain, and keeps UI inside the frame', () => {
    const text = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    expect(text).toContain('Problem');
    expect(text).toContain('mark_story');
    expect(text).toContain('in the words of the site');
    expect(text).toContain('inside the safe area');
  });
});
