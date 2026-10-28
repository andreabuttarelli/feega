import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection, createNode, listConnections, listNodes } from '$lib/server/repos/canvas';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { unpackFeega } from '$lib/canvas/feega-file';
import { snapshotSchema } from '$lib/canvas/canvas-version';
import { LOCAL_ORG_ID, LOCAL_USER, openFeegaStore, writeAtomically, type FeegaStore } from './feega-store';
import { orgFontFamilies, storeFontFile } from '$lib/server/motion/font-upload';
import { listOrgFonts } from '$lib/server/repos/org-fonts';

const ORIGIN = 'http://127.0.0.1:5173';
const actor = { kind: 'user' as const, id: null };

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'feega-store-')), 'work.feega');

function scopeOf(store: FeegaStore) {
  return { orgId: LOCAL_ORG_ID, projectId: store.place.projectId, canvasId: store.place.canvasId };
}

async function addText(store: FeegaStore, text: string, x = 0) {
  return createNode(store.db, { ...scopeOf(store), type: 'text', x, y: 0, data: { text }, actor });
}

describe('il file .feega è il database della modalità locale', () => {
  it('un file che non esiste nasce vuoto e viene scritto sul disco', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    await store.flush();

    expect(existsSync(path)).toBe(true);
    expect(await listNodes(store.db, scopeOf(store))).toEqual([]);
  });

  it('nodi, archi e documenti scritti dalla tela sopravvivono alla riapertura', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const a = await addText(first, 'Hero headline');
    const b = await addText(first, 'Call to action', 400);
    await createConnection(first.db, { orgId: LOCAL_ORG_ID, canvasId: first.place.canvasId, sourceNodeId: a.id, targetNodeId: b.id, actor });
    await appendRevision(first.db, { orgId: LOCAL_ORG_ID, nodeId: a.id, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor });
    await first.flush();

    const second = openFeegaStore(path, { origin: ORIGIN });

    expect(second.place).toEqual(first.place);
    expect((await listNodes(second.db, scopeOf(second))).map((n) => n.data.text).sort()).toEqual(['Call to action', 'Hero headline']);
    expect(await listConnections(second.db, scopeOf(second))).toHaveLength(1);
    expect((await readHead(second.db, { orgId: LOCAL_ORG_ID, nodeId: a.id }))?.version).toBe(1);
  });

  it('il file salvato è quello che l’import del cloud accetta', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    await addText(store, 'Pricing');
    await store.flush();

    const opened = unpackFeega(new Uint8Array(readFileSync(path)));

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    expect(snapshotSchema.safeParse(opened.file.canvas).success).toBe(true);
    expect(opened.file.canvas.nodes[0].data).toEqual({ text: 'Pricing' });
  });

  it('un nodo cancellato non torna alla riapertura', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    const node = await addText(store, 'gone');
    await store.db.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('id', node.id);
    await store.flush();

    expect(await listNodes(openFeegaStore(path, { origin: ORIGIN }).db, scopeOf(store))).toEqual([]);
  });

  it('le immagini caricate viaggiano dentro lo zip', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    const stored = `${LOCAL_ORG_ID}/${store.place.projectId}/logo.png`;
    await store.db.storage.from('canvas-assets').upload(stored, new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
    const { data: asset } = await store.db.from('assets').insert({ org_id: LOCAL_ORG_ID, project_id: store.place.projectId, type: 'image', source: 'upload', url: stored, mime_type: 'image/png' }).select('id').single();
    await addText(store, `see ${(asset as { id: string }).id}`);
    await store.flush();

    const reopened = openFeegaStore(path, { origin: ORIGIN });
    const { data } = await reopened.db.storage.from('canvas-assets').download(stored);

    expect(new Uint8Array(await (data as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('ogni scrittura arriva a chi ascolta, con la forma del realtime', async () => {
    const store = openFeegaStore(tempFile(), { origin: ORIGIN });
    const heard: { table: string; eventType: string; id: unknown }[] = [];
    store.subscribe((change) => heard.push({ table: change.table, eventType: change.eventType, id: change.new.id }));

    const node = await addText(store, 'live');

    expect(heard).toContainEqual({ table: 'nodes', eventType: 'INSERT', id: node.id });
  });

  it('un file che non è un .feega viene rifiutato, non sovrascritto', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feega-store-')), 'notes.feega');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, 'not a zip');

    expect(() => openFeegaStore(path, { origin: ORIGIN })).toThrow(/not a .feega file/i);
    expect(readFileSync(path, 'utf8')).toBe('not a zip');
  });
});

describe('scrittura atomica', () => {
  it('scrive su un file temporaneo e poi lo rinomina sopra l’originale', async () => {
    const calls: string[] = [];
    const fs = {
      writeFile: async (path: string) => void calls.push(`write ${path}`),
      rename: async (from: string, to: string) => void calls.push(`rename ${from} -> ${to}`)
    };

    await writeAtomically('/x/work.feega', new Uint8Array([1]), fs);

    expect(calls).toEqual(['write /x/work.feega.tmp', 'rename /x/work.feega.tmp -> /x/work.feega']);
  });

  it('dopo il salvataggio non resta nessun file temporaneo', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    await addText(store, 'x');
    await store.flush();

    expect(readdirSync(join(path, '..'))).toEqual(['work.feega']);
  });

  it('un font caricato sta nel file anche se nessun frame lo usa, e torna alla riapertura', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const bytes = new Uint8Array(readFileSync('static/fonts/fraunces-latin.woff2'));
    const saved = await storeFontFile(first.db, { orgId: LOCAL_ORG_ID, userId: LOCAL_USER.id, name: 'Fraunces.woff2', bytes });
    expect(saved.ok).toBe(true);
    await first.flush();

    const second = openFeegaStore(path, { origin: ORIGIN });
    const families = await orgFontFamilies(second.db, LOCAL_ORG_ID);

    expect(families.map((f) => f.family)).toEqual(['Fraunces']);
    const [font] = await listOrgFonts(second.db, LOCAL_ORG_ID);
    expect(second.blob('canvas-assets', font.path)?.bytes.length).toBe(bytes.length);
  });
});
