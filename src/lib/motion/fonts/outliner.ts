import type { Advance } from '../text-measure';

export type PathStep = { type: 'M' | 'L' | 'Q' | 'C' | 'Z'; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };

export type Outliner = {
  advance: Advance;
  ascent: number;
  descent: number;
  trace: (char: string, x: number, y: number, size: number) => PathStep[];
};

type OpenFont = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  getAdvanceWidth: (text: string, fontSize: number, options?: { kerning?: boolean }) => number;
  getPath: (text: string, x: number, y: number, fontSize: number) => { commands: PathStep[] };
};

type Opentype = { parse: (buffer: ArrayBuffer) => OpenFont };
type Fetcher = (url: string) => Promise<Response>;

const EM = 1;

export function outlinerOf(font: OpenFont): Outliner {
  return {
    advance: (run) => font.getAdvanceWidth(run, EM, { kerning: true }),
    ascent: font.ascender / font.unitsPerEm,
    descent: -font.descender / font.unitsPerEm,
    trace: (char, x, y, size) => font.getPath(char, x, y, size).commands
  };
}

export async function loadOutliner(url: string, fetcher: Fetcher = fetch): Promise<Outliner | null> {
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      return null;
    }
    const { default: opentype } = (await import('opentype.js')) as unknown as { default: Opentype };
    return outlinerOf(opentype.parse(await response.arrayBuffer()));
  } catch {
    return null;
  }
}
