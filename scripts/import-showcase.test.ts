import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newMotionDoc, MotionFormat, parseMotionDoc } from '$lib/motion/doc';
import { assetPath, docHash, remapAssets, showcaseNode, showcasePlan, SHOWCASE_SOURCES, SHOWCASE_KEY, type ShowcaseSource } from './import-showcase';

const ORG = '82813960-3537-4ec8-8524-b966b46105f1';
const PROJECT = '11111111-1111-4111-8111-111111111111';

function docWithMusic() {
  const base = newMotionDoc(MotionFormat.Landscape);
  return { ...base, assets: [{ id: 'music', kind: 'audio', name: 'music' }], tracks: [...base.tracks, { id: 'a1', kind: 'audio', name: 'Audio', clips: [{ id: 'c1', from: 0, durationInFrames: 30, trimStart: 0, component: 'Audio', props: { assetId: 'music', volume: 1, pan: 0, fadeIn: 0, fadeOut: 0 } }] }] };
}

function fixture(): { dir: string; sources: ShowcaseSource[] } {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  mkdirSync(join(dir, 'good/wide'), { recursive: true });
  writeFileSync(join(dir, 'good/wide/doc.json'), JSON.stringify(docWithMusic()));
  writeFileSync(join(dir, 'good/music.mp3'), 'mp3');
  mkdirSync(join(dir, 'broken'), { recursive: true });
  writeFileSync(join(dir, 'broken/doc.json'), JSON.stringify({ version: 'nope' }));
  return {
    dir,
    sources: [
      { key: 'good', title: 'Good', doc: 'good/wide/doc.json', files: { music: 'good/music.mp3' }, preview: 'good/none.mp4' },
      { key: 'broken', title: 'Broken', doc: 'broken/doc.json', files: {}, preview: 'broken/none.mp4' },
      { key: 'absent', title: 'Absent', doc: 'absent/doc.json', files: {}, preview: 'absent/none.mp4' },
      { key: 'no-music', title: 'No music', doc: 'good/wide/doc.json', files: {}, preview: 'good/none.mp4' }
    ]
  };
}

describe('showcasePlan', () => {
  it('plans a valid cut and skips the rest with a reason', () => {
    const { dir, sources } = fixture();
    const plan = showcasePlan(dir, sources);

    expect(plan.items.map((i) => i.key)).toEqual(['good']);
    expect(plan.items[0].files).toEqual({ music: join(dir, 'good/music.mp3') });
    expect(plan.items[0].preview).toBeNull();
    expect(plan.skipped.map((s) => s.key)).toEqual(['broken', 'absent', 'no-music']);
    expect(plan.skipped.every((s) => s.why.length > 0)).toBe(true);
  });

  it('lays the cuts out on a grid, one cell each', () => {
    const { dir, sources } = fixture();
    const many = Array.from({ length: 6 }, (_, i) => ({ ...sources[0], key: `good-${i}` }));
    const spots = showcasePlan(dir, many).items.map((i) => `${i.spot.x},${i.spot.y}`);

    expect(new Set(spots).size).toBe(many.length);
  });

  it('covers every showcase folder and saturn', () => {
    const folders = new Set(SHOWCASE_SOURCES.map((s) => s.doc.split('/').slice(0, 2).join('/')));
    for (const name of ['liquid-type', 'launch-film', 'material', 'numbers', 'logo-sting', 'drop', 'generative', 'lead-finder']) {
      expect(folders.has(`showcase/${name}`)).toBe(true);
    }
    expect(folders.has('saturn/doc.json')).toBe(true);
    expect(SHOWCASE_SOURCES.filter((s) => s.doc.startsWith('showcase/logo-sting/'))).toHaveLength(3);
    expect(new Set(SHOWCASE_SOURCES.map((s) => s.key)).size).toBe(SHOWCASE_SOURCES.length);
  });

  it('plans both lead-finder cuts with their logo and music', () => {
    const cuts = SHOWCASE_SOURCES.filter((s) => s.doc.startsWith('showcase/lead-finder/'));

    expect(cuts.map((s) => s.doc)).toEqual(['showcase/lead-finder/doc-16x9.json', 'showcase/lead-finder/doc-9x16.json']);
    expect(cuts.map((s) => s.preview)).toEqual(['showcase/lead-finder/lead-finder-16x9.mp4', 'showcase/lead-finder/lead-finder-9x16.mp4']);
    cuts.forEach((s) => expect(s.files).toEqual({ music: 'showcase/lead-finder/music.mp3', logo: 'showcase/lead-finder/logo.svg' }));
  });
});

describe('remapAssets', () => {
  it('points every reference at the uploaded asset row', () => {
    const doc = remapAssets(docWithMusic() as never, { music: 'row-1' });
    const text = JSON.stringify(doc);

    expect(doc.assets).toEqual([{ id: 'row-1', kind: 'audio', name: 'music' }]);
    expect(text).toContain('"assetId":"row-1"');
    expect(text).not.toContain('"assetId":"music"');
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('leaves names that only look like an asset id alone', () => {
    const base = docWithMusic();
    const clip = { ...base.tracks.at(-1)!.clips[0], id: 'logo', props: { assetId: 'logo', volume: 1, pan: 0, fadeIn: 0, fadeOut: 0 } };
    const field = { key: 'logo', label: 'logo', type: 'asset', clipId: 'logo', prop: 'assetId', default: 'logo' };
    const source = { ...base, assets: [{ id: 'logo', kind: 'audio', name: 'logo' }], tracks: [...base.tracks.slice(0, -1), { ...base.tracks.at(-1)!, clips: [clip] }], fields: [field] };

    const doc = remapAssets(source as never, { logo: 'row-1' });

    expect(doc.assets[0].id).toBe('row-1');
    expect(doc.fields[0]).toMatchObject({ key: 'logo', label: 'logo', clipId: 'logo', prop: 'assetId', default: 'row-1' });
    expect(doc.tracks.at(-1)!.clips[0]).toMatchObject({ id: 'logo', props: { assetId: 'row-1' } });
    expect(parseMotionDoc(doc).ok).toBe(true);
  });
});

describe('idempotency', () => {
  it('finds the node already imported for a key', () => {
    const nodes = [
      { id: 'n1', type: 'motion', data: { [SHOWCASE_KEY]: 'drop' } },
      { id: 'n2', type: 'motion', data: { [SHOWCASE_KEY]: 'saturn' } },
      { id: 'n3', type: 'text', data: { [SHOWCASE_KEY]: 'saturn' } }
    ];

    expect(showcaseNode(nodes, 'saturn')?.id).toBe('n2');
    expect(showcaseNode(nodes, 'numbers')).toBeNull();
  });

  it('stores each file at a path fixed by the key, inside the project folder', () => {
    const path = assetPath({ orgId: ORG, projectId: PROJECT }, 'drop', 'music', '/x/music.mp3');

    expect(path).toBe(`${ORG}/${PROJECT}/showcase/drop/music.mp3`);
    expect(assetPath({ orgId: ORG, projectId: PROJECT }, 'drop', 'music', '/y/other.mp3')).toBe(path);
  });
});

describe('docHash', () => {
  it('is the same for an identical doc whatever the key order, so a rerun writes no revision', () => {
    const doc = docWithMusic();
    const reordered = Object.fromEntries(Object.entries(doc).reverse());

    expect(docHash(reordered as never)).toBe(docHash(doc as never));
    expect(docHash({ ...doc, fps: 60 } as never)).not.toBe(docHash(doc as never));
  });
});
