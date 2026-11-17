import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packFeega, unpackFeega, FEEGA_VERSION, type FeegaAsset, type FeegaManifest } from '$lib/canvas/feega-file';
import { createPacker, type PackJob } from './feega-packer';

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'feega-pack-')), 'work.feega');

const manifest: FeegaManifest = { format: 'feega', version: FEEGA_VERSION, exportedAt: '2026-11-17T00:00:00.000Z', canvasName: 'Work', source: { projectId: crypto.randomUUID(), canvasId: crypto.randomUUID() } };

const imageRow = (id: string, file: string): FeegaAsset => ({ id, type: 'image', mimeType: 'image/png', width: 10, height: 10, durationS: null, content: null, url: null, file });

function jobWith(bytes: Uint8Array, nodeText = 'Hero'): PackJob {
  const used = crypto.randomUUID();
  return {
    manifest,
    body: { nodes: [{ id: crypto.randomUUID(), type: 'text', displayName: null, position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, data: { text: nodeText, image: used } }], connections: [], heads: { [crypto.randomUUID()]: { version: 3, doc: { tracks: [{ id: 'v1', clips: [] }], note: 'a "quoted" doc' } } } },
    assets: [
      { row: imageRow(used, 'assets/used.png'), always: false, bytes },
      { row: imageRow(crypto.randomUUID(), 'assets/unused.png'), always: false, bytes: new Uint8Array([9]) }
    ]
  };
}

describe('il salvataggio della modalità locale impacchetta fuori dal thread principale', () => {
  it('un file scritto dal packer si apre con il lettore di oggi, con le immagini intatte', async () => {
    const path = tempFile();
    const bytes = new Uint8Array(randomBytes(64 * 1024));
    const packer = createPacker();

    const job = jobWith(bytes);
    await packer.write(path, job);
    const opened = unpackFeega(new Uint8Array(readFileSync(path)));
    await packer.stop();

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    expect(opened.file.canvas.nodes[0].data.text).toBe('Hero');
    expect(opened.file.canvas.heads).toEqual(job.body.heads);
    expect(opened.file.canvas.assets.map((a) => a.file)).toEqual(['assets/used.png']);
    expect(opened.blobs.get('assets/used.png')).toEqual(bytes);
  });

  it('un file scritto dal pack di prima si riscrive dal packer e torna uguale', async () => {
    const path = tempFile();
    const bytes = new Uint8Array(randomBytes(1024));
    const job = jobWith(bytes);
    const before = packFeega({ manifest: job.manifest, canvas: { ...job.body, assets: [job.assets[0].row] } }, new Map([['assets/used.png', bytes]]));
    const old = unpackFeega(before);
    const packer = createPacker();

    await packer.write(path, jobWith(bytes));
    const now = unpackFeega(new Uint8Array(readFileSync(path)));
    await packer.stop();

    expect(old.ok && now.ok).toBe(true);
    if (!old.ok || !now.ok) {
      return;
    }
    expect([...now.blobs.values()]).toEqual([...old.blobs.values()]);
  });

  it('un salvataggio interrotto a metà lascia il file di prima intatto e nessun avanzo', async () => {
    const path = tempFile();
    const packer = createPacker();
    await packer.write(path, jobWith(new Uint8Array([1, 2, 3]), 'before'));
    const before = readFileSync(path);

    const big = packer.write(path, jobWith(new Uint8Array(randomBytes(64 * 1024 * 1024)), 'after'));
    await packer.stop();

    await expect(big).rejects.toThrow();
    expect(readFileSync(path)).toEqual(before);
    expect(readdirSync(join(path, '..')).filter((f) => f !== 'work.feega.saving')).toEqual(['work.feega']);
  });

  it('un’immagine che non è cambiata non viene ricalcolata al salvataggio dopo', async () => {
    const path = tempFile();
    const bytes = new Uint8Array(randomBytes(4096));
    const job = jobWith(bytes);
    const packer = createPacker();

    const first = await packer.write(path, job);
    const second = await packer.write(path, { ...job, body: { ...job.body, connections: [] } });
    await packer.stop();

    expect(first.hashed).toBe(1);
    expect(second.hashed).toBe(0);
  });

  it('the canvas history written beside the frames comes back as it was', async () => {
    const path = tempFile();
    const job = jobWith(new Uint8Array([1]));
    const events = [{ id: 1, kind: 'node.create', node_id: 'n1', actor_kind: 'user' }];
    const packer = createPacker();

    await packer.write(path, { ...job, body: { ...job.body, events } });
    const opened = unpackFeega(new Uint8Array(readFileSync(path)));
    await packer.stop();

    expect(opened.ok && opened.file.canvas.events).toEqual(events);
  });
});
