const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;
const REMOTE = /^https:\/\//;
const INLINE = /^data:image\//;
const INLINE_MAX_CHARS = 64_000;

function durable(url: string, publicBase: string | undefined): string | null {
  if (REMOTE.test(url) || (INLINE.test(url) && url.length <= INLINE_MAX_CHARS)) {
    return url;
  }
  const local = LOCAL.exec(url);
  return local && publicBase ? `${publicBase}${url.slice(local[0].length)}` : null;
}

export function durableImages(refs: Record<string, string>, publicBase: string | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(refs).flatMap(([key, url]) => {
    const kept = durable(url, publicBase);
    return kept ? [[key, kept]] : [];
  }));
}

const IMAGE_PLACEHOLDER = '#d9d9d9';

type Painted = { props: { fills?: { type?: string; color?: string }[] } };

type Tracked = { tracks: { clips: unknown[] }[] };

const clipsOf = (doc: Tracked & { comps: Record<string, Tracked> }) => [doc, ...Object.values(doc.comps)].flatMap((d) => d.tracks.flatMap((t) => t.clips as Painted[]));

export const showsImagePlaceholder = (doc: Tracked & { comps: Record<string, Tracked> }) => clipsOf(doc).some((c) => (c.props.fills ?? []).some((f) => f.type === 'solid' && f.color === IMAGE_PLACEHOLDER));
