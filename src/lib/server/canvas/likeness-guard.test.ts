import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { classifyInfluencer, likenessRefusal, Provenance, upstreamProvenance } from './likeness-guard';

const ORG = 'org-1';
const CANVAS = 'canvas-1';
const TARGET = 'target';

const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({
  id,
  org_id: ORG,
  project_id: 'p',
  canvas_id: CANVAS,
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

const edge = (source: string) => ({
  id: `e-${source}`,
  org_id: ORG,
  canvas_id: CANVAS,
  source_node_id: source,
  target_node_id: TARGET,
  source_handle: null,
  target_handle: null,
  mode: 'fixed'
});

describe('what an influencer counts as, for an uncensored model', () => {
  it.each([
    [{ orgId: null, source: 'catalogue', age: 25, adultPersonaAt: '2026-09-01' }, Provenance.CatalogueFace],
    [{ orgId: ORG, source: 'upload', age: 30, adultPersonaAt: '2026-09-01' }, Provenance.UploadedFace],
    [{ orgId: ORG, source: 'generated', age: 17, adultPersonaAt: '2026-09-01' }, Provenance.MinorPersona],
    [{ orgId: ORG, source: 'generated', age: null, adultPersonaAt: '2026-09-01' }, Provenance.MinorPersona],
    [{ orgId: ORG, source: 'generated', age: 24, adultPersonaAt: null }, Provenance.UnmarkedPersona],
    [{ orgId: ORG, source: 'generated', age: 24, adultPersonaAt: '2026-09-01' }, Provenance.AdultPersona]
  ])('%o is %s', (influencer, expected) => {
    expect(classifyInfluencer(influencer)).toBe(expected);
  });
});

describe('refusing real likeness before any call', () => {
  it('allows generated media and marked adult AI personas only', () => {
    expect(likenessRefusal([{ kind: Provenance.GeneratedMedia, label: 'x' }, { kind: Provenance.AdultPersona, label: 'y' }])).toBeNull();
  });

  it.each([Provenance.CatalogueFace, Provenance.UploadedFace, Provenance.UnmarkedPersona, Provenance.MinorPersona, Provenance.UploadedMedia, Provenance.ReferencePhoto])(
    'refuses %s with a readable reason',
    (kind) => {
      expect(likenessRefusal([{ kind, label: 'ref' }])).toMatch(/Refused/);
    }
  );
});

describe('reading what feeds a node', () => {
  it('classifies a catalogue influencer, an uploaded image and a generated image wired in', async () => {
    const { db } = fakeDb(
      {
        nodes: [
          node(TARGET, 'image'),
          node('inf', 'influencer', { influencer_id: 'talent' }),
          node('up', 'image', { assetId: 'a-up' }),
          node('gen', 'image', { refId: 'a-gen' })
        ],
        nodes_connections: [edge('inf'), edge('up'), edge('gen')],
        influencers: [{ id: 'talent', org_id: null, source: 'catalogue', age: 26, adult_persona_at: null, name: 'Luna' }],
        assets: [
          { id: 'a-up', org_id: ORG, source: 'upload' },
          { id: 'a-gen', org_id: ORG, source: 'generated' }
        ]
      },
      { filter: true }
    );

    const out = await upstreamProvenance(db, { orgId: ORG, canvasId: CANVAS, nodeId: TARGET, data: {} });

    expect(out.map((p) => p.kind).sort()).toEqual([Provenance.CatalogueFace, Provenance.GeneratedMedia, Provenance.UploadedMedia].sort());
  });

  it('counts a Global catalogue photo attached to the node itself as a reference photo', async () => {
    const { db } = fakeDb({ nodes: [node(TARGET, 'image')], nodes_connections: [] }, { filter: true });
    const out = await upstreamProvenance(db, { orgId: ORG, canvasId: CANVAS, nodeId: TARGET, data: { references: [{ source: 'catalogue', id: 'r1' }] } });
    expect(out.map((p) => p.kind)).toEqual([Provenance.ReferencePhoto]);
  });
});
