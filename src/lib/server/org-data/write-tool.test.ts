import { describe, expect, it, vi } from 'vitest';
import { createOrgWriteTools } from './write-tool';

vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));
vi.mock('$lib/server/canvas-catalogue', () => {
  const offer = (ids: string[]) => ({ choices: ids.map((id) => ({ id })), recommended: ids.slice(0, 1).map((id) => ({ tier: 'balanced', id })), synced: true });
  return { canvasModelCatalogue: async () => ({ text: offer(['txt-a']), image: offer(['img-a']), video: offer(['vid-a']) }) };
});
vi.mock('./presence', () => ({ announcePresence: vi.fn().mockResolvedValue(undefined) }));

type Call = { op: string; table: string; filters: string[][]; values?: Record<string, unknown> };

function fakeAuthority(opts: {
  countRows?: Array<Record<string, unknown>>;
  count?: number;
  writeRows?: Array<Record<string, unknown>>;
  error?: { code: string; message: string; details?: string | null };
  /** Le righe che `nodes` ha GIÀ, lette prima di un update per validare la fusione. */
  currentRows?: Array<Record<string, unknown>>;
}) {
  const calls: Call[] = [];

  const countBuilder = (table: string) => {
    const rec: Call = { op: 'count', table, filters: [] };
    calls.push(rec);
    const b = {
      filter: (c: string, _op: string, v: string) => {
        rec.filters.push([c, v]);
        return b;
      },
      not: (c: string, _op: string, v: string) => {
        rec.filters.push([`not:${c}`, v]);
        return b;
      },
      limit: () => b,
      abortSignal: () => Promise.resolve({ count: opts.count ?? (opts.countRows ?? []).length, error: null })
    };
    return b;
  };

  const plainSelectBuilder = (table: string) => {
    const rec: Call = { op: 'select', table, filters: [] };
    calls.push(rec);
    const b = {
      filter: (c: string, _op: string, v: string) => {
        rec.filters.push([c, v]);
        return b;
      },
      not: (c: string, _op: string, v: string) => {
        rec.filters.push([`not:${c}`, v]);
        return b;
      },
      limit: () => b,
      abortSignal: () => Promise.resolve({ data: opts.currentRows ?? [], error: null })
    };
    return b;
  };

  const writeBuilder = (op: string, table: string, values?: Record<string, unknown>) => {
    const rec: Call = { op, table, filters: [], values };
    calls.push(rec);
    const b = {
      filter: (c: string, _op: string, v: string) => {
        rec.filters.push([c, v]);
        return b;
      },
      not: (c: string, _op: string, v: string) => {
        rec.filters.push([`not:${c}`, v]);
        return b;
      },
      select: () => b,
      abortSignal: () => Promise.resolve({ data: opts.error ? null : opts.writeRows ?? [], error: opts.error ?? null })
    };
    return b;
  };

  const supabase = {
    from: (table: string) => ({
      select: (_cols: string, o?: { count?: string }) =>
        o?.count ? countBuilder(table) : plainSelectBuilder(table),
      insert: (values: Record<string, unknown>) => writeBuilder('insert', table, values),
      update: (values: Record<string, unknown>) => writeBuilder('update', table, values),
      delete: () => writeBuilder('delete', table)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { calls, supabase };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools = (supabase: unknown, orgId: string): Record<string, (input: any) => Promise<any>> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createOrgWriteTools({ authority: { kind: 'service', supabase: supabase as any }, orgId }) as any;

describe('insert_row: org_id si impone, non si corregge in silenzio', () => {
  it('un org_id diverso da quello della sessione è rifiutato, e niente viene scritto', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'p1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'projects',
      values: { name: 'x', slug: 'x', org_id: 'org-altrui' }
    });

    expect(out.error).toBe('wrong_org');
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('org_id è sempre scritto con quello della sessione, mai omesso', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'p1' }] });

    await tools(supabase, 'org-mine').insertRow({ table: 'projects', values: { name: 'x', slug: 'x' } });

    const insertCall = calls.find((c) => c.op === 'insert');
    expect(insertCall?.values).toMatchObject({ org_id: 'org-mine' });
  });

  it('una tabella fuori dalle 26 è rifiutata prima di qualunque scrittura', async () => {
    const { calls, supabase } = fakeAuthority({});

    const out = await tools(supabase, 'org-mine').insertRow({ table: 'organizations', values: { name: 'x' } });

    expect(out.error).toBe('unknown_table');
    expect(calls).toHaveLength(0);
  });
});

