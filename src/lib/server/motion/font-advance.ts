import type { Advance } from '$lib/motion/text-measure';

type ParsedFont = { getAdvanceWidth: (text: string, fontSize: number, options?: { kerning?: boolean }) => number };
type Opentype = { parse: (buffer: ArrayBuffer) => ParsedFont };
type Fetcher = (url: string) => Promise<Response>;

const EM = 1;

async function parsed(fetcher: Fetcher, url: string): Promise<ParsedFont | null> {
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      return null;
    }
    const { default: opentype } = (await import('opentype.js')) as unknown as { default: Opentype };
    return opentype.parse(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export function fontAdvance(fetcher: Fetcher = fetch): (url: string) => Promise<Advance | null> {
  const fonts = new Map<string, Promise<ParsedFont | null>>();
  return async (url) => {
    const font = await (fonts.get(url) ?? fonts.set(url, parsed(fetcher, url)).get(url)!);
    return font ? (run) => font.getAdvanceWidth(run, EM, { kerning: true }) : null;
  };
}
