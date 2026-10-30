import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageSection } from './page-sections';
import { windowed } from './page-window';

const SECTION_ID = 'section:';
const COPY_MARK = '~';

const STACKED: Partial<RestNode> = {
  layoutMode: 'VERTICAL',
  itemSpacing: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  primaryAxisSizingMode: 'FIXED',
  counterAxisSizingMode: 'FIXED'
};

function renamed(n: RestNode, taken: Set<string>, band: number): RestNode {
  const id = taken.has(n.id) ? `${n.id}${COPY_MARK}${band}` : n.id;
  taken.add(id);
  return { ...n, id, ...(n.children ? { children: n.children.map((c) => renamed(c, taken, band)) } : {}) };
}

type Band = { name: string; top: number; bottom: number; kids: RestNode[] };

function filled(bands: Band[]): Band[] {
  const kept: Band[] = [];
  let from: number | null = null;
  for (const band of bands) {
    if (!band.kids.length) {
      from ??= band.top;
      continue;
    }
    kept.push({ ...band, top: from ?? band.top });
    from = null;
  }
  const last = kept.at(-1);
  if (last && from !== null) {
    kept[kept.length - 1] = { ...last, bottom: bands.at(-1)!.bottom };
  }
  return kept;
}

export function sectionFramed(root: RestNode, sections: PageSection[]): RestNode {
  if (!sections.length) {
    return root;
  }

  const page = root.absoluteBoundingBox!;
  const bands = sections.map((section, i): Band => {
    const top = i === 0 ? page.y : section.top;
    const bottom = i === sections.length - 1 ? page.y + page.height : section.bottom;
    const strip = { left: page.x, right: page.x + page.width, top, bottom };
    return { name: section.name, top, bottom, kids: (root.children ?? []).flatMap((c) => windowed(c, strip) ?? []) };
  });
  const kept = filled(bands);
  if (!kept.length) {
    return root;
  }

  const taken = new Set<string>([root.id]);
  const frames = kept.map((band, i): RestNode => ({
    id: `${SECTION_ID}${i + 1}`,
    type: 'FRAME',
    name: band.name,
    absoluteBoundingBox: { x: page.x, y: band.top, width: page.width, height: band.bottom - band.top },
    fills: [],
    clipsContent: false,
    children: band.kids.map((k) => renamed(k, taken, i + 1))
  }));
  return { ...root, ...STACKED, children: frames };
}
