export const PIXEL_PALETTE: Readonly<Record<string, string>> = {
  '#': '#ff5100',
  o: '#ff8a3d',
  b: '#004dff',
  n: '#0038a8',
  g: '#8a8780',
  w: '#f0eee9'
};

export const PLUGIN_PIXELS: Readonly<Record<string, readonly string[]>> = {
  'mesh-gradient': ['bbbooo##', 'bbboooo#', 'nbbbooo#', 'nnbbooo#', 'nnnbboo#', 'nnnnbboo', 'nnnnnbbo'],
  'object-3d': ['...bb...', '..bbbb..', '.bbbnnb.', 'bbbnnnnb', 'bbnnnnn.', '.bnnnn..', '..nnn...'],
  'lucide': ['###.bbb.', '#o#.bnb.', '###.bbb.', '........', 'bbb.###.', 'bnb.#o#.', 'bbb.###.'],
  'brand-logos': ['..####..', '.######.', '##oo####', '##o#####', '##oo####', '.######.', '..####..'],
  'gradient-presets': ['bbbbbooo', 'bbbbooo#', 'nbbbooo#', 'nnbbooo#', 'nnbboo##', 'nnnboo##', 'nnnnoo##'],
  'phosphor': ['..####..', '.#....#.', '#..oo..#', '#.oooo.#', '#..oo..#', '.#....#.', '..####..'],
  'heroicons': ['..#..#..', '.##..##.', '########', '########', '.######.', '..####..', '...##...'],
  'shadergradient': ['bbbbnnnn', 'bbbooonn', 'bbooo##n', 'boooo###', 'nooo####', 'nnoo####', 'nnnn####']
};

export type PixelCell = { readonly x: number; readonly y: number; readonly fill: string };

export const pixelRowsOf = (icon: string | undefined): readonly string[] | undefined => (icon === undefined ? undefined : PLUGIN_PIXELS[icon]);

export function pixelCells(rows: readonly string[]): readonly PixelCell[] {
  return rows.flatMap((row, y) => [...row].flatMap((ch, x) => (PIXEL_PALETTE[ch] ? [{ x, y, fill: PIXEL_PALETTE[ch] }] : [])));
}
