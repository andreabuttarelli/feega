import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { parseProps } from './components';
import { Forbidden, HOUSE_DEFAULTS, HOUSE_DEFAULTS_RULE, STYLES, TITLE_TYPE_RULE, styleProblems } from './style';
import { FontClass, Imagery, SmallText } from './reference-look-model';
import { SEVERITY, Severity } from './direction';
import { MotionStyle } from './style-model';
import { BUILTIN_TEMPLATES } from './template/builtins';
import { insertTemplate } from './template/library';

const props = (id: 'Title' | 'Text', raw: Record<string, unknown>) => {
  const verdict = parseProps(id, { text: 'Ship.', ...raw });
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.props;
};

const blank = (style: MotionStyle): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), style });

function titled(style: MotionStyle, raw: Record<string, unknown>): MotionDoc {
  const r = addClip(blank(style), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Ship.', ...raw } }, 't');
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const named = (doc: MotionDoc) => styleProblems(doc).filter((p) => p.effect === Forbidden.TitleType);

describe('titles are semibold or medium with very tight tracking', () => {
  it('a headline-size Title or Text defaults to weight 600 and tracking -0.05', () => {
    expect(props('Title', {})).toMatchObject({ weight: 600, tracking: -0.05 });
    expect(props('Text', { size: 0.1 })).toMatchObject({ weight: 600, tracking: -0.05 });
  });

  it('keeps a weight or tracking the caller gave', () => {
    expect(props('Title', { weight: 500, tracking: -0.06 })).toMatchObject({ weight: 500, tracking: -0.06 });
  });

  it('leaves body text alone', () => {
    expect(props('Text', {})).toMatchObject({ weight: 400, tracking: -0.01 });
  });

  it.each([
    [{ weight: 600, tracking: -0.05 }, 0],
    [{ weight: 500, tracking: -0.04 }, 0],
    [{ weight: 800, tracking: -0.05 }, 1],
    [{ weight: 300, tracking: -0.05 }, 1],
    [{ weight: 600, tracking: -0.02 }, 1],
    [{ weight: 600, tracking: -0.09 }, 1]
  ])('the gate on %o names %i problem', (raw, count) => {
    expect(named(titled(MotionStyle.LaunchFilm, raw))).toHaveLength(count);
  });

  it('is a warning, in the house styles', () => {
    expect(SEVERITY[Forbidden.TitleType]).toBe(Severity.Warning);
    expect(named(titled(MotionStyle.AppleMinimal, { weight: 900 }))).toHaveLength(1);
    expect(STYLES[MotionStyle.LaunchFilm].rules).toContain(TITLE_TYPE_RULE);
    expect(STYLES[MotionStyle.AppleMinimal].rules).toContain(TITLE_TYPE_RULE);
  });

  it.each(BUILTIN_TEMPLATES.map((e) => [e.id, e] as const))('%s passes the gate', (_, entry) => {
    const r = insertTemplate(blank(MotionStyle.LaunchFilm), entry, { from: 0, newId: () => 'x' });
    if (!r.ok) {
      throw new Error(r.error);
    }
    expect(named(r.doc)).toEqual([]);
  });
});

describe('the house title type yields to the references', () => {
  it('a heavy title raises no title-type problem once the references set the type', () => {
    const doc = titled(MotionStyle.LaunchFilm, { weight: 900, tracking: 0 });
    const look = { typeScale: 0.6, bleed: false, columns: 1, smallText: SmallText.None, palette: ['#000000'], font: FontClass.Grotesk, imagery: Imagery.None };

    expect(named(doc)).toHaveLength(1);
    expect(named({ ...doc, referenceLook: look })).toEqual([]);
  });

  it('every house default is named in the rule that lets it yield', () => {
    expect(HOUSE_DEFAULTS).toContain(Forbidden.TitleType);
    expect(HOUSE_DEFAULTS_RULE).toContain(Forbidden.TitleType);
  });
});
