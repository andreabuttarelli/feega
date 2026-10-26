const DIGITS = 100;

const COMMANDS: Record<number, { letter: string; floats: number }> = {
  0: { letter: 'Z', floats: 0 },
  1: { letter: 'M', floats: 2 },
  2: { letter: 'L', floats: 2 },
  3: { letter: 'Q', floats: 4 },
  4: { letter: 'C', floats: 6 }
};

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

export function geometryPath(blob: Uint8Array): string {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const parts: string[] = [];
  let at = 0;
  while (at < blob.length) {
    const command = COMMANDS[blob[at]];
    if (!command || at + 1 + command.floats * 4 > blob.length) {
      return '';
    }
    const values = Array.from({ length: command.floats }, (_, i) => round(view.getFloat32(at + 1 + i * 4, true)));
    parts.push(`${command.letter}${values.join(' ')}`);
    at += 1 + command.floats * 4;
  }
  return parts.join(' ');
}