describe('insert_row su nodes_connections: rifiuta un arco verso un modello uncensored', () => {
  function fakeAuthorityByTable(rowsByTable: Record<string, Array<Record<string, unknown>>>) {
    const calls: Call[] = [];
    const selectBuilder = (table: string) => {
      const rec: Call = { op: 'select', table, filters: [] };
      calls.push(rec);
      const rows = rowsByTable[table] ?? [];
      const b = {
        eq: (c: string, v: unknown) => {
          rec.filters.push([c, v as string]);
          return b;
        },
        is: () => b,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null })
      };
      return b;
    };
    const writeBuilder = (op: string, table: string, values?: Record<string, unknown>) => {
      const rec: Call = { op, table, filters: [], values };
      calls.push(rec);
      const b = {
        select: () => b,
        abortSignal: () => Promise.resolve({ data: [{ id: 'c1' }], error: null })
      };
      return b;
    };
    const supabase = {
      from: (table: string) => ({
        select: (cols: string) => (cols === '*' ? selectBuilder(table) : selectBuilder(table)),
        insert: (values: Record<string, unknown>) => writeBuilder('insert', table, values)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    return { calls, supabase };
  }

  it('rifiuta la scrittura quando il nodo bersaglio usa un modello uncensored', async () => {
    const { calls, supabase } = fakeAuthorityByTable({
      nodes: [{ id: 'n2', org_id: 'org-mine', type: 'image', data: { model: 'wiro/nsfw-image' }, version: 1, deleted_at: null }],
      ai_models: [{ uncensored: true }]
    });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes_connections',
      values: { canvas_id: 'c1', source_node_id: 'n1', target_node_id: 'n2' }
    });

    expect(out.error).toBe('uncensored_no_inputs');
    expect(calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(false);
  });

  it('scrive normalmente quando il nodo bersaglio non è uncensored', async () => {
    const { calls, supabase } = fakeAuthorityByTable({
      nodes: [{ id: 'n2', org_id: 'org-mine', type: 'image', data: { model: 'openai/gpt-image' }, version: 1, deleted_at: null }],
      ai_models: [{ uncensored: false }]
    });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes_connections',
      values: { canvas_id: 'c1', source_node_id: 'n1', target_node_id: 'n2' }
    });

    expect(out.error).toBeUndefined();
    expect(calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(true);
  });
});

describe('update_row / delete_row: org_id si impone sul filtro, un id di un\'altra org non trova niente', () => {
  it('update: un where su org_id passato da chi chiama viene ignorato, si usa quello della sessione', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1, writeRows: [{ id: 'n1', org_id: 'org-mine' }] });

    await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'org_id', op: 'eq', value: 'org-altrui' }, { column: 'id', op: 'eq', value: 'n1' }],
      values: { display_name: 'x' }
    });

    const countCall = calls.find((c) => c.op === 'count');
    expect(countCall?.filters).toContainEqual(['org_id', 'org-mine']);
    expect(countCall?.filters).not.toContainEqual(['org_id', 'org-altrui']);
  });

  it('un id che non appartiene a questa org conta zero righe, mai un errore che lo distingua da "non esiste"', async () => {
    const { supabase } = fakeAuthority({ count: 0 });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'nodo-di-unaltra-org' }],
      values: { display_name: 'x' }
    });

    expect(out.error).toBe('no_rows_matched');
    expect(out.matched).toBe(0);
  });

  it('update: un org_id dentro values è rifiutato, non solo ignorato nel where', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1, writeRows: [{ id: 'n1', org_id: 'org-mine' }] });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { display_name: 'x', org_id: 'org-altrui' }
    });

    expect(out.error).toBe('wrong_org');
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('delete: stesso confine — org_id si impone sul filtro', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1, writeRows: [{ id: 'n1' }] });

    await tools(supabase, 'org-mine').deleteRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }]
    });

    const countCall = calls.find((c) => c.op === 'count');
    expect(countCall?.filters).toContainEqual(['org_id', 'org-mine']);
  });
});

