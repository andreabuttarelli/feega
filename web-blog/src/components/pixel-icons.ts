export type IconName = 'note' | 'tip' | 'warn' | 'check' | 'source';

export const ICONS: Record<IconName, readonly string[]> = {
  note: ['..#####..', '.#######.', '##.###.##', '#########', '####.####', '####.####', '.#######.', '..#####..'],
  tip: ['...ooo...', '..ooooo..', '.ooooooo.', '.ooooooo.', '..ooooo..', '...ggg...', '...ggg...', '....g....'],
  warn: ['....#....', '...###...', '...###...', '..##.##..', '..##.##..', '.#######.', '.##.#.##.', '#########'],
  check: ['.........', '.......##', '......##.', '#....##..', '##..##...', '.####....', '..##.....', '.........'],
  source: ['bbbbbbbbb', 'bnnnnnnnb', 'bnwwnwwnb', 'bnnnnnnnb', 'bnwwwnnnb', 'bnnnnnnnb', 'bnwwnwwnb', 'bbbbbbbbb']
};
