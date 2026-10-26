import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { createNode } from '$lib/server/repos/canvas';

process.env.FEEGA_LOCAL_FILE = join(mkdtempSync(join(tmpdir(), 'feega-local-')), 'site.feega');
process.env.HOST = '127.0.0.1';
process.env.PUBLIC_APP_URL = 'http://127.0.0.1:5173';

const { canvasPath, localModeRefusal, localStore, serveLocal } = await import('./local-mode');
const { LOCAL_ORG_ID } = await import('./feega-store');
const { GET: events } = await import('../../../routes/local/events/+server');
const storage = await import('../../../routes/local/storage/[bucket]/[...path]/+server');

const store = localStore()!;
const canvas = canvasPath(store.place);

function eventFor(path: string, init: RequestInit = {}) {
  const url = new URL(`http://127.0.0.1:5173${path}`);
  return { url, request: new Request(url, init), params: {} } as unknown as RequestEvent;
}

async function served(path: string, init: RequestInit = {}) {
  const seen: { authorization: string | null }[] = [];
  const resolve = async (event: RequestEvent) => {
    seen.push({ authorization: event.request.headers.get('authorization') });
    return new Response('resolved');
  };
  try {
    const response = await serveLocal(eventFor(path, init), resolve, store);
    return { status: response.status, body: await response.text(), seen };
  } catch (thrown) {
    const r = thrown as { status: number; location: string };
    return { status: r.status, location: r.location, seen };
  }
}

describe('la guardia: solo localhost', () => {
  it('rifiuta di partire se ascolta su tutte le interfacce', () => {
    expect(localModeRefusal({ FEEGA_LOCAL_FILE: 'a.feega', HOST: '0.0.0.0' })).toMatch(/localhost/);
    expect(localModeRefusal({ FEEGA_LOCAL_FILE: 'a.feega' })).toMatch(/localhost/);
  });

  it('parte su 127.0.0.1, e senza file non interviene', () => {
    expect(localModeRefusal({ FEEGA_LOCAL_FILE: 'a.feega', HOST: '127.0.0.1' })).toBeNull();
    expect(localModeRefusal({ HOST: '0.0.0.0' })).toBeNull();
  });
});

describe('le route della modalità locale', () => {
  it('la radice apre l’unica tela', async () => {
    expect(await served('/')).toMatchObject({ status: 303, location: canvas });
  });

  it('dashboard, login e altri progetti tornano alla tela', async () => {
    for (const path of ['/app', '/app/canvases', '/login', `/p/${crypto.randomUUID()}/c/${crypto.randomUUID()}`]) {
      expect(await served(path)).toMatchObject({ status: 303, location: canvas });
    }
  });

  it('billing, gallery e impostazioni non esistono', async () => {
    for (const path of ['/gallery', '/account', '/admin', '/oauth/authorize']) {
      expect((await served(path)).status).toBe(404);
    }
  });

  it('la tela e le sue sottoroute passano', async () => {
    expect((await served(canvas)).body).toBe('resolved');
    expect((await served(`${canvas}/asset-urls`)).body).toBe('resolved');
  });

  it('l’API riceve il token locale senza login', async () => {
    const answer = await served('/api/v1/projects');
    expect(answer.seen).toEqual([{ authorization: 'Bearer local' }]);
  });

  it('l’API rifiuta un’altra tela', async () => {
    const answer = await served(`/api/v1/projects/${crypto.randomUUID()}/canvases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_id: crypto.randomUUID() }) });
    expect(answer.status).toBe(403);
  });

  it('commenti, condivisione e versioni rispondono con un messaggio chiaro', async () => {
    const answer = await served(`${canvas}?/share_canvas`, { method: 'POST' });
    expect(answer.body).toContain('feega cloud');
    expect(answer.seen).toEqual([]);
  });
});

describe('live: il browser vede le scritture di un agente', () => {
  it('lo stream SSE consegna l’inserimento di un nodo', async () => {
    const response = await events();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const node = await createNode(store.db, { orgId: LOCAL_ORG_ID, projectId: store.place.projectId, canvasId: store.place.canvasId, type: 'text', x: 0, y: 0, data: { text: 'from an agent' }, actor: { kind: 'agent', id: null } });

    let text = '';
    while (!text.includes(node.id)) {
      text += decoder.decode((await reader.read()).value);
    }
    await reader.cancel();

    const line = text.split('\n').find((l) => l.startsWith('data:') && l.includes(node.id))!;
    expect(JSON.parse(line.slice(5))).toMatchObject({ table: 'nodes', eventType: 'INSERT', new: { id: node.id, canvas_id: store.place.canvasId } });
    expect(response.headers.get('content-type')).toBe('text/event-stream');
  });
});

describe('lo storage locale', () => {
  it('un file caricato dal browser si rilegge', async () => {
    const params = { bucket: 'canvas-assets', path: `${LOCAL_ORG_ID}/${store.place.projectId}/a.png` };
    await storage.PUT({ params, request: new Request('http://x', { method: 'PUT', body: new Uint8Array([7, 8]), headers: { 'content-type': 'image/png' } }) } as never);
    const read = await storage.GET({ params } as never);

    expect(read.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(new Uint8Array([7, 8]));
  });
});
