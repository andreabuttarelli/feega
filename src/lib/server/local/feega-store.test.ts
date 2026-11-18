import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection, createNode, listConnections, listNodes, moveNode, renameNode } from '$lib/server/repos/canvas';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { unpackFeega } from '$lib/canvas/feega-file';
import { snapshotSchema } from '$lib/canvas/canvas-version';
import { LOCAL_ORG_ID, LOCAL_USER, openFeegaStore, type FeegaStore } from './feega-store';
import { orgFontFamilies, storeFontFile } from '$lib/server/motion/font-upload';
import { listOrgFonts } from '$lib/server/repos/org-fonts';
import { linkStore } from '$lib/server/code-push/link-store';
import { linkSchema } from '$lib/server/code-push/link';
import { listCanvasEvents, recordEvent } from '$lib/server/repos/canvas-events';
import { agentActor, AgentKey } from '$lib/server/repos/actor';
import { MAX_PERSISTED_EVENTS } from './feega-store';

const ORIGIN = 'http://127.0.0.1:5173';
const ZIP_STORED = 0;
const actor = { kind: 'user' as const, id: null };

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'feega-store-')), 'work.feega');

function scopeOf(store: FeegaStore) {
  return { orgId: LOCAL_ORG_ID, projectId: store.place.projectId, canvasId: store.place.canvasId };
}

async function addText(store: FeegaStore, text: string, x = 0) {
  return createNode(store.db, { ...scopeOf(store), type: 'text', x, y: 0, data: { text }, actor });
}

