export enum PixelIcon {
  Start = 'start',
  Editing = 'editing',
  Stack = 'stack',
  Help = 'help',
  Plugin = 'plugin',
  Templates = 'templates',
  MeshGradient = 'mesh-gradient',
  Object3d = 'object-3d',
  Lucide = 'lucide',
  BrandLogos = 'brand-logos',
  Digit1 = 'digit-1',
  Digit2 = 'digit-2',
  Digit3 = 'digit-3',
  SignIn = 'sign-in',
  Support = 'support',
  Star = 'star',
  X = 'x',
  Discord = 'discord',
  Coffee = 'coffee',
  Share = 'share',
  Cursor = 'cursor',
  Screens = 'screens',
  Components = 'components',
  Grid = 'grid',
  Sun = 'sun',
  History = 'history'
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
  [PixelIcon.Help]: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...'],
  [PixelIcon.Plugin]: ['..b..b..', '..b..b..', '.######.', '.#oooo#.', '.#oooo#.', '..####..', '...##...'],
  [PixelIcon.Templates]: ['########', '#oooooo#', '########', '#.#bbb#.', '#.#bbb#.', '#.#####.', '........'],
  [PixelIcon.MeshGradient]: ['bbbooo##', 'bbboooo#', 'nbbbooo#', 'nnbbooo#', 'nnnbboo#', 'nnnnbboo', 'nnnnnbbo'],
  [PixelIcon.Object3d]: ['...bb...', '..bbbb..', '.bbbnnb.', 'bbbnnnnb', 'bbnnnnn.', '.bnnnn..', '..nnn...'],
  [PixelIcon.Lucide]: ['###.bbb.', '#o#.bnb.', '###.bbb.', '........', 'bbb.###.', 'bnb.#o#.', 'bbb.###.'],
  [PixelIcon.BrandLogos]: ['..####..', '.######.', '##oo####', '##o#####', '##oo####', '.######.', '..####..'],
  [PixelIcon.Digit1]: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  [PixelIcon.Digit2]: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  [PixelIcon.Digit3]: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  [PixelIcon.SignIn]: ['..oooo..', '.oooooo.', '.oooooo.', '..oooo..', '........', '.######.', '########'],
  [PixelIcon.Support]: ['.##..##.', '#o####.#', '########', '########', '.######.', '..####..', '...##...'],
  [PixelIcon.Star]: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '.#....#.'],
  [PixelIcon.X]: ['ww...ww.', '.ww.ww..', '..www...', '...w....', '..www...', '.ww.ww..', 'ww...ww.'],
  [PixelIcon.Discord]: ['.bbbbbb.', 'bbbbbbbb', 'bwwbbwwb', 'bwwbbwwb', 'bbbbbbbb', '.bb..bb.', '........'],
  [PixelIcon.Coffee]: ['..g.g...', '........', '.######.', '.#####.#', '.#####.#', '..####..', '.######.'],
  [PixelIcon.Share]: ['...b....', '..bbb...', '.b.b.b..', '...b....', 'b..b..b.', 'b.....b.', 'bbbbbbb.'],
  [PixelIcon.Cursor]: ['#.......', '##......', '###.....', '####....', '#####...', '###.....', '#.##....', '...##o..'],
  [PixelIcon.Screens]: ['######...', '#bbbb#...', '#bbbb#.##', '#bbbb#.#o', '######.##', '..##.....', '.####....'],
  [PixelIcon.Components]: ['..bbbbbb', '..b....b', '####...b', '#oo#...b', '#oo#bbbb', '#oo#....', '####....'],
  [PixelIcon.Grid]: ['g..g..g.', '........', '........', 'g.oo..g.', '..oo....', '........', 'g..g..g.'],
  [PixelIcon.Sun]: ['...#....', '.#.#.#..', '..ooo...', '##ooo##.', '..ooo...', '.#.#.#..', '...#....'],
  [PixelIcon.History]: ['..#.....', '.##.....', '#######.', '.##...#.', '..#....#', '.......#', '..#####.']
};

export type PixelCell = { readonly x: number; readonly y: number; readonly fill: string };

export function pixelCells(rows: readonly string[]): readonly PixelCell[] {
  return rows.flatMap((row, y) => [...row].flatMap((ch, x) => (PIXEL_PALETTE[ch] ? [{ x, y, fill: PIXEL_PALETTE[ch] }] : [])));
}

export function pixelSvg(icon: PixelIcon, size = 4): string {
  const rows = PIXEL_ROWS[icon];
  const width = Math.max(...rows.map((r) => r.length));
  const rects = pixelCells(rows)
    .map((c) => `<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${c.fill}"/>`)
    .join('');

  return `<svg class="pixel" width="${width * size}" height="${rows.length * size}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
