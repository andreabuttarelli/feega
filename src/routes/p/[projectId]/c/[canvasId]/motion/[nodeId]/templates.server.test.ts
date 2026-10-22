import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { precompose } from '$lib/motion/precomp';
import { exposeField, FieldType } from '$lib/motion/template/fields';
import { templatesDb } from '$lib/server/motion/templates-testing';
import { TrackKind } from '$lib/motion/components';
import { insertTemplate } from '$lib/motion/template/library';
import { PROMPT_INPUT_TEMPLATE } from '$lib/motion/template/prompt-input/template';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
const lookupFound = () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null });
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => lookupFound(), openCanvasForUser: async () => ({ memberships: [], found: lookupFound() }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/motion/sfx', () => ({ laySfx: async (_db: unknown, _scope: unknown, sfx: string) => ({ ok: true, assetId: `sfx-${sfx}`, url: null, seconds: 0.1 }) }));
vi.mock('$lib/server/motion/editor', () => ({ findMotionNode: async () => ({ record: { id: 'n1' }, node: {} }), assetUrls: vi.fn(), headOrNew: vi.fn(), motionAssets: vi.fn(), motionTokens: vi.fn(), saveMotionDoc: vi.fn() }));

const { actions } = await import('$lib/server/frame-editor/editor-page');

function event(db: unknown, fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  return {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' },
    request: new Request('http://x', { method: 'POST', body: form })
  } as never;
}

function card() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 't1');
  const comp = added.ok ? precompose(added.doc, ['t1'], { comp: 'card', clip: 'p1' }, 'Card') : added;
  const exposed = comp.ok ? exposeField(comp.doc, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' }) : comp;
  if (!exposed.ok) {
    throw new Error(exposed.error);
  }
  return exposed.doc;
}

describe('saving a motion template from the editor', () => {
  it('stores the precomp with its fields in the org library', async () => {
    const { db, rows } = templatesDb();

    const out = await actions.saveTemplate(event(db, { doc: JSON.stringify(card()), compId: 'card', name: 'Card', posterFrame: '10' }));

    expect(out).toMatchObject({ entry: { id: 't1', template: { name: 'Card' } } });
    expect(rows[0]).toMatchObject({ org_id: 'org-a', name: 'Card', poster_frame: 10, actor_id: 'u1' });
  });

  it('a precomp with no field is refused and nothing is written', async () => {
    const { db, rows } = templatesDb();
    const doc = { ...card(), fields: [] };

    const out = await actions.saveTemplate(event(db, { doc: JSON.stringify(doc), compId: 'card', name: 'Card' }));

    expect(out).toMatchObject({ status: 400 });
    expect(rows).toEqual([]);
  });
});

describe('sounds for an inserted template', () => {
  it('lays the key taps and the send click of a prompt input on the SFX track', async () => {
    let n = 0;
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), PROMPT_INPUT_TEMPLATE, { from: 0, newId: () => `x${++n}` });
    if (!placed.ok) {
      throw new Error(placed.error);
    }

    const out = (await actions.templateSounds(event({}, { doc: JSON.stringify(placed.doc), clipId: placed.clipId }))) as { doc: ReturnType<typeof newMotionDoc> };
    const clips = out.doc.tracks.filter((t) => t.kind === TrackKind.Audio).flatMap((t) => t.clips);

    expect(clips.length).toBeGreaterThan(40);
    expect(out.doc.assets.map((a) => a.name)).toEqual(expect.arrayContaining(['sfx key', 'sfx click']));
  });
});
