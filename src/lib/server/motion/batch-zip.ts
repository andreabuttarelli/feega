import { Zip, ZipPassThrough } from 'fflate';
import type { BatchView } from './render-run';

export type ZipSource = { path: (assetId: string) => Promise<string | null>; bytes: (path: string) => Promise<Uint8Array> };

const extOf = (path: string) => path.slice(path.lastIndexOf('.') + 1);

export function batchZip(view: BatchView, source: ZipSource): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) {
          controller.close();
        }
      });

      for (const row of view.rows) {
        const path = row.assetId ? await source.path(row.assetId) : null;
        if (!path) {
          continue;
        }
        const entry = new ZipPassThrough(`${row.name}.${extOf(path)}`);
        zip.add(entry);
        entry.push(await source.bytes(path), true);
      }
      zip.end();
    }
  });
}
