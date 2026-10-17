import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { TYPE_GRID_POSTER_TEMPLATE } from '$lib/motion/template/type-grid-poster/template';
import { TYPE_GRID_COMPONENT } from '$lib/motion/template/type-grid-poster/component';
import { PartEdit, editablePart } from '$lib/motion/poster-parts';
import { partFocus } from '$lib/motion/inspector';
import { PAGE, type PartUsage } from '$lib/motion/part-usage';
import type { MotionClip, MotionDoc } from '$lib/motion/doc';
import { derivePartUsage } from './derive-part-usage';
import { PART_ATTR, staticParts } from './static-parts';

const posters = BUILTIN_TEMPLATES.filter((e) => Object.values(e.template.doc.components).some((c) => c.source.js.includes(PART_ATTR)));

function derivedTable(): Record<string, PartUsage> {
  const table: Record<string, PartUsage> = {};
  for (const entry of posters) {
    const doc = entry.template.doc;
    for (const [name, component] of Object.entries(doc.components)) {
      const usage = derivePartUsage(component, doc);
      if (usage && Object.keys(usage.parts).length) {
        table[name] = usage;
      }
    }
  }
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}

const table = derivedTable();

const customClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Custom') as MotionClip[];

type TextPart = [string, MotionDoc, MotionClip, string];

const textParts: TextPart[] = posters.flatMap((entry) => {
  const doc = entry.template.doc;
  const found = staticParts(doc);
  return customClips(doc).flatMap((clip) => (found[clip.id] ?? []).filter((part) => editablePart(doc, clip, part) === PartEdit.Text).map((part): TextPart => [`${entry.id} ${part}`, doc, clip, part]));
});

describe('the part usage table is derived from the templates', () => {
  it('matches what each poster renders (regenerate with vitest -u)', async () => {
    await expect(`${JSON.stringify(table, null, 2)}\n`).toMatchFileSnapshot('../../motion/template/part-usage.json');
  });

  it('type grid: the poster colour is the page, the type colour reaches its lines', () => {
    const usage = table[TYPE_GRID_COMPONENT];
    expect(usage.fields.paper).toEqual([PAGE]);
    expect(usage.fields.ink).toContain('lines');
  });
});

describe('a selected text part lists only its own fields', () => {
  it('every poster has text parts to check', () => {
    expect(textParts.length).toBeGreaterThan(40);
  });

  it.each(textParts)('%s', (_name, doc, clip, part) => {
    const usage = table[String(clip.props.name)];
    const shown = partFocus(doc, clip, part);
    const field = part.split(':')[0];
    const foreign = shown.filter((key) => key !== field && !(usage.fields[key] ?? []).includes(field));
    expect(foreign, 'fields used only by other parts or by the page').toEqual([]);
  });
});

describe('the type grid studio line', () => {
  const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
  const clip = customClips(doc)[0];

  it('never shows the poster colour nor the colour every line shares', () => {
    const shown = partFocus(doc, clip, 'lines:0');
    expect(shown).not.toContain('paper');
    expect(shown).not.toContain('ink');
  });
});
