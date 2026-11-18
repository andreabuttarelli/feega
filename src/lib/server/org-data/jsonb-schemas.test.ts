import { describe, expect, it } from 'vitest';
import { JSONB_COLUMN_SCHEMAS, validateJsonbColumn, jsonbColumnsOf } from './jsonb-schemas';

describe('JSONB_COLUMN_SCHEMAS — un posto solo per le colonne jsonb raggiungibili da insert_row/update_row', () => {
  it('elenca ogni colonna trovata sul database vero (klnswzhhgrqvbfjzioul), tabella.colonna', () => {
    const keys = Object.keys(JSONB_COLUMN_SCHEMAS).sort();
    expect(keys).toEqual(
      [
        'canvas_events.after',
        'canvas_events.before',
        'canvases.viewport',
        'chat_messages.attachments',
        'chat_messages.selection',
        'chat_messages.tool_calls',
        'node_runs.params',
        'nodes.data',
        'products.images',
        'social_posts.media',
        'social_posts.metrics'
      ].sort()
    );
  });

  it('ogni entry dichiara se è validata o intenzionalmente libera, mai in silenzio', () => {
    for (const [key, entry] of Object.entries(JSONB_COLUMN_SCHEMAS)) {
      expect(entry, key).toHaveProperty('kind');
      expect(['validated', 'free_form']).toContain(entry.kind);
      if (entry.kind === 'free_form') {
        expect(entry.reason, `${key} manca il motivo`).toBeTruthy();
      }
    }
  });
});

describe('jsonbColumnsOf — quali colonne jsonb ha una tabella, per attivare la validazione solo lì', () => {
  it('nodes ha data', () => {
    expect(jsonbColumnsOf('nodes')).toEqual(['data']);
  });

  it('una tabella senza colonne jsonb registrate torna vuota', () => {
    expect(jsonbColumnsOf('orgs')).toEqual([]);
  });
});

describe('validateJsonbColumn — canvases.viewport: la stessa forma di repos/canvas.ts::saveViewport', () => {
  it('accetta x/y/zoom', () => {
    const out = validateJsonbColumn('canvases', 'viewport', { x: 100, y: -40, zoom: 1.5 });
    expect(out.ok).toBe(true);
  });

  it('rifiuta zoom mancante', () => {
    const out = validateJsonbColumn('canvases', 'viewport', { x: 0, y: 0 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/zoom/);
  });
});

describe('validateJsonbColumn — colonne intenzionalmente libere: passano sempre, per costruzione', () => {
  const FREE_FORM: Array<[string, string]> = [
    ['canvas_events', 'before'],
    ['canvas_events', 'after'],
    ['chat_messages', 'tool_calls'],
    ['node_runs', 'params'],
    ['products', 'images']
  ];

  for (const [table, column] of FREE_FORM) {
    it(`${table}.${column} accetta qualunque JSON, dichiarato libero apposta`, () => {
      expect(validateJsonbColumn(table, column, { qualunque: 'cosa', anche: [1, 2, 3] }).ok).toBe(true);
      expect(validateJsonbColumn(table, column, 'anche una stringa').ok).toBe(true);
      expect(validateJsonbColumn(table, column, null).ok).toBe(true);
    });
  }
});

describe('validateJsonbColumn — una colonna non registrata non blocca niente', () => {
  it('una colonna jsonb ipotetica fuori registro passa senza essere giudicata', () => {
    const out = validateJsonbColumn('orgs', 'settings', { qualunque: 'cosa' });
    expect(out.ok).toBe(true);
  });
});

describe('validateJsonbColumn — chat_messages.attachments', () => {
  it('accetta la forma che saveTurn scrive e rifiuta il resto', () => {
    expect(validateJsonbColumn('chat_messages', 'attachments', [{ assetId: 'a', kind: 'image', name: 'l.png', mimeType: 'image/png', bytes: 1 }]).ok).toBe(true);
    expect(validateJsonbColumn('chat_messages', 'attachments', [{ name: 'l.png' }]).ok).toBe(false);
  });
});
