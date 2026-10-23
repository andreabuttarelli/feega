import { Drawing, FILE, rowSize, type ExportRow } from '$lib/motion/export-rows';
import { printDocument, type Crop } from '$lib/motion/export-vector';
import { boundsOfClips, svgOf } from '$lib/motion/export-svg';
import type { DisplayList } from '$lib/motion/gpu-full/display-list';
import { ancestorsOf } from '$lib/motion/parent';
import type { MotionDoc } from '$lib/motion/doc';
import { stillSeconds } from '$lib/motion/still';
import type { ExportPage, ExportPort } from './server-frames';
import type { DrawTarget, Drawn } from './selection-export';

type Opened = { page: ExportPage; crop: Crop | null; scale: number };

async function opened<T>(port: ExportPort, compose: (target: DrawTarget) => Promise<string>, target: DrawTarget, row: ExportRow, use: (o: Opened) => Promise<T>): Promise<T> {
  const { doc } = target;
  const { scale } = rowSize(row, doc);
  const page = await port.open({ width: doc.width, height: doc.height, scale });
  try {
    await page.load(await compose(target));
    await page.seek(stillSeconds(doc) ?? 0);
    const crop = target.elementId ? await page.boxOf(target.elementId) : null;
    return await use({ page, crop, scale });
  } finally {
    await page.close();
  }
}

export type VectorPort = (target: DrawTarget) => Promise<{ list: DisplayList; images: ReadonlyMap<string, string> }>;

export type DrawPorts = { port: ExportPort; compose: (target: DrawTarget) => Promise<string>; vector: VectorPort };

type Vectored = { svg: string; skipped: string[]; width: number; height: number };

const clipsUnder = (doc: MotionDoc, elementId: string) => new Set([elementId, ...doc.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => ancestorsOf(doc, id).includes(elementId))]);

async function vectored(vector: VectorPort, target: DrawTarget, row: ExportRow): Promise<Vectored> {
  const { list, images } = await vector(target);
  const { scale } = rowSize(row, target.doc);
  const crop = target.elementId ? boundsOfClips(list, clipsUnder(target.doc, target.elementId)) : null;
  const box = crop ?? { left: 0, top: 0, width: target.doc.width, height: target.doc.height };
  const { svg, skipped } = svgOf(list, { scale, crop: crop ?? undefined, images });
  return { svg, skipped, width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
}

const DRAW: Record<Drawing, (ports: DrawPorts, targets: DrawTarget[], row: ExportRow) => Promise<Drawn>> = {
  [Drawing.Raster]: async ({ port, compose }, [target], row) => ({ bytes: await opened(port, compose, target, row, (o) => o.page.shot(FILE[row.format].mime, row.quality ?? FILE[row.format].quality, o.crop)), skipped: [] }),
  [Drawing.Vector]: async ({ vector }, [target], row) => {
    const { svg, skipped } = await vectored(vector, target, row);
    return { bytes: Buffer.from(svg), skipped };
  },
  [Drawing.Pages]: async ({ port, vector }, targets, row) => {
    const pages = [];
    const skipped = new Set<string>();
    for (const target of targets) {
      const page = await vectored(vector, target, row);
      page.skipped.forEach((s) => skipped.add(s));
      pages.push({ html: `<!doctype html><html><body style="margin:0">${page.svg}</body></html>`, width: page.width, height: page.height });
    }
    return { bytes: await port.print(printDocument(pages)), skipped: [...skipped] };
  }
};

export function drawTargets(ports: DrawPorts, targets: DrawTarget[], row: ExportRow): Promise<Drawn> {
  return DRAW[FILE[row.format].drawing](ports, targets, row);
}
