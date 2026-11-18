import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESIGN_MAX_SIDE, DOC_VERSION, MotionFormat, newMotionDoc, parseMotionDoc } from '@feega/motion-core/motion/doc';
import { maxFrames } from '@feega/motion-core/motion/design';
import liquidGlass from '$lib/motion/fixtures/liquid-glass-title.json';
import supasito from '$lib/motion/fixtures/supasito-v1.json';
import ruixen from '$lib/motion/template/ruixen/ruixen-doc.json';
import demo from '../../../scripts/seed/demo-motion-doc.json';

type Raw = Record<string, unknown>;

const STRESS_DOCS = process.env.MOTION_DOCS_JSON;

const clip = (component: string, extra: Raw = {}): Raw => ({ id: 'c1', from: 0, durationInFrames: 30, component, props: {}, ...extra });

function withClips(...clips: Raw[]): Raw {
  const doc = newMotionDoc(MotionFormat.Square);
  return { ...doc, tracks: [{ ...doc.tracks[0], clips }, doc.tracks[1]] };
}

function olderShape(version: number | undefined, drop: string[]): Raw {
  const doc = structuredClone(demo) as Raw;
  for (const c of (doc.tracks as { clips: Raw[] }[]).flatMap((t) => t.clips)) {
    drop.forEach((key) => delete c[key]);
  }
  if (version === undefined) {
    delete doc.version;
  } else {
    doc.version = version;
  }
  delete doc.comps;
  return doc;
}

const VALID: [string, unknown][] = [
  ['demo seed', demo],
  ['liquid glass title', liquidGlass],
  ['supasito v1', supasito],
  ['new square', newMotionDoc(MotionFormat.Square)],
  ['v1, no version field', olderShape(undefined, [])],
  ['v2', olderShape(2, ['mask', 'matte', 'depth', 'space', 'parent', 'parentOpacity'])],
  ['v3', olderShape(3, ['depth', 'space', 'parent', 'parentOpacity'])],
  ['v4', olderShape(4, ['parent', 'parentOpacity'])],
  ['title with defaults', withClips(clip('Title'))],
  ['headline title takes the title look', withClips(clip('Title', { props: { size: 200 } }))],
  ['bad prop salvaged', withClips(clip('Title', { props: { size: 'huge' } }))],
  ['keyframes reordered', withClips(clip('Title', { keyframes: { rotateZ: [{ frame: 20, value: 2 }, { frame: 0, value: 0 }, { frame: 20, value: 3 }] } }))],
  ['shape with a path', withClips(clip('Shape', { props: { shape: 'path', d: 'M0 0 L1 1 Z' } }))],
  ['tall page', { ...newMotionDoc(MotionFormat.Landscape), width: 1440, height: 5000 }],
  ...(ruixen as { slug: string; doc: unknown }[]).map((t): [string, unknown] => [`ruixen ${t.slug}`, t.doc])
];

const INVALID: [string, unknown][] = [
  ['not an object', 'doc'],
  ['null', null],
  ['too long', { ...newMotionDoc(MotionFormat.Square), durationInFrames: maxFrames(30) + 1 }],
  ['unknown component', withClips(clip('Nope'))],
  ['side above the limit', { ...newMotionDoc(MotionFormat.Landscape), width: DESIGN_MAX_SIDE + 2, height: 2160 }],
  ['newer version', { ...newMotionDoc(MotionFormat.Square), version: DOC_VERSION + 1 }],
  ['frame rate not offered', { ...newMotionDoc(MotionFormat.Square), fps: 7 }],
  ['negative start', withClips(clip('Title', { from: -1 }))],
  ['keyframes on a prop it cannot animate', withClips(clip('Title', { keyframes: { orbit: [{ frame: 0, value: 0 }] } }))],
  ['empty keyframe track', withClips(clip('Title', { keyframes: { opacity: [] } }))],
  ['unknown blend mode', withClips(clip('Title', { blend: 'glow' }))],
  ['missing composition', withClips(clip('Precomp', { props: { comp: 'ghost' } }))],
  ['missing custom component', withClips(clip('Custom', { props: { name: 'NodeGraph' } }))],
  ['parent that does not exist', withClips(clip('Title', { parent: 'ghost' }))],
  ['parent cycle', withClips(clip('Title', { id: 'a', parent: 'b' }), clip('Title', { id: 'b', parent: 'a' }))],
  ['still past the end', { ...newMotionDoc(MotionFormat.Square), still: { frame: 10_000 } }],
  ['unknown font', withClips(clip('Title', { props: { font: 'No Such Font Family' } }))],
  ['tracks not a list', { ...newMotionDoc(MotionFormat.Square), tracks: {} }]
];

function stressDocs(): [string, unknown][] {
  if (!STRESS_DOCS || !existsSync(STRESS_DOCS)) {
    return [];
  }
  return (JSON.parse(readFileSync(STRESS_DOCS, 'utf8')) as unknown[]).map((doc, i) => [`stress ${i}`, doc]);
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

function outcome(doc: unknown): string {
  const before = digest(doc);
  const verdict = parseMotionDoc(doc);
  const touched = digest(doc) === before ? '' : ' (input changed)';
  return verdict.ok ? `ok ${digest(verdict.doc)}${touched}` : `refused: ${verdict.error}${touched}`;
}

describe('parseMotionDoc output', () => {
  it('is unchanged for every valid fixture, older shapes included', () => {
    const outcomes = Object.fromEntries(VALID.map(([name, doc]) => [name, outcome(doc)]));

    expect(Object.values(outcomes).filter((o) => !o.startsWith('ok')).length).toBe(0);
    expect(outcomes).toMatchSnapshot();
  });

  it('refuses every invalid fixture with the same error', () => {
    const outcomes = Object.fromEntries(INVALID.map(([name, doc]) => [name, outcome(doc)]));

    expect(outcomes).toMatchSnapshot();
  });

  it.runIf(stressDocs().length)('is unchanged for an outside corpus, against the outcomes recorded beside it', () => {
    const recorded = `${STRESS_DOCS}.outcomes.json`;
    const outcomes = Object.fromEntries(stressDocs().map(([name, doc]) => [name, outcome(doc)]));
    if (!existsSync(recorded)) {
      writeFileSync(recorded, JSON.stringify(outcomes, null, 1));
    }

    expect(outcomes).toEqual(JSON.parse(readFileSync(recorded, 'utf8')));
  });
});