describe('insert_row su nodes: data si giudica contro il suo type, prima di scrivere', () => {
  it('rifiuta un data che non rispetta lo schema del type, e nomina il campo', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'n1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { canvas_id: 'c1', project_id: 'p1', type: 'ads', x: 0, y: 0, data: { mode: 'page', country: 'IT' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/page_id/);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('accetta un data che rispetta lo schema del type, e scrive', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'n1', type: 'text', data: { prompt: 'x' } }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { canvas_id: 'c1', project_id: 'p1', type: 'text', x: 0, y: 0, data: { prompt: 'scrivi qualcosa' } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });

  it('un campo che il type non ha è rifiutato, non tolto in silenzio', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'n1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { canvas_id: 'c1', project_id: 'p1', type: 'text', x: 0, y: 0, data: { prompt: 'x', content: 'tre hook' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/content/);
    expect(out.message).toMatch(/doc/);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('un type fuori da nodes_type_check è rifiutato prima del database', async () => {
    const { calls, supabase } = fakeAuthority({});

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { canvas_id: 'c1', project_id: 'p1', type: 'carousel', x: 0, y: 0, data: {} }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('un insert senza data non è bloccato qui: resta al CHECK/NOT NULL del database', async () => {
    const { supabase } = fakeAuthority({ writeRows: [{ id: 'n1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { canvas_id: 'c1', project_id: 'p1', type: 'text', x: 0, y: 0 }
    });

    expect(out.error).toBe('invalid_node_data');
  });

  it('un insert su una tabella che non è nodes non passa da questa validazione', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'p1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'projects',
      values: { name: 'x', slug: 'x', data: { qualunque: 'cosa' } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });
});

describe('update_row su nodes: data si valida DOPO la fusione con la riga esistente', () => {
  it('una patch parziale legittima (solo status) passa perché il prompt esiste già sulla riga', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', data: { prompt: 'un gatto', status: 'idle' } }],
      writeRows: [{ id: 'n1', type: 'image', data: { prompt: 'un gatto', status: 'running' } }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { status: 'running' } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });

  it('scrive la riga fusa, non la patch: il prompt che c\'era resta', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', version: 4, data: { prompt: 'un gatto', status: 'idle' } }],
      writeRows: [{ id: 'n1', type: 'image', data: { prompt: 'un gatto', status: 'running' } }]
    });

    await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { status: 'running' } }
    });

    const update = calls.find((c) => c.op === 'update')!;
    expect(update.values).toMatchObject({ data: { prompt: 'un gatto', status: 'running' }, version: 5 });
    expect(update.filters).toContainEqual(['version', '4']);
  });

  it('una patch che rompe lo schema fuso è rifiutata, e nomina il campo', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', data: { prompt: 'un gatto', status: 'idle' } }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { status: 'not_a_real_status' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/status/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('un update di nodes che non tocca data non fa nessuna lettura né validazione in più', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1, writeRows: [{ id: 'n1' }] });

    await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { display_name: 'nuovo nome' }
    });

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });

  it('un update che cambia type E data si valida contro il type nuovo, non quello vecchio', async () => {
    const { supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'text', data: { prompt: 'x' } }],
      writeRows: [{ id: 'n1', type: 'doc', data: { content: 'x', public: false } }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { type: 'doc', data: { content: 'x', public: false } }
    });

    expect(out.error).toBeUndefined();
  });
});

