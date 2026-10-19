import { Drawing, FILE, rowSize, type ExportRow } from '$lib/motion/export-rows';
import { printDocument, svgDocument, type Crop } from '$lib/motion/export-vector';
import { stillSeconds } from '$lib/motion/still';
import type { ExportPage, ExportPort } from './server-frames';
import type { DrawTarget } from './selection-export';

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

const vectorOf = (target: DrawTarget, o: Opened) => o.page.freeze().then((html) => svgDocument(html, target.doc, { scale: o.scale, crop: o.crop ?? undefined }));

const sizeOf = (target: DrawTarget, o: Opened) => ({ width: Math.round((o.crop?.width ?? target.doc.width) * o.scale), height: Math.round((o.crop?.height ?? target.doc.height) * o.scale) });

const DRAW: Record<Drawing, (port: ExportPort, compose: (t: DrawTarget) => Promise<string>, targets: DrawTarget[], row: ExportRow) => Promise<Buffer>> = {
  [Drawing.Raster]: (port, compose, [target], row) => opened(port, compose, target, row, (o) => o.page.shot(FILE[row.format].mime, row.quality ?? FILE[row.format].quality, o.crop)),
  [Drawing.Vector]: async (port, compose, [target], row) => Buffer.from(await opened(port, compose, target, row, (o) => vectorOf(target, o))),
  [Drawing.Pages]: async (port, compose, targets, row) => {
    const pages = [];
    for (const target of targets) {
      pages.push(await opened(port, compose, target, row, async (o) => ({ html: `<!doctype html><html><body style="margin:0">${await vectorOf(target, o)}</body></html>`, ...sizeOf(target, o) })));
    }
    return port.print(printDocument(pages));
  }
};

export function drawTargets(port: ExportPort, compose: (target: DrawTarget) => Promise<string>, targets: DrawTarget[], row: ExportRow): Promise<Buffer> {
  return DRAW[FILE[row.format].drawing](port, compose, targets, row);
}
