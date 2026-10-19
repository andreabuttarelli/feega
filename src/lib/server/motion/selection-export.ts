import { zipSync } from 'fflate';
import { Bundle, FILE, bundleOf, exportFiles, type ExportFile, type ExportRow } from '$lib/motion/export-rows';
import { Background, findClip, type MotionDoc } from '$lib/motion/doc';
import { elementName } from '$lib/motion/element-name';

export type Packed = { name: string; mime: string; bytes: Uint8Array };

const ZIP_MIME = 'application/zip';

export async function packExport(files: readonly ExportFile[], draw: (file: ExportFile) => Promise<Buffer>, bundleName: string): Promise<Packed> {
  const drawn: [ExportFile, Uint8Array][] = [];
  for (const file of files) {
    drawn.push([file, new Uint8Array(await draw(file))]);
  }
  if (bundleOf(drawn.length) === Bundle.File) {
    const [[file, bytes]] = drawn;
    return { name: file.name, mime: FILE[file.row.format].mime, bytes };
  }
  return { name: `${bundleName}.zip`, mime: ZIP_MIME, bytes: zipSync(Object.fromEntries(drawn.map(([file, bytes]) => [file.name, bytes]))) };
}

export enum ExportOutcome {
  Done = 'done',
  NotFound = 'frame_not_found',
  NoElement = 'element_not_found'
}

export type SelectionFrame = { name: string; doc: MotionDoc };

export type DrawTarget = { nodeId: string; doc: MotionDoc; elementId?: string };

export type SelectionPorts = {
  read: (nodeId: string) => Promise<SelectionFrame | null>;
  draw: (targets: DrawTarget[], row: ExportRow) => Promise<Buffer>;
  store: (packed: Packed) => Promise<{ asset_id: string; url: string }>;
};

export type ExportTarget = { nodeId: string; elementId?: string };

export type SelectionAsk = { targets: ExportTarget[]; rows: ExportRow[]; name: string };

export type SelectionExported =
  | { outcome: ExportOutcome.Done; asset_id: string; url: string; name: string; files: string[] }
  | { outcome: ExportOutcome.NotFound | ExportOutcome.NoElement; nodeId: string; elementId?: string };

const asDrawn = (doc: MotionDoc, row: ExportRow): MotionDoc => (row.transparent ? { ...doc, background: Background.Transparent } : doc);

const keyOf = (target: ExportTarget) => `${target.nodeId}#${target.elementId ?? ''}`;

export async function exportSelection(ports: SelectionPorts, ask: SelectionAsk): Promise<SelectionExported> {
  const frames = new Map<string, SelectionFrame>();
  for (const target of ask.targets) {
    const frame = frames.get(target.nodeId) ?? (await ports.read(target.nodeId));
    if (!frame) {
      return { outcome: ExportOutcome.NotFound, nodeId: target.nodeId };
    }
    if (target.elementId && !findClip(frame.doc, target.elementId)) {
      return { outcome: ExportOutcome.NoElement, nodeId: target.nodeId, elementId: target.elementId };
    }
    frames.set(target.nodeId, frame);
  }

  const byKey = new Map(ask.targets.map((t) => [keyOf(t), t]));
  const listed = ask.targets.map((t) => {
    const frame = frames.get(t.nodeId)!;
    const clip = t.elementId ? findClip(frame.doc, t.elementId)!.clip : null;
    return { id: keyOf(t), name: frame.name, ...(clip ? { elementId: clip.id, elementName: elementName(clip) } : {}) };
  });
  const files = exportFiles(listed, ask.rows, ask.name);
  const packed = await packExport(
    files,
    (file) =>
      ports.draw(
        file.targets.map((listedTarget) => {
          const target = byKey.get(listedTarget.id)!;
          return { nodeId: target.nodeId, doc: asDrawn(frames.get(target.nodeId)!.doc, file.row), ...(target.elementId ? { elementId: target.elementId } : {}) };
        }),
        file.row
      ),
    ask.name
  );
  const stored = await ports.store(packed);
  return { outcome: ExportOutcome.Done, ...stored, name: packed.name, files: files.map((f) => f.name) };
}
