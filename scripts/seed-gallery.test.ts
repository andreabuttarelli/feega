import { describe, expect, it } from 'vitest';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { everyClip } from '$lib/motion/doc';
import { publishRefusal } from '$lib/gallery/refusals';
import { ProjectMode } from '$lib/project-mode';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { applyValues } from '$lib/motion/template/fields';
import { builtinTitle, catalogue, DEMOS, EXCLUDED_DEMOS, filledTemplate, seedId, seedProblems, SHOWCASE, SOURCE_DIR } from './seed-gallery';

function titled(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 't1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return { ...added.doc, assets: [{ id: 'music', kind: 'audio', name: 'music' }] };
}

const ready = { key: 'k', title: 't', description: 'd', tags: [], doc: titled(), files: { music: '/x/music.mp3' }, preview: '/x/p.mp4', poster: '/x/p.jpg' };

describe('the Feega gallery seed', () => {
  it('gives every item the same id on every run, so a second run updates instead of duplicating', () => {
    expect(seedId('liquid-glass-lens')).toBe(seedId('liquid-glass-lens'));
    expect(seedId('liquid-glass-lens')).not.toBe(seedId('liquid-glass-blob'));
    expect(seedId('liquid-glass-lens')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never publishes a real brand', () => {
    const real = /supasito|dub|allbirds/i;
    expect(DEMOS.filter((d) => real.test(`${d.key} ${d.doc} ${d.title}`))).toEqual([]);
    expect(EXCLUDED_DEMOS.map((e) => e.name).join(' ')).toMatch(/supasito.*dub.*allbirds/s);
  });

  it('fills a composition template with sample cards, so it plays instead of showing an empty stage', () => {
    const doc = filledTemplate(builtinTemplate('builtin:composition-bento')!.template.doc, 8);
    const media = everyClip(doc).find((c) => c.component === 'Composition')?.props.media as { assetId: string }[];
    expect(media.map((m) => m.assetId)).toEqual(['sample-0', 'sample-1', 'sample-2', 'sample-3', 'sample-4', 'sample-5', 'sample-6', 'sample-7']);
    expect(doc.assets.map((a) => a.id).sort()).toEqual(media.map((m) => m.assetId).sort());
    expect(publishRefusal({ mode: ProjectMode.Standard, hasBrand: false, doc, siteAssetIds: new Set() })).toBeNull();
  });

  it('puts the Feega mark in a logo slot and a picture in the others', () => {
    const doc = filledTemplate(builtinTemplate('builtin:launch-logo-build')!.template.doc, 8);
    expect(everyClip(doc).find((c) => c.component === 'Logo')?.props.assetId).toBe('sample-logo');
  });

  it('drops the "Launch ·" prefix from the template name', () => {
    expect(builtinTitle('Launch · Device orbit')).toBe('Device orbit');
  });

  it('passes an item with its files, a preview, a poster and something to edit', () => {
    expect(seedProblems(ready)).toEqual([]);
  });

  it('refuses an item that still points at a local server, a file it does not ship, or has nothing to show', () => {
    const local = { ...ready, doc: { ...ready.doc, assets: [{ id: 'music', kind: 'audio' as const, name: 'http://localhost:8794/music.mp3' }] } };

    expect(seedProblems(local)).toEqual([expect.stringMatching(/local server/)]);
    expect(seedProblems({ ...ready, files: {} })).toEqual([expect.stringMatching(/music/)]);
    expect(seedProblems({ ...ready, files: { music: 'http://localhost:8794/music.mp3' } })).toEqual([expect.stringMatching(/local server/)]);
    expect(seedProblems({ ...ready, preview: null, poster: null })).toEqual([expect.stringMatching(/preview/), expect.stringMatching(/poster/)]);
  });

  it('refuses an item a remixer could not change', () => {
    const bare = { ...ready, doc: { ...newMotionDoc(MotionFormat.Landscape), assets: [] }, files: {} };

    expect(seedProblems(bare)).toEqual([expect.stringMatching(/edit/)]);
  });

  it('ships the six showcase videos, every cut with a preview and its music licence', () => {
    const names = new Set(SHOWCASE.map((d) => d.doc.split('/')[1]));

    expect([...names].sort()).toEqual(['drop', 'launch-film', 'liquid-type', 'logo-sting', 'material', 'numbers']);
    expect(SHOWCASE.filter((d) => !d.preview.endsWith('.mp4') || !d.licence)).toEqual([]);
    expect(SHOWCASE.every((d) => DEMOS.includes(d))).toBe(true);
  });

  it.skipIf(!existsSync(join(SOURCE_DIR, 'showcase')))('builds every showcase cut from the local folder with nothing to refuse', () => {
    const { seeds, skipped } = catalogue(mkdtempSync(join(tmpdir(), 'seed-test-')), SHOWCASE);
    const problems = seeds.flatMap((s) => seedProblems(s).map((p) => `${s.key}: ${p}`));

    expect(skipped).toEqual([]);
    expect(problems).toEqual([]);
    expect(seeds).toHaveLength(SHOWCASE.length);
  }, 120_000);
});

describe.skipIf(!existsSync(join(SOURCE_DIR, 'showcase/drop')))('the product drop showcase', () => {
  it('changes the price once and the accent in every scene', () => {
    const { seeds } = catalogue(mkdtempSync(join(tmpdir(), 'seed-test-')), SHOWCASE.filter((d) => d.key === 'showcase-drop'));
    const filled = applyValues(seeds[0].doc, { price: '89', accent: '#00ff00' });
    const clips = filled.ok ? Object.values(filled.doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips)) : [];

    expect(clips.filter((c) => c.props.price !== undefined).map((c) => c.props.price)).toEqual(['89']);
    expect(clips.filter((c) => c.props.fill === '#ff4a1c')).toEqual([]);
    expect(clips.filter((c) => c.props.fill === '#00ff00')).toHaveLength(4);
  });
});

describe('seed owner', () => {
  it('gives the system user a profile before joining it to the org, as orgs_members requires', async () => {
    const { fakeDb } = await import('$lib/server/db/fake-db');
    const { seedOrg } = await import('./seed-gallery');
    const { db, calls } = fakeDb({ orgs: [{ id: 'org-f', name: 'Feega', slug: 'feega' }], orgs_members: [], profiles: [] });

    await seedOrg(db, 'u-sys', 'feega');

    const profile = calls.findIndex((c) => c.table === 'profiles' && c.op === 'upsert');
    const member = calls.findIndex((c) => c.table === 'orgs_members' && c.op === 'insert');
    expect(profile).toBeGreaterThan(-1);
    expect(profile).toBeLessThan(member);
    expect(calls[profile].payload).toMatchObject({ id: 'u-sys', email: 'gallery@feega.app' });
  });
});
