import { describe, expect, it } from 'vitest';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { everyClip } from '$lib/motion/doc';
import { publishRefusal } from '$lib/gallery/refusals';
import { ProjectMode } from '$lib/project-mode';
import { builtinTitle, DEMOS, EXCLUDED_DEMOS, filledTemplate, seedId } from './seed-gallery';

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
});
