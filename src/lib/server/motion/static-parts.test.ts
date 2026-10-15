import { describe, expect, it } from 'vitest';
import { staticParts } from './static-parts';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { CHECKER_STEPS_POSTER_TEMPLATE } from '$lib/motion/template/checker-steps-poster/template';
import { TYPE_GRID_POSTER_TEMPLATE } from '$lib/motion/template/type-grid-poster/template';
import type { MotionDoc } from '$lib/motion/doc';

const clipOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Custom')!;

describe('staticParts: poster parts read from the template, no player', () => {
  it('checker steps: one part per title step, then body, index and marker', () => {
    const doc = CHECKER_STEPS_POSTER_TEMPLATE.template.doc;
    const parts = staticParts(doc)[clipOf(doc).id];
    expect(parts).toEqual(expect.arrayContaining(['title:0', 'title:4', 'body', 'index', 'marker']));
    expect(parts.filter((p) => p.startsWith('title:'))).toHaveLength(5);
  });

  it('type grid: each big line, inline photo, arrow and footer column', () => {
    const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
    const parts = staticParts(doc)[clipOf(doc).id];
    expect(parts).toEqual(expect.arrayContaining(['lines:0', 'lines:5', 'photos:0', 'photos:2', 'arrow:4', 'footer1', 'footer4']));
  });

  it('a line added to the doc adds its part', () => {
    const doc = CHECKER_STEPS_POSTER_TEMPLATE.template.doc;
    const clip = clipOf(doc);
    const longer = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clip.id ? { ...c, props: { ...c.props, title: 'a\nb\nc\nd\ne\nf' } } : c)) })) } as MotionDoc;
    expect(staticParts(longer)[clip.id].filter((p) => p.startsWith('title:'))).toHaveLength(6);
  });

  it('every built-in poster names its parts', () => {
    const posters = BUILTIN_TEMPLATES.filter((e) => e.id.includes('poster-') && Object.values(e.template.doc.components).some((c) => c.source.js.includes('data-part')));
    expect(posters.length).toBeGreaterThan(20);
    for (const entry of posters) {
      const found = Object.values(staticParts(entry.template.doc)).flat();
      expect(found.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('never runs a component that is not a built-in', () => {
    const doc = CHECKER_STEPS_POSTER_TEMPLATE.template.doc;
    const [name, component] = Object.entries(doc.components)[0];
    const edited = { ...doc, components: { [name]: { ...component, source: { ...component.source, js: component.source.js + '\nthrow new Error("ran")' } } } } as MotionDoc;
    expect(staticParts(edited)).toEqual({});
  });
});
