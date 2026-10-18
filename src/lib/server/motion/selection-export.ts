import { zipSync } from 'fflate';
import { Bundle, bundleOf, exportFiles, rowSize, type ExportFile, type ExportRow } from '$lib/motion/export-rows';
import { Background, type MotionDoc } from '$lib/motion/doc';
import { stillExport, type StillExport } from '$lib/motion/still-model';

export type Packed = { name: string; mime: string; bytes: Uint8Array };

const ZIP_MIME = 'application/zip';

export async function packExport(files: readonly ExportFile[], draw: (file: ExportFile) => Promise<Buffer>, bundleName: string): Promise<Packed> {
  const drawn: [ExportFile, Uint8Array][] = [];
  for (const file of files) {
    drawn.push([file, new Uint8Array(await draw(file))]);
  }
  if (bundleOf(drawn.length) === Bundle.File) {
    const [[file, bytes]] = drawn;
    return { name: file.name, mime: stillExport(file.row.format, 1).mime, bytes };
  }
  return { name: `${bundleName}.zip`, mime: ZIP_MIME, bytes: zipSync(Object.fromEntries(drawn.map(([file, bytes]) => [file.name, bytes]))) };
}

export enum ExportOutcome {
  Done = 'done',
  NotFound = 'frame_not_found'
}

export type SelectionFrame = { name: string; doc: MotionDoc };

export type SelectionPorts = {
  read: (nodeId: string) => Promise<SelectionFrame | null>;
  draw: (nodeId: string, doc: MotionDoc, spec: StillExport) => Promise<Buffer>;
  store: (packed: Packed) => Promise<{ asset_id: string; url: string }>;
};

export type SelectionAsk = { nodeIds: string[]; rows: ExportRow[]; name: string };

export type SelectionExported = { outcome: ExportOutcome.Done; asset_id: string; url: string; name: string; files: string[] } | { outcome: ExportOutcome.NotFound; nodeId: string };

export function rowSpec(row: ExportRow, doc: MotionDoc): StillExport {
  const { scale } = rowSize(row, doc);
  const base = stillExport(row.format, 1);
  return { ...base, scale, quality: row.quality ?? base.quality, size: (d) => ({ width: Math.round(d.width * scale), height: Math.round(d.height * scale) }) };
}

const asDrawn = (doc: MotionDoc, row: ExportRow): MotionDoc => (row.transparent ? { ...doc, background: Background.Transparent } : doc);

export async function exportSelection(ports: SelectionPorts, ask: SelectionAsk): Promise<SelectionExported> {
  const frames = new Map<string, SelectionFrame>();
  for (const nodeId of ask.nodeIds) {
    const frame = await ports.read(nodeId);
    if (!frame) {
      return { outcome: ExportOutcome.NotFound, nodeId };
    }
    frames.set(nodeId, frame);
  }

  const files = exportFiles(ask.nodeIds.map((id) => ({ id, name: frames.get(id)!.name })), ask.rows);
  const packed = await packExport(
    files,
    (file) => {
      const { doc } = frames.get(file.frameId)!;
      return ports.draw(file.frameId, asDrawn(doc, file.row), rowSpec(file.row, doc));
    },
    ask.name
  );
  const stored = await ports.store(packed);
  return { outcome: ExportOutcome.Done, ...stored, name: packed.name, files: files.map((f) => f.name) };
}
