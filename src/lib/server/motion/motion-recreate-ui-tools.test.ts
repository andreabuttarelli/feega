import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { writeComponent } from '$lib/motion/custom/ops';
import { AssetKind } from '$lib/motion/components';
import { RECREATE_STATES, UiBlock, recreatedUi, type UiStructure } from '$lib/motion/ui-kit/kit';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const SUPASITO: UiStructure = {
  layout: 'landing',
  colors: { ink: '#1c1917', muted: '#78716c', paper: '#fafaf9', line: '#e7e5e4', accent: '#f2552f' },
  font: 'Inter',
  radius: 12,
  blocks: [
    { kind: UiBlock.Nav, text: 'supasito', items: ['Pricing', 'Docs', 'Sign in'] },
    { kind: UiBlock.Heading, text: 'Your website, edited by talking' },
    { kind: UiBlock.Input, text: 'Make the hero headline bolder' },
    { kind: UiBlock.Button, text: 'Publish' },
    { kind: UiBlock.Stat, text: '1,240 sites updated' },
    { kind: UiBlock.Card, text: 'Live preview', items: ['Hero', 'Pricing', 'FAQ'] }
  ]
};

const CAPTURE = { id: 'shot1', kind: AssetKind.Image, label: 'supasito.com desktop', previewUrl: '', url: 'https://x/shot.png', width: 2880, height: 1800 };

function setup(readUi?: MotionToolDeps['readUi']) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [CAPTURE], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(async () => null), readUi });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('recreating a UI from a site capture', () => {
  it('turns a structure into a vector component the editor accepts, with the real texts and brand params', () => {
    const piece = recreatedUi('UiSupasito', SUPASITO);
    const written = writeComponent(newMotionDoc(MotionFormat.Landscape), piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });

    expect(written.ok ? Object.keys(written.doc.components.UiSupasito.propsSchema.properties) : written.error).toEqual(expect.arrayContaining(['font', 'ink', 'accent', 'radius', 'zoom', 'speed']));
    expect(piece.js).toContain('Your website, edited by talking');
    expect(piece.js).toContain('#f2552f');
    expect(piece.js).not.toMatch(/<img|background-image/);
  });

  it('is deterministic: the same structure writes the same source', () => {
    expect(recreatedUi('UiA', SUPASITO)).toEqual(recreatedUi('UiA', SUPASITO));
  });

  it('recreate_ui reads the capture through the vision port and places the recreated UI on the timeline', async () => {
    const readUi = vi.fn(async () => ({ ok: true as const, structure: SUPASITO }));
    const { session, run } = setup(readUi);
    const made = await run('recreate_ui', { asset_id: 'shot1', region: { x: 0, y: 0, width: 1, height: 0.5 }, name: 'UiSupasito', start: 1, duration: 3 });
    const clip = findClip(session.doc, String(made.clip_id))!.clip;

    expect(readUi).toHaveBeenCalledWith(CAPTURE, { x: 0, y: 0, width: 1, height: 0.5 });
    expect(made).toMatchObject({ ok: true, name: 'UiSupasito', states: RECREATE_STATES });
    expect(made.params).toEqual(expect.arrayContaining(['accent', 'speed']));
    expect(clip.props).toMatchObject({ name: 'UiSupasito', accent: '#f2552f' });
  });

  it('only writes the component when no start is given', async () => {
    const { session, run } = setup(vi.fn(async () => ({ ok: true as const, structure: SUPASITO })));
    const made = await run('recreate_ui', { asset_id: 'shot1', name: 'UiSupasito' });

    expect(made.clip_id).toBeUndefined();
    expect(session.doc.components.UiSupasito).toBeDefined();
  });

  it('refuses an asset that is not a picture in the project', async () => {
    const readUi = vi.fn();
    const { run } = setup(readUi);

    expect((await run('recreate_ui', { asset_id: 'nope', name: 'UiX' })).ok).toBe(false);
    expect(readUi).not.toHaveBeenCalled();
  });

  it('says so when no vision model can read pictures', async () => {
    const { run } = setup();

    expect(await run('recreate_ui', { asset_id: 'shot1', name: 'UiX' })).toMatchObject({ ok: false });
  });

  it('the launch film director plans the UI each act recreates, screenshots only as raw material', () => {
    const text = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    expect(text).toContain('recreate_ui');
    expect(text).toContain('raw material');
  });
});
