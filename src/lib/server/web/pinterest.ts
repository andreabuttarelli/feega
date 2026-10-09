export type PinterestGet = (path: string) => Promise<unknown>;

export type PinImage = { url: string; width: number | null; height: number | null };

export type Pin = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: PinImage | null;
  colour: string | null;
  link: string | null;
  pinner: string | null;
  board: { name: string; url: string } | null;
};

export type PinsFound = { ok: true; pins: Pin[]; requests: number } | { ok: false; error: string; requests: number };

export const PINTEREST_MAX_PINS = 25;
const MAX_PAGES = 2;
const ORIGIN = 'https://www.pinterest.com';
const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]+$|^pin\.it$/i;
const LARGEST_FIRST = ['orig', '736x', '564x', '474x', '236x'];

type Raw = Record<string, unknown>;
type Page = { pins?: Raw[]; cursor?: string | null };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const first = (...values: unknown[]) => values.map(text).find((v) => v !== null) ?? null;
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Raw) : {});
const pinUrl = (id: string) => `${ORIGIN}/pin/${id}/`;

function imageOf(spec: unknown): PinImage | null {
  const s = obj(spec);
  const url = text(s.url);
  return url ? { url, width: typeof s.width === 'number' ? s.width : null, height: typeof s.height === 'number' ? s.height : null } : null;
}

function largest(lookup: (size: string) => unknown): PinImage | null {
  return LARGEST_FIRST.map((size) => imageOf(lookup(size))).find((i) => i !== null) ?? null;
}

function boardOf(raw: unknown): Pin['board'] {
  const b = obj(raw);
  const name = text(b.name);
  const path = text(b.url);
  return name && path ? { name, url: new URL(path, ORIGIN).href } : null;
}

function colourInBoard(raw: Raw, image236: string | null): string | null {
  const covers = obj(obj(raw.board).images)['236x'];
  const match = Array.isArray(covers) ? covers.map(obj).find((c) => c.url === image236) : undefined;
  return match ? text(match.dominant_color) : null;
}

function listedPin(raw: Raw): Pin {
  const id = String(raw.id);
  const images = obj(raw.images);
  return {
    id,
    url: pinUrl(id),
    title: first(raw.title, raw.grid_title),
    description: first(raw.description, raw.auto_alt_text, raw.seo_alt_text, raw.alt_text),
    image: largest((size) => images[size]),
    colour: text(raw.dominant_color) ?? colourInBoard(raw, text(obj(images['236x']).url)),
    link: text(raw.link),
    pinner: text(obj(raw.pinner).username),
    board: boardOf(raw.board)
  };
}

function pagePin(raw: Raw): Pin {
  const id = String(raw.entityId ?? raw.id);
  return {
    id,
    url: pinUrl(id),
    title: first(raw.title, raw.gridTitle, raw.closeupUnifiedTitle),
    description: first(raw.description, raw.seoDescription),
    image: largest((size) => raw[`images_${size}`]),
    colour: text(raw.dominantColor),
    link: text(raw.link),
    pinner: text(obj(raw.pinner).username),
    board: boardOf(raw.board)
  };
}

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function onPinterest(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PINTEREST_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

const notPinterest = (url: string): PinsFound => ({ ok: false, error: `not a Pinterest url: ${url}`, requests: 0 });

async function pages(get: PinterestGet, what: string, path: string, limit: number): Promise<PinsFound> {
  const wanted = Math.min(Math.max(limit, 1), PINTEREST_MAX_PINS);
  const pins: Pin[] = [];
  let cursor: string | null = null;
  let requests = 0;
  try {
    do {
      requests++;
      const page = obj(await get(cursor ? `${path}&cursor=${encodeURIComponent(cursor)}` : path)) as Page;
      pins.push(...(page.pins ?? []).filter((p) => p && p.id).map(listedPin));
      cursor = text(page.cursor);
    } while (pins.length < wanted && cursor && requests < MAX_PAGES);
  } catch (e) {
    return { ok: false, error: `pinterest ${what} failed: ${errorOf(e)}`, requests };
  }
  return { ok: true, pins: pins.slice(0, wanted), requests };
}

export function pinterestSearch(get: PinterestGet, query: string, limit: number): Promise<PinsFound> {
  return pages(get, 'search', `/v1/pinterest/search?${new URLSearchParams({ query })}`, limit);
}

export function pinterestBoard(get: PinterestGet, url: string, limit: number): Promise<PinsFound> {
  return onPinterest(url) ? pages(get, 'board', `/v1/pinterest/board?${new URLSearchParams({ url })}`, limit) : Promise.resolve(notPinterest(url));
}

export async function pinterestPin(get: PinterestGet, url: string): Promise<PinsFound> {
  if (!onPinterest(url)) {
    return notPinterest(url);
  }
  try {
    const raw = obj(await get(`/v1/pinterest/pin?${new URLSearchParams({ url })}`));
    return { ok: true, pins: [pagePin(raw)], requests: 1 };
  } catch (e) {
    return { ok: false, error: `pinterest pin failed: ${errorOf(e)}`, requests: 1 };
  }
}
