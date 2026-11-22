export enum PixelIcon {
  Start = 'start',
  Editing = 'editing',
  Stack = 'stack',
  Help = 'help'
}

export const PIXEL_PALETTE: Readonly<Record<string, string>> = {
  '#': '#ff5100',
  o: '#ff8a3d',
  b: '#004dff',
  n: '#0038a8',
  g: '#8a8780',
  w: '#f0eee9'
};

export const PIXEL_ROWS: Readonly<Record<PixelIcon, readonly string[]>> = {
  [PixelIcon.Start]: ['...#....', '..###...', '.#####..', '#######.', '..o.o...', '.o.o.o..', '........'],
  [PixelIcon.Editing]: ['......##', '.....###', '....###.', '...###..', '..###...', '.##o....', '##......'],
  [PixelIcon.Stack]: ['..bbbb..', '.b....b.', 'b..oo..b', 'b.oooo.b', 'b..oo..b', '.b....b.', '..bbbb..'],
  [PixelIcon.Help]: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...']
};

export type PixelCell = { readonly x: number; readonly y: number; readonly fill: string };

export function pixelCells(rows: readonly string[]): readonly PixelCell[] {
  return rows.flatMap((row, y) => [...row].flatMap((ch, x) => (PIXEL_PALETTE[ch] ? [{ x, y, fill: PIXEL_PALETTE[ch] }] : [])));
}
