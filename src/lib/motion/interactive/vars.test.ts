import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { VAR_RULES, VarKind, bindTargets, starterVar, bindVar, boundDoc, coerceVars, declareVar, defaultsOf, numericVars, removeVar, varSchemaOf, withVars, type VarDecl } from './vars';
import { Outside, interactiveOf } from './settings';
import { bakeExpressions, expressionValue } from '../expression/bake';
import { liveScene } from './live';
import { liveSpec } from './spec';

const SPEED: VarDecl = { name: 'speed', kind: VarKind.Number, default: 1, min: 0, max: 4 };
const ON: VarDecl = { name: 'on', kind: VarKind.Boolean, default: true };
const MOOD: VarDecl = { name: 'mood', kind: VarKind.Enum, default: 'calm', options: ['calm', 'loud'] };
const TINT: VarDecl = { name: 'tint', kind: VarKind.Color, default: '#ff0000' };
const LABEL: VarDecl = { name: 'label', kind: VarKind.String, default: 'Hi' };
const ALL = [SPEED, ON, MOOD, TINT, LABEL];

function withText(): { doc: MotionDoc; id: string } {
  const r = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60 }, 't1');
  if (!r.ok) {
    throw new Error(r.error);
  }
  return { doc: r.doc, id: 't1' };
}

function declared(doc: MotionDoc, decls: VarDecl[]): MotionDoc {
  return decls.reduce((d, decl) => {
    const r = declareVar(d, decl);
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  }, doc);
}

describe('runtime variables', () => {
  it('reads every kind from its default', () => {
    expect(defaultsOf(ALL)).toEqual({ speed: 1, on: true, mood: 'calm', tint: '#ff0000', label: 'Hi' });
  });

  it('keeps known, valid values and clamps numbers into their range', () => {
    expect(coerceVars(ALL, { speed: 9, on: false, mood: 'loud', tint: '#00FF00', label: 'Yo', ghost: 1 })).toEqual({ speed: 4, on: false, mood: 'loud', tint: '#00ff00', label: 'Yo' });
  });

  it('drops values of the wrong type, unknown options and bad colours', () => {
    expect(coerceVars(ALL, { speed: 'fast', on: 1, mood: 'angry', tint: 'red', label: 3 })).toEqual({});
    expect(coerceVars(ALL, null)).toEqual({});
  });

  it('coerces the same once serialised into the player page', () => {
    const shipped = new Function(`return (${coerceVars.toString()})`)() as typeof coerceVars;

    expect(shipped(ALL, { speed: 9, tint: '#ABCDEF', mood: 'x' }, VAR_RULES)).toEqual({ speed: 4, tint: '#abcdef' });
  });

  it('turns booleans and options into numbers expressions can read, and leaves text and colours out', () => {
    expect(numericVars(ALL, { ...defaultsOf(ALL), on: false, mood: 'loud' })).toEqual({ speed: 1, on: 0, mood: 1 });
  });

  it('describes the schema a host builds controls from', () => {
    expect(varSchemaOf([SPEED, MOOD])).toEqual([
      { name: 'speed', kind: 'number', default: 1, min: 0, max: 4 },
      { name: 'mood', kind: 'enum', default: 'calm', options: ['calm', 'loud'] }
    ]);
  });

  it('declares, replaces and removes a variable on the doc, which still parses', () => {
    const doc = declared(newMotionDoc(MotionFormat.Landscape), [SPEED, { ...SPEED, max: 8 }]);

    expect(interactiveOf(doc).vars).toEqual([{ ...SPEED, max: 8 }]);
    expect(motionDocSchema.safeParse(doc).success).toBe(true);
    const r = removeVar(doc, 'speed');
    expect(r.ok && interactiveOf(r.doc).vars).toEqual([]);
  });

  it('refuses a bad name, a default outside the range and an enum default not among its options', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);

    expect(declareVar(doc, { ...SPEED, name: '2fast' }).ok).toBe(false);
    expect(declareVar(doc, { ...SPEED, default: 9 }).ok).toBe(false);
    expect(declareVar(doc, { ...MOOD, default: 'angry' }).ok).toBe(false);
  });

  it('binds a number to a layer property through an expression', () => {
    const { doc, id } = withText();
    const r = bindVar(declared(doc, [SPEED]), { var: 'speed', clip: id, prop: 'rotateZ' });

    expect(r.ok).toBe(true);
    expect(r.ok && r.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.expressions.rotateZ).toBe('vars.speed');
  });

  it('binds text and colour to a text layer, and refuses what the layer cannot show', () => {
    const { doc, id } = withText();
    const base = declared(doc, [TINT, LABEL, SPEED]);

    const text = bindVar(base, { var: 'label', clip: id, prop: 'text' });
    expect(text.ok).toBe(true);
    const colour = text.ok ? bindVar(text.doc, { var: 'tint', clip: id, prop: 'color' }) : text;
    expect(colour.ok && interactiveOf(colour.doc).bindings).toEqual([
      { var: 'label', clip: id, prop: 'text' },
      { var: 'tint', clip: id, prop: 'color' }
    ]);
    expect(bindVar(base, { var: 'tint', clip: id, prop: 'text' }).ok).toBe(false);
    expect(bindVar(base, { var: 'ghost', clip: id, prop: 'text' }).ok).toBe(false);
  });

  it('every kind starts from a valid declaration, and lists what it can bind on a layer', () => {
    for (const kind of Object.values(VarKind)) {
      expect(declareVar(newMotionDoc(MotionFormat.Landscape), starterVar(kind, 'v')).ok).toBe(true);
    }
    expect(bindTargets('Caption', VarKind.Color)).toEqual(['color', 'background']);
    expect(bindTargets('Shape', VarKind.String)).toEqual([]);
    expect(bindTargets('Shape', VarKind.Number)).toContain('rotateZ');
  });

  it('removing a variable removes its bindings', () => {
    const { doc, id } = withText();
    const bound = bindVar(declared(doc, [LABEL]), { var: 'label', clip: id, prop: 'text' });
    const r = bound.ok ? removeVar(bound.doc, 'label') : bound;

    expect(r.ok && interactiveOf(r.doc).bindings).toEqual([]);
  });

  it('a deterministic render shows the defaults, or the values it was given', () => {
    const { doc, id } = withText();
    const bound = bindVar(declared(doc, [LABEL]), { var: 'label', clip: id, prop: 'text' });
    if (!bound.ok) {
      throw new Error(bound.error);
    }
    const textOf = (d: MotionDoc) => d.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.props.text;

    expect(textOf(boundDoc(bound.doc))).toBe('Hi');
    expect(textOf(boundDoc(withVars(bound.doc, { label: 'Ciao' })))).toBe('Ciao');
    expect(textOf(boundDoc(withVars(bound.doc, { label: 42 })))).toBe('Hi');
  });
});

