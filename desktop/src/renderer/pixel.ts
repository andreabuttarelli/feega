const PALETTE: Record<string, string> = {
  '#': '#ff5100',
  o: '#ff8a3d',
  b: '#004dff',
  n: '#0038a8',
  g: '#8a8780',
  w: '#f0eee9'
};

export const PIXELS: Record<string, string[]> = {
  start: ['...#....', '..###...', '.#####..', '#######.', '..o.o...', '.o.o.o..', '........'],
  editing: ['......##', '.....###', '....###.', '...###..', '..###...', '.##o....', '##......'],
  stack: ['..bbbb..', '.b....b.', 'b..oo..b', 'b.oooo.b', 'b..oo..b', '.b....b.', '..bbbb..'],
  folder: ['###.....', '#..####.', '########', '#oooooo#', '#oooooo#', '#oooooo#', '########'],
  help: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...']
};

export const pixelSvg = (rows: string[], size: number) => {
  const width = Math.max(...rows.map((row) => row.length));
  const cells = rows.flatMap((row, y) => [...row].flatMap((char, x) => (PALETTE[char] ? [`<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[char]}"/>`] : [])));
  return `<svg width="${width * size}" height="${rows.length * size}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${cells.join('')}</svg>`;
};