describe('update_row on nodes: data keys are as strict as insert_row', () => {
  it('refuses a key the node type does not have, listing the allowed fields', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', version: 1, data: { prompt: 'un gatto' } }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { colour: 'red' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/"colour"/);
    expect(out.message).toMatch(/Allowed: .*prompt.*refId/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('keeps accepting the system-owned keys the canvas and engine write', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', version: 1, data: { prompt: 'un gatto' } }],
      writeRows: [{ id: 'n1' }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { refId: 'a1', runId: 'r1', running: false, error: null, params: { aspectRatio: '1:1' } } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
});

describe('insert_row/update_row on nodes: model must be one the canvas offers', () => {
  it('insert_row refuses an unknown video model, suggesting the recommended one', async () => {
    const { calls, supabase } = fakeAuthority({});

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'nodes',
      values: { type: 'video', canvas_id: 'c1', project_id: 'p1', data: { prompt: 'p', model: 'nope' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/nope.*vid-a \(balanced\)/);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('update_row refuses an unknown text model', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'text', version: 1, data: { prompt: 'x' } }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { model: 'nope' } }
    });

    expect(out.error).toBe('invalid_node_data');
    expect(out.message).toMatch(/txt-a \(balanced\)/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('update_row accepts an offered image model', async () => {
    const { calls, supabase } = fakeAuthority({
      count: 1,
      currentRows: [{ id: 'n1', type: 'image', version: 1, data: { prompt: 'x' } }],
      writeRows: [{ id: 'n1' }]
    });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'nodes',
      where: [{ column: 'id', op: 'eq', value: 'n1' }],
      values: { data: { model: 'img-a' } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
});

describe('insert_row/update_row: le colonne jsonb registrate si giudicano, non solo nodes.data', () => {
  it('insert: rifiuta posts.media che non è un array di { assetId, order }', async () => {
    const { calls, supabase } = fakeAuthority({});

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'posts',
      values: { brand_id: 'b1', caption: 'x', media: { assetId: 'a1' } }
    });

    expect(out.error).toBe('invalid_jsonb_column');
    expect(out.message).toMatch(/posts\.media/);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('insert: accetta posts.media valido', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'p1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'posts',
      values: { brand_id: 'b1', caption: 'x', media: [{ assetId: 'a1', order: 0 }] }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });

  it('insert: rifiuta ad_campaigns.targeting con un campo del tipo sbagliato', async () => {
    const { supabase } = fakeAuthority({});

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'ad_campaigns',
      values: { brand_id: 'b1', ad_account_id: 'acc1', name: 'x', targeting: { age_min: 'diciotto' } }
    });

    expect(out.error).toBe('invalid_jsonb_column');
    expect(out.message).toMatch(/targeting/);
  });

  it('insert: una colonna jsonb intenzionalmente libera (brands.palette) non blocca mai', async () => {
    const { calls, supabase } = fakeAuthority({ writeRows: [{ id: 'b1' }] });

    const out = await tools(supabase, 'org-mine').insertRow({
      table: 'brands',
      values: { name: 'x', slug: 'x', palette: { qualunque: 'cosa' } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });

  it('update: rifiuta un canvases.viewport senza zoom', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1 });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'canvases',
      where: [{ column: 'id', op: 'eq', value: 'c1' }],
      values: { viewport: { x: 0, y: 0 } }
    });

    expect(out.error).toBe('invalid_jsonb_column');
    expect(out.message).toMatch(/zoom/);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('update: accetta un canvases.viewport valido', async () => {
    const { calls, supabase } = fakeAuthority({ count: 1, writeRows: [{ id: 'c1' }] });

    const out = await tools(supabase, 'org-mine').updateRow({
      table: 'canvases',
      where: [{ column: 'id', op: 'eq', value: 'c1' }],
      values: { viewport: { x: 0, y: 0, zoom: 1 } }
    });

    expect(out.error).toBeUndefined();
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
});