describe('expressions read runtime variables', () => {
  const spinning = () => {
    const { doc, id } = withText();
    const r = bindVar(declared(doc, [SPEED]), { var: 'speed', clip: id, prop: 'rotateZ' });
    if (!r.ok) {
      throw new Error(r.error);
    }
    return { doc: r.doc, id };
  };

  it('a render reads the default, or the value it was given', () => {
    const { doc, id } = spinning();

    expect(expressionValue(doc, id, 'rotateZ', 10)).toBe(1);
    expect(expressionValue(withVars(doc, { speed: 3 }), id, 'rotateZ', 10)).toBe(3);
  });

  it('the live scene reads what the host sent, frame after frame, without a new scene', () => {
    const { doc, id } = spinning();
    const scene = liveScene(liveSpec({ live: doc, baked: bakeExpressions(doc), outside: Outside.Fallback, parents: [], color: (v) => v }));

    expect(scene.tick({}, 10, 0).get(`${id}.rotateZ`)).toBe(1);
    expect(scene.tick({}, 11, 0, { speed: 2.5 }).get(`${id}.rotateZ`)).toBe(2.5);
  });

  it('the live spec carries the variables and the text and colour bindings', () => {
    const { doc, id } = withText();
    const bound = bindVar(declared(doc, [LABEL]), { var: 'label', clip: id, prop: 'text' });
    if (!bound.ok) {
      throw new Error(bound.error);
    }
    const spec = liveSpec({ live: bound.doc, baked: bakeExpressions(bound.doc), outside: Outside.Fallback, parents: [], color: (v) => v });

    expect(spec.vars).toEqual([LABEL]);
    expect(spec.bindings).toEqual([{ var: 'label', selector: `[data-clip="${id}"] [data-fit]`, paint: 'text' }]);
  });
});
