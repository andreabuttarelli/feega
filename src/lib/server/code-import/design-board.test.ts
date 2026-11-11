import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { codePlan } from './code-doc';
import { parseSheets, readSheets } from './css-tokens';
import { tokenSetOf, variablesOf } from './design-tokens';
import { boardBound, designBoard, DESIGN_BOARD } from './design-board';
import { setActiveMode, setCollection } from '$lib/motion/variables';

let ids = 0;
const nid = () => `b${++ids}`;

async function board(name: string) {
  const made = variablesOf(tokenSetOf(parseSheets(await readSheets(fixture(name)))), 'traidue.com', { active: 'Light' });
  const tree = designBoard(made.variables);
  const doc = boardBound({ ...codePlan(tree, [], nid)!.plan.items[0].doc, variables: made.variables });
  return { made, tree, doc };
}

const clips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);
const texts = (doc: MotionDoc) => clips(doc).flatMap((c) => (typeof c.props.text === 'string' ? [c.props.text] : []));
const swatch = (doc: MotionDoc, key: string) => clips(doc).find((c) => c.bind?.fill === key)!;

describe('designBoard', () => {
  it('è una tavola col suo nome, con un campione per colore, i nomi del repo e i valori di ogni modo', async () => {
    const { tree, doc } = await board('tailwind4');

    expect(tree.root.name).toBe(DESIGN_BOARD);
    expect(texts(doc)).toEqual(expect.arrayContaining(['Colors', 'primary', 'Light #111111 · Dark #f0f0f0', 'Radius', 'card', '12px', 'Spacing', 'gutter', '24px', 'Type', 'sans']));
    expect(swatch(doc, 'traidue Colors/primary').props.fill).toBe('#111111');
  });

  it('i campioni sono legati: una variabile cambiata, o il modo, li ricolora', async () => {
    const { doc } = await board('tailwind4');

    const dark = setActiveMode(doc, 'traidue Colors', 'Dark');
    expect(dark.ok && swatch(dark.doc, 'traidue Colors/primary').props.fill).toBe('#f0f0f0');

    const colors = doc.variables!['traidue Colors'];
    const recoloured = setCollection(doc, 'traidue Colors', { ...colors, vars: { ...colors.vars, primary: { ...colors.vars.primary, values: { Light: '#ff0066', Dark: '#f0f0f0' } } } });
    expect(recoloured.ok && swatch(recoloured.doc, 'traidue Colors/primary').props.fill).toBe('#ff0066');
  });

  it('un raggio è un quadrato arrotondato legato alla sua variabile', async () => {
    const { doc } = await board('tailwind4');

    expect(clips(doc).some((c) => c.bind?.radius === 'traidue Radius/card')).toBe(true);
  });

  it('un alias mostra il suo bersaglio', async () => {
    const { doc } = await board('shadcn');

    expect(texts(doc)).toContain('→ Palette/primary');
  });
});
