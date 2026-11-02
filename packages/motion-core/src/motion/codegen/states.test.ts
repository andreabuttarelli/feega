import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '../doc';
import { ElementState, statesSchema } from '../states/model';
import { Ease } from '../design';
import { CodeTarget, exportCode, type CodeExport } from './index';
import { absoluteDoc } from './fixtures/small';
import { landingDoc } from './fixtures/landing';

const withStates = (doc: MotionDoc, clipId: string, rows: unknown): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, states: statesSchema.parse(rows) } : c)) }))
});

const css = (out: CodeExport) => out.files.filter((f) => f.path.endsWith('.css') || f.path.endsWith('.svelte')).map((f) => f.content).join('\n');

const badge = () =>
  withStates(absoluteDoc(), 'badge', [
    { state: ElementState.Hover, overrides: { opacity: 0.6, fill: '#ff0000', scale: 1.04 }, transition: { easing: Ease.Enter, durationMs: 250 } },
    { state: ElementState.Pressed, overrides: { scale: 0.96 }, transition: { easing: Ease.Linear, durationMs: 80 } }
  ]);

describe('element states in exported code', () => {
  it('HTML plays the hover row on :hover with its curve and duration', () => {
    const out = css(exportCode(badge(), { name: 'Poster', target: CodeTarget.Html }));

    expect(out).toMatch(/\.badge:hover \{\n {2}opacity: 0\.6;\n {2}scale: 1\.04;\n {2}background-color: #ff0000;\n {2}transition: opacity 250ms cubic-bezier\(0\.16, 1, 0\.3, 1\), scale 250ms cubic-bezier\(0\.16, 1, 0\.3, 1\), background-color 250ms cubic-bezier\(0\.16, 1, 0\.3, 1\);\n\}/);
    expect(out).toContain('.badge:active {');
  });

  it('the base rule carries the transition back to default', () => {
    expect(css(exportCode(badge(), { name: 'Poster', target: CodeTarget.Html }))).toMatch(/\.badge \{\n {2}transition: opacity 250ms/);
  });

  it('a text layer changes its colour, not its background', () => {
    const doc = withStates(absoluteDoc(), 'caption', [{ state: ElementState.Hover, overrides: { fill: '#00ff00' } }]);

    expect(css(exportCode(doc, { name: 'Poster', target: CodeTarget.Html }))).toMatch(/\.caption:hover \{\n {2}color: #00ff00;/);
  });

  it('React prefixes the state classes with hover: and active:', () => {
    const page = exportCode(badge(), { name: 'Poster' }).files.find((f) => f.path === 'src/pages/Poster.tsx')!.content;

    expect(page).toContain('hover:opacity-');
    expect(page).toContain('active:');
    expect(page).toMatch(/\[transition:opacity_250ms_cubic-bezier\(0\.16,_?1,_?0\.3,_?1\)/);
  });

  it('Svelte scopes the same rules in its style tag', () => {
    expect(css(exportCode(badge(), { name: 'Poster', target: CodeTarget.Svelte }))).toContain('.badge:hover {');
  });
});

const checkHovered = (): MotionDoc => {
  const doc = landingDoc();
  const comp = doc.comps['c-check'];
  const [root] = comp.tracks.flatMap((t) => t.clips);
  const rows = statesSchema.parse([{ state: ElementState.Hover, overrides: { opacity: 0.5 } }]);
  const tracks = comp.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === root.id ? { ...c, states: rows } : c)) }));
  return { ...doc, comps: { ...doc.comps, 'c-check': { ...comp, tracks } } };
};

describe('element states on an instance nested inside another component', () => {
  const all = (out: CodeExport) => out.files.map((f) => f.content).join('\n');

  it.each([CodeTarget.Html, CodeTarget.Svelte])('%s writes the inner hover rule', (target) => {
    expect(all(exportCode(checkHovered(), { name: 'Landing', target }))).toMatch(/\.[\w-]+:hover \{\n\s*opacity: 0\.5;/);
  });

  it('React writes the hover class on the inner component', () => {
    expect(all(exportCode(checkHovered(), { name: 'Landing' }))).toContain('hover:opacity-');
  });
});
