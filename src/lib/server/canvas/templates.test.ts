import { describe, expect, it } from 'vitest';
import { insertTemplate } from './templates';
import { fakeDb } from '$lib/server/db/fake-db';
import { CANVAS_TEMPLATES } from '$lib/canvas/templates';

const scope = { orgId: 'org', projectId: 'project', canvasId: 'canvas', actor: { kind: 'user' as const, id: 'user' } };

describe('inserire un template sulla tela', () => {
  it('scrive ogni nodo e ogni arco del template nella tela di chi lo chiede', async () => {
    const [template] = CANVAS_TEMPLATES;
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const out = await insertTemplate(fake.db, { ...scope, templateId: template.id, at: { x: 0, y: 0 } });

    expect(out?.nodes).toHaveLength(template.nodes.length);
    expect(out?.connections).toHaveLength(template.edges.length);
    const nodeInserts = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert');
    expect(nodeInserts[0].payload).toMatchObject({ org_id: 'org', canvas_id: 'canvas', type: template.nodes[0].type });
    const edgeInserts = fake.calls.filter((c) => c.table === 'nodes_connections' && c.op === 'insert');
    expect(edgeInserts[0].payload).toMatchObject({ target_handle: template.edges[0].handle });
  });

  it('un id sconosciuto non scrive niente', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const out = await insertTemplate(fake.db, { ...scope, templateId: 'non-esiste', at: { x: 0, y: 0 } });

    expect(out).toBeNull();
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