describe('il file .feega è il database della modalità locale', () => {
  it('l’agente scelto per la chat resta nel file e torna alla riapertura', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    expect(first.acpAgent()).toBeNull();

    first.chooseAcpAgent('codex');
    await first.flush();

    expect(openFeegaStore(path, { origin: ORIGIN }).acpAgent()).toBe('codex');
  });

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

  it('un frame di un file aperto ha già il colore della sua pagina, prima che arrivi il documento', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const node = await createNode(first.db, { ...scopeOf(first), type: 'motion', x: 0, y: 0, data: { docHeadRevision: 1, interactive: false }, actor });
    const doc = newMotionDoc(MotionFormat.Square);
    const page = { ...doc, tracks: [{ ...doc.tracks[0], clips: [newClip({ id: 'bg', from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 1, height: 1, fill: '#13111c' } })] }, ...doc.tracks.slice(1)] };
    await appendRevision(first.db, { orgId: LOCAL_ORG_ID, nodeId: node.id, expectedVersion: 0, doc: page, actor });
    await first.db.from('nodes').update({ data: { docHeadRevision: 1, interactive: false } }).eq('id', node.id);
    await first.flush();

    const [opened] = await listNodes(openFeegaStore(path, { origin: ORIGIN }).db, scopeOf(first));

    expect(opened.data.standInFill).toBe('#13111c');
  });

  it.each([
    ['senza tracce', { width: 1440, height: 900 }],
    ['con tracce senza clip', { width: 1440, height: 900, tracks: [{}] }],
    ['con una forma senza props', { width: 1440, height: 900, tracks: [{ clips: [{ id: 'a', component: 'Shape' }] }] }]
  ])('un file con un documento %s si apre, senza colore della pagina', async (_, doc) => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const node = await createNode(first.db, { ...scopeOf(first), type: 'motion', x: 0, y: 0, data: { docHeadRevision: 1, interactive: false }, actor });
    await appendRevision(first.db, { orgId: LOCAL_ORG_ID, nodeId: node.id, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor });
    await first.db.from('motion_revisions').update({ doc }).eq('node_id', node.id);
    await first.db.from('nodes').update({ data: { docHeadRevision: 1, interactive: false } }).eq('id', node.id);
    await first.flush();

    const [opened] = await listNodes(openFeegaStore(path, { origin: ORIGIN }).db, scopeOf(first));

    expect(opened.data).not.toHaveProperty('standInFill');
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

  it('le immagini entrano nello zip così come sono, senza ricomprimerle', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    const stored = `${LOCAL_ORG_ID}/${store.place.projectId}/photo.png`;
    await store.db.storage.from('canvas-assets').upload(stored, new Uint8Array(4096).fill(7), { contentType: 'image/png' });
    const { data: asset } = await store.db.from('assets').insert({ org_id: LOCAL_ORG_ID, project_id: store.place.projectId, type: 'image', source: 'upload', url: stored, mime_type: 'image/png' }).select('id').single();
    await addText(store, `see ${(asset as { id: string }).id}`);
    await store.flush();

    const methods: Record<string, number> = {};
    unzipSync(new Uint8Array(readFileSync(path)), { filter: (f) => ((methods[f.name] = f.compression), false) });

    expect(Object.entries(methods).filter(([name]) => name.startsWith('assets/')).map(([, method]) => method)).toEqual([ZIP_STORED]);
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

describe('i collegamenti al codice stanno nel file .feega', () => {
  it('collegamento e storia del push sopravvivono alla riapertura', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const frame = await addText(first, 'Home');
    const link = linkSchema.parse({ source: 'folder', repo: '/clones/traidue', entryKind: 'page', entry: 'src/routes/+page.svelte', route: '/', baseBranch: 'main', baseSha: 'abc123', files: ['src/app.css'], pushBranch: 'feega/home', pushSha: 'def456', pushParent: 'abc123', pushTouched: ['src/app.css'] });
    const scope = (store: FeegaStore) => ({ orgId: LOCAL_ORG_ID, userId: LOCAL_USER.id, projectId: store.place.projectId });
    await linkStore(first.db, scope(first)).save(frame.id, link);
    await first.flush();

    const second = openFeegaStore(path, { origin: ORIGIN });

    expect(await linkStore(second.db, scope(second)).read(frame.id)).toEqual(link);
  });
});

describe('scrittura atomica', () => {
  it('un salvataggio rimasto a metà da un processo ucciso viene tolto alla riapertura', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    await addText(store, 'x');
    await store.flush();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${path}.saving`, 'half a zip');

    openFeegaStore(path, { origin: ORIGIN });

    expect(readdirSync(join(path, '..'))).toEqual(['work.feega']);
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
  it('la storia dei cambiamenti torna alla riapertura, con chi li ha fatti', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    const node = await addText(store, 'who');
    await recordEvent(store.db, { ...scopeOf(store), kind: 'node.create', nodeId: node.id, after: { type: 'text' }, actor: agentActor(LOCAL_USER.id, AgentKey.Mcp) });
    await store.flush();

    const events = await listCanvasEvents(openFeegaStore(path, { origin: ORIGIN }).db, { orgId: LOCAL_ORG_ID, canvasId: store.place.canvasId });

    expect(events.map((e) => [e.kind, e.actorKind, e.agentKey])).toContainEqual(['node.create', 'agent', 'mcp']);
  });

  it('il file salva solo gli ultimi eventi, i piu recenti', async () => {
    const path = tempFile();
    const store = openFeegaStore(path, { origin: ORIGIN });
    for (let n = 0; n < MAX_PERSISTED_EVENTS + 5; n++) {
      await recordEvent(store.db, { ...scopeOf(store), kind: 'node.update', nodeId: `n${n}`, actor });
    }
    await store.flush();

    const events = await listCanvasEvents(openFeegaStore(path, { origin: ORIGIN }).db, { orgId: LOCAL_ORG_ID, canvasId: store.place.canvasId, limit: MAX_PERSISTED_EVENTS + 10 });

    expect(events).toHaveLength(MAX_PERSISTED_EVENTS);
    expect(events.map((e) => e.nodeId)).toContain(`n${MAX_PERSISTED_EVENTS + 4}`);
    expect(events.map((e) => e.nodeId)).not.toContain('n0');
  });

  it('un file senza eventi si apre ancora', async () => {
    const path = tempFile();
    await openFeegaStore(path, { origin: ORIGIN }).flush();
    const opened = unpackFeega(new Uint8Array(readFileSync(path)));

    expect(opened.ok && opened.file.canvas.events).toEqual([]);
  });
  it('la riapertura non attribuisce a una persona una revisione che nessuno ha fatto ora', async () => {
    const path = tempFile();
    const first = openFeegaStore(path, { origin: ORIGIN });
    const frame = await addText(first, 'frame');
    await appendRevision(first.db, { orgId: LOCAL_ORG_ID, nodeId: frame.id, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor });
    await first.flush();
    const exportedAt = (unpackFeega(new Uint8Array(readFileSync(path))) as { file: { manifest: { exportedAt: string } } }).file.manifest.exportedAt;

    const rows = async () => ((await openFeegaStore(path, { origin: ORIGIN }).db.from('motion_revisions').select('actor_kind, created_at, node_id')).data ?? []) as { actor_kind: string; created_at: string }[];
    const reopened = await rows();
    const again = await rows();

    expect(reopened).toHaveLength(1);
    expect(again).toHaveLength(1);
    expect(reopened[0]).toMatchObject({ actor_kind: 'system', created_at: exportedAt });
  });

  it('rinominare un nodo lascia un evento con chi lo ha fatto', async () => {
    const store = openFeegaStore(tempFile(), { origin: ORIGIN });
    const node = await addText(store, 'name me');
    await renameNode(store.db, { orgId: LOCAL_ORG_ID, nodeId: node.id, name: 'Hero', actor: agentActor(LOCAL_USER.id, AgentKey.Mcp) });

    const events = await listCanvasEvents(store.db, { orgId: LOCAL_ORG_ID, canvasId: store.place.canvasId });

    expect(events[0]).toMatchObject({ kind: 'node.update', nodeId: node.id, actorKind: 'agent', agentKey: 'mcp', after: { displayName: 'Hero' } });
  });

  it('spostare un nodo a mano lascia un evento di chi lo ha fatto, e restare fermi non ne lascia', async () => {
    const store = openFeegaStore(tempFile(), { origin: ORIGIN });
    const node = await addText(store, 'drag me');
    const scope = { orgId: LOCAL_ORG_ID, canvasId: store.place.canvasId };
    const person = { kind: 'user' as const, id: LOCAL_USER.id };

    await moveNode(store.db, { orgId: LOCAL_ORG_ID, nodeId: node.id, x: 40, y: 50, actor: person });
    await moveNode(store.db, { orgId: LOCAL_ORG_ID, nodeId: node.id, x: 40, y: 50, actor: person });
    const moves = (await listCanvasEvents(store.db, scope)).filter((e) => e.kind === 'node.update');

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ nodeId: node.id, actorKind: 'user', before: { position: { x: 0, y: 0 } }, after: { position: { x: 40, y: 50 } } });
  });

});
