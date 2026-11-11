import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { VarType, type Variables } from '@feega/motion-core/motion/variables-model';
import { resolveVariables } from '$lib/motion/variables';
import type { TokenMap } from './design-tokens';
import { pulledTokens } from './token-pull';

const C = 'traidue Colors';

type Tok = { name: string; light: string; dark?: string; line: number };

function side(tokens: Tok[], bound: Record<string, string> = {}, values: Record<string, { Light: string; Dark: string }> = {}): { doc: MotionDoc; map: TokenMap } {
  const vars: Variables[string]['vars'] = {};
  const map: TokenMap = {};
  for (const t of tokens) {
    const short = t.name.replace('--color-', '');
    vars[short] = { type: VarType.Colour, values: values[short] ?? { Light: t.light, Dark: t.dark ?? t.light } };
    map[`${C}/${short}`] = { name: t.name, origins: { Light: `src/app.css:${t.line}:1`, ...(t.dark ? { Dark: `src/app.css:${t.line + 20}:1` } : {}) }, raw: { Light: t.light, ...(t.dark ? { Dark: t.dark } : {}) } };
  }
  const clips = Object.entries(bound).map(([at, key], i) => ({ ...newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: { shape: 'rect', fill: '#000000' } }), parent: null, ...(key ? { bind: { fill: key } } : {}), source: { at, tag: 'div', cls: '', was: {} } }));
  const doc = { ...newMotionDoc(MotionFormat.Square), tracks: [{ id: 'v', kind: 'visual', name: '', clips }], variables: { [C]: { modes: ['Light', 'Dark'], active: 'Light', vars } } } as MotionDoc;
  return { doc: resolveVariables(doc), map };
}

const PRIMARY: Tok = { name: '--color-primary', light: '#111111', dark: '#f0f0f0', line: 3 };
const MUTED: Tok = { name: '--color-muted', light: '#777777', dark: '#888888', line: 4 };
const value = (doc: MotionDoc, name: string, mode = 'Light') => doc.variables?.[C]?.vars[name]?.values[mode];
const fills = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.source?.at, c.bind?.fill ?? null, c.props.fill]);

describe('pulledTokens', () => {
  it('a token added in the code is added, unbound, and reported', () => {
    const local = side([PRIMARY]);
    const upstream = side([PRIMARY, MUTED]);
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'muted')).toBe('#777777');
    expect(done.map[`${C}/muted`].name).toBe('--color-muted');
    expect(done.report).toContain('--color-muted: added');
  });

  it('a value changed in the code reaches the variable and its layers when the canvas left it alone', () => {
    const local = side([PRIMARY], { 'a.svelte:1:1': `${C}/primary` });
    const upstream = side([{ ...PRIMARY, light: '#222222' }], { 'a.svelte:1:1': `${C}/primary` });
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'primary')).toBe('#222222');
    expect(fills(done.doc)).toEqual([['a.svelte:1:1', `${C}/primary`, '#222222']]);
    expect(done.report).toContain('--color-primary (Light): revalued in the code');
    expect(done.conflicts).toEqual([]);
  });

  it('a canvas edit the code did not touch is kept, still waiting to be written', () => {
    const local = side([PRIMARY, MUTED], {}, { primary: { Light: '#1565c0', Dark: '#f0f0f0' } });
    const upstream = side([PRIMARY, { ...MUTED, light: '#666666' }]);
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'primary')).toBe('#1565c0');
    expect(value(done.doc, 'muted')).toBe('#666666');
    expect(done.conflicts).toEqual([]);
  });

  it('the code wins when both sides changed the same mode, and the canvas value is reported', () => {
    const local = side([PRIMARY], {}, { primary: { Light: '#1565c0', Dark: '#f0f0f0' } });
    const upstream = side([{ ...PRIMARY, light: '#222222' }]);
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'primary')).toBe('#222222');
    expect(done.conflicts).toEqual(['--color-primary (Light): changed in the code too, the code wins; the canvas value was #1565c0']);
  });

  it('a removed token still bound by layers stays as an orphan, its layers keep their look and binding, reported', () => {
    const local = side([PRIMARY, MUTED], { 'a.svelte:1:1': `${C}/muted` });
    const upstream = side([PRIMARY], { 'a.svelte:1:1': '' });
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'muted')).toBe('#777777');
    expect(done.map[`${C}/muted`].orphan).toBe(true);
    expect(fills(done.doc)).toEqual([['a.svelte:1:1', `${C}/muted`, '#777777']]);
    expect(done.report).toContain('--color-muted: removed in the code, kept on the canvas as an orphan: 1 layer still bound');
  });

  it('a removed token nobody binds is removed', () => {
    const done = pulledTokens(side([PRIMARY, MUTED]), side([PRIMARY]));
    expect(value(done.doc, 'muted')).toBeUndefined();
    expect(done.map[`${C}/muted`]).toBeUndefined();
    expect(done.report).toContain('--color-muted: removed');
  });

  it('a rename with the same values in every mode and the same usages keeps the canvas edits on the new name', () => {
    const local = side([PRIMARY, MUTED], { 'a.svelte:1:1': `${C}/muted` }, { muted: { Light: '#123456', Dark: '#888888' } });
    const upstream = side([PRIMARY, { ...MUTED, name: '--color-subtle' }], { 'a.svelte:1:1': `${C}/subtle` });
    const done = pulledTokens(local, upstream);
    expect(value(done.doc, 'subtle')).toBe('#123456');
    expect(value(done.doc, 'muted')).toBeUndefined();
    expect(done.report).toContain('--color-muted renamed to --color-subtle');
  });

  it('a rename is not guessed when the usages differ: it is a removal plus an addition', () => {
    const local = side([PRIMARY, MUTED], { 'a.svelte:1:1': `${C}/muted` });
    const upstream = side([PRIMARY, { ...MUTED, name: '--color-subtle' }], { 'b.svelte:9:1': `${C}/subtle`, 'a.svelte:1:1': '' });
    const done = pulledTokens(local, upstream);
    expect(done.report).toContain('--color-subtle: added');
    expect(done.report.some((r) => r.startsWith('--color-muted: removed in the code, kept on the canvas as an orphan'))).toBe(true);
  });

  it('a mode chosen on the canvas for a board stays on the board of the same name', () => {
    const board = (doc: MotionDoc, modes?: Record<string, string>) => ({ ...doc, tracks: [{ ...doc.tracks[0], clips: [{ ...newClip({ id: `b${Math.random()}`, from: 0, durationInFrames: 30, component: 'Shape', props: { shape: 'rect' } }), parent: null, name: '/', ...(modes ? { modes } : {}) }] }] }) as MotionDoc;
    const local = side([PRIMARY]);
    const upstream = side([PRIMARY]);
    const done = pulledTokens({ doc: board(local.doc, { [C]: 'Dark' }), map: local.map }, { doc: board(upstream.doc), map: upstream.map });
    expect(done.doc.tracks[0].clips[0].modes).toEqual({ [C]: 'Dark' });
  });

  it('variables made on the canvas and the active mode survive the pull', () => {
    const local = side([PRIMARY]);
    const mine = { ...local.doc, variables: { ...local.doc.variables!, [C]: { ...local.doc.variables![C], active: 'Dark' }, Mine: { modes: ['Default'], vars: { accent: { type: VarType.Colour, values: { Default: '#ff00ff' } } } } } } as MotionDoc;
    const done = pulledTokens({ doc: mine, map: local.map }, side([PRIMARY]));
    expect(done.doc.variables?.Mine?.vars.accent).toBeDefined();
    expect(done.doc.variables?.[C].active).toBe('Dark');
  });
});
