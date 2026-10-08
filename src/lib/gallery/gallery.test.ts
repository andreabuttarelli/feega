import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { BrandKind } from '$lib/motion/script';
import { ProjectMode } from '$lib/project-mode';
import { builtinTemplate, BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { bandOf, byline, DurationBand, factsOf, filterHref, GalleryKind, glyphSize, publishMetaSchema, rangeHref, resultCount, SLIDER_MAX, swapAssetIds } from './model';
import { publishRefusal, PublishRefusal, type PublishFacts } from './refusals';
import { exposeMainFields } from './remix-fields';

const LOGO_ASSET = '7d1a2b0c-0000-4000-8000-000000000001';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function demo(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Make it move.' } }, 'title'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', fill: '#ff5a1f' } }, 'bar'));
  doc = must(addClip(doc, { component: 'Logo', from: 30, durationInFrames: 60, props: { assetId: LOGO_ASSET } }, 'logo'));
  return { ...doc, assets: [{ id: LOGO_ASSET, kind: 'image', name: 'logo' }] };
}

const facts = (over: Partial<PublishFacts> = {}): PublishFacts => ({ mode: ProjectMode.Standard, hasBrand: false, doc: demo(), siteAssetIds: new Set(), ...over });

describe('the gallery item', () => {
  it('reads kind, format and seconds from the doc', () => {
    expect(factsOf(demo())).toEqual({ kind: GalleryKind.Motion, format: MotionFormat.Landscape, durationS: 15 });
  });

  it('a doc with a 3D composition of media is a composition', () => {
    const grid = builtinTemplate('builtin:composition-tilted-grid') ?? BUILTIN_TEMPLATES.find((t) => t.id.includes('composition'));
    expect(factsOf(grid!.template.doc).kind).toBe(GalleryKind.Composition);
  });

  it('puts every length in one band', () => {
    expect([bandOf(4), bandOf(6), bandOf(7.2), bandOf(30)]).toEqual([DurationBand.Short, DurationBand.Short, DurationBand.Medium, DurationBand.Long]);
  });

  it('credits the author and the original of a remix', () => {
    expect(byline({ authorName: 'Feega', remixedFrom: null })).toBe('by Feega');
    expect(byline({ authorName: 'Ada', remixedFrom: { id: 'x', title: 'Liquid glass', authorName: 'Feega' } })).toBe('by Ada · remix of Liquid glass');
  });

  it('keeps tags short, lowercase and unique', () => {
    const meta = publishMetaSchema.parse({ title: ' Launch ', tags: ['Launch', 'launch', 'UI'] });
    expect(meta).toEqual({ title: 'Launch', description: '', tags: ['launch', 'ui'] });
    expect(publishMetaSchema.safeParse({ title: 'x', tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }).success).toBe(false);
  });

  it('swaps asset ids everywhere the doc names them, and nothing else', () => {
    const swapped = swapAssetIds(demo(), { [LOGO_ASSET]: 'new-logo' });
    expect(swapped.assets[0].id).toBe('new-logo');
    expect(swapped.tracks.flatMap((t) => t.clips).find((c) => c.id === 'logo')?.props.assetId).toBe('new-logo');
    expect(JSON.stringify(swapped)).not.toContain(LOGO_ASSET);
    expect(swapped.tracks.flatMap((t) => t.clips).find((c) => c.id === 'title')?.props.text).toBe('Make it move.');
  });
});

describe('what never goes to the gallery', () => {
  it('a generic video goes', () => {
    expect(publishRefusal(facts())).toBeNull();
  });

  it('nothing from an uncensored project', () => {
    expect(publishRefusal(facts({ mode: ProjectMode.Uncensored }))?.refusal).toBe(PublishRefusal.Uncensored);
  });

  it('nothing written as the story of a real brand', () => {
    const doc = { ...demo(), script: { brand: BrandKind.Real } } as MotionDoc;
    expect(publishRefusal(facts({ doc }))?.refusal).toBe(PublishRefusal.RealBrandScript);
  });

  it('an invented brand goes', () => {
    const doc = { ...demo(), script: { brand: BrandKind.Fictional } } as MotionDoc;
    expect(publishRefusal(facts({ doc }))).toBeNull();
  });

  it('no logo picked from the project brand', () => {
    const doc = must(addClip(demo(), { component: 'Logo', from: 0, durationInFrames: 30, props: { assetId: '' } }, 'brand-logo'));
    expect(publishRefusal(facts({ doc, hasBrand: true }))?.refusal).toBe(PublishRefusal.BrandLogo);
    expect(publishRefusal(facts({ doc, hasBrand: false }))).toBeNull();
  });

  it('no logo or picture imported from a website', () => {
    expect(publishRefusal(facts({ siteAssetIds: new Set([LOGO_ASSET]) }))?.refusal).toBe(PublishRefusal.SiteMaterial);
  });

  it('nothing empty', () => {
    expect(publishRefusal(facts({ doc: newMotionDoc(MotionFormat.Square) }))?.refusal).toBe(PublishRefusal.Empty);
  });
});

describe('the main fields of a remix', () => {
  it('exposes texts, logo and colours like a template', () => {
    const fields = exposeMainFields(demo()).fields;
    expect(fields.map((f) => [f.key, f.type, f.clipId, f.default])).toEqual([
      ['text_1', 'text', 'title', 'Make it move.'],
      ['colour_1', 'color', 'bar', '#ff5a1f'],
      ['logo_1', 'asset', 'logo', LOGO_ASSET]
    ]);
    expect(fields[0].label).toBe('Text · Make it move.');
  });

  it('keeps the fields a template already exposes', () => {
    const template = BUILTIN_TEMPLATES[0].template.doc;
    expect(exposeMainFields(template).fields).toEqual(template.fields);
  });
});

describe('the details of the gallery filters', () => {
  it('draws each format as a rectangle in its real proportions, never taller or wider than the box', () => {
    expect(glyphSize(MotionFormat.Landscape)).toEqual({ width: 14, height: 8 });
    expect(glyphSize(MotionFormat.Vertical)).toEqual({ width: 8, height: 14 });
    expect(glyphSize(MotionFormat.Square)).toEqual({ width: 14, height: 14 });
    expect(glyphSize(MotionFormat.Portrait)).toEqual({ width: 11, height: 14 });
  });

  it('keeps the other filters when the length range changes, and drops an open end', () => {
    expect(filterHref({ kind: 'motion' }, 'min', '4')).toBe('/gallery?kind=motion&min=4');
    expect(rangeHref({ kind: 'motion', min: '4' }, { min: 0, max: 12 })).toBe('/gallery?kind=motion&max=12');
    expect(rangeHref({}, { min: 0, max: SLIDER_MAX })).toBe('/gallery');
  });

  it('counts the results in words', () => {
    expect([resultCount(0), resultCount(1), resultCount(36)]).toEqual(['No videos', '1 video', '36 videos']);
  });
});
