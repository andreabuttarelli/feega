import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_TEMPLATES,
  CANVAS_TEMPLATES,
  planTemplate,
  TEMPLATE_CATEGORIES,
  templateById,
  templateNodeTypes,
  templatesIn,
  templateThumbnail,
  TEMPLATE_NODE_HALF,
  type TemplateNode
} from './templates';
import { validateNewNodeData } from './node-data';
import { nodeSize } from './node-size';
import { PLACEMENT_GAP } from './placement';
import { NODE_PORTS } from './node-ports';
import { portAccepts, type ConnectorType } from './connectors';
import { IMAGE_MODEL_CHOICES, imageModelSpec } from '$lib/image-models';
import { VIDEO_MODEL_CHOICES, videoModelSpec } from '$lib/video-models';
import { audioInputPorts, audioModelsOf, audioOperationOf } from './audio-operations';
import { DEFAULT_MODEL } from './default-models';
import { MODEL3D_MODELS } from '$lib/model3d-models';

const MIN_TEMPLATES = 8;

const STATIC_DIR = join(process.cwd(), 'static');

type Model = string | null | undefined;

const modelOf = (node: TemplateNode): Model => node.data.model as Model;

const audioOperation = (node: TemplateNode) => audioOperationOf((node.data.params ?? {}) as { operation?: unknown });

const KNOWN_MODELS: Record<string, (node: TemplateNode) => readonly string[]> = {
  text: () => [DEFAULT_MODEL.text],
  image: () => IMAGE_MODEL_CHOICES.map((c) => c.id),
  video: () => VIDEO_MODEL_CHOICES.map((c) => c.id),
  audio: (node) => audioModelsOf(audioOperation(node)),
  model3d: () => Object.values(MODEL3D_MODELS)
};

const ACCEPTED_HANDLES: Record<string, (node: TemplateNode) => ConnectorType[]> = {
  text: () => ['text'],
  image: (node) => ((imageModelSpec(modelOf(node))?.maxRefs ?? 0) > 0 ? ['text', 'images'] : ['text']),
  video: (node) => (videoModelSpec(modelOf(node))?.roles.includes('image') ? ['text', 'images', 'first_frame', 'last_frame'] : ['text']),
  audio: (node) => audioInputPorts(audioOperation(node)),
  model3d: () => ['images', 'text']
};

const everyNode = CANVAS_TEMPLATES.flatMap((t) => t.nodes.map((node) => ({ template: t.id, node })));
const everyEdge = CANVAS_TEMPLATES.flatMap((t) => t.edges.map((edge) => ({ template: t, edge })));

describe('il registro dei template', () => {
  it('offre abbastanza template, con id unici', () => {
    const ids = CANVAS_TEMPLATES.map((t) => t.id);
    expect(ids.length).toBeGreaterThanOrEqual(MIN_TEMPLATES);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ogni template ha nome, descrizione e chiavi di nodo uniche', () => {
    for (const t of CANVAS_TEMPLATES) {
      expect(t.name.trim(), t.id).not.toBe('');
      expect(t.description.trim(), t.id).not.toBe('');
      const keys = t.nodes.map((n) => n.key);
      expect(new Set(keys).size, t.id).toBe(keys.length);
    }
  });

  it.each(everyNode)('$template/$node.key: data valida per il suo tipo', ({ node }) => {
    const verdict = validateNewNodeData(node.type, node.data);
    expect(verdict.ok ? null : verdict.error).toBeNull();
  });

  it.each(everyNode)('$template/$node.key: il modello esiste nel catalogo', ({ node }) => {
    const known = KNOWN_MODELS[node.type];
    if (!known || modelOf(node) == null) {
      return;
    }
    expect(known(node)).toContain(modelOf(node));
  });

  it.each(everyEdge)('$template.id: $edge.from → $edge.to su $edge.handle collega porte compatibili', ({ template, edge }) => {
    const source = template.nodes.find((n) => n.key === edge.from);
    const target = template.nodes.find((n) => n.key === edge.to);
    expect(source).toBeDefined();
    expect(target).toBeDefined();

    const output = NODE_PORTS[source!.type].output;
    expect(typeof output === 'string' && ['text', 'images', 'videos', 'audios'].includes(output)).toBe(true);
    expect(portAccepts(edge.handle, output as ConnectorType)).toBe(true);
    expect(ACCEPTED_HANDLES[target!.type]?.(target!) ?? []).toContain(edge.handle);
  });

  it('un template senza archi è solo un nodo: ne hanno tutti almeno uno', () => {
    for (const t of CANVAS_TEMPLATES) {
      expect(t.edges.length, t.id).toBeGreaterThan(0);
    }
  });
});

describe('planTemplate', () => {
  const [first] = CANVAS_TEMPLATES;

  it('un nodo per ogni nodo del template, con tipo e data copiati', () => {
    const plan = planTemplate(first, { x: 0, y: 0 });

    expect(plan.nodes.map((n) => n.type)).toEqual(first.nodes.map((n) => n.type));
    expect(plan.nodes[0].data).toEqual(first.nodes[0].data);
    expect(plan.nodes[0].data).not.toBe(first.nodes[0].data);
  });

  it('centra il gruppo sul punto dato', () => {
    const at = { x: 1000, y: -500 };
    const plan = planTemplate(first, at);

    const mid = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;
    expect(mid(plan.nodes.map((n) => n.x)) + TEMPLATE_NODE_HALF.x).toBeCloseTo(at.x);
    expect(mid(plan.nodes.map((n) => n.y)) + TEMPLATE_NODE_HALF.y).toBeCloseTo(at.y);
  });

  it('no two nodes of any template overlap, and neighbours keep the placement gap', () => {
    for (const template of CANVAS_TEMPLATES) {
      const plan = planTemplate(template, { x: 0, y: 0 });
      const rects = plan.nodes.map((n) => ({ x: n.x, y: n.y, ...nodeSize(n.type) }));
      for (const [i, a] of rects.entries()) {
        for (const b of rects.slice(i + 1)) {
          const apartX = a.x + a.w + PLACEMENT_GAP <= b.x || b.x + b.w + PLACEMENT_GAP <= a.x;
          const apartY = a.y + a.h + PLACEMENT_GAP <= b.y || b.y + b.h + PLACEMENT_GAP <= a.y;
          expect(apartX || apartY, template.id).toBe(true);
        }
      }
    }
  });

  it('gli archi puntano agli indici dei nodi, con la porta di arrivo del template', () => {
    const plan = planTemplate(first, { x: 0, y: 0 });
    const [edge] = first.edges;

    expect(plan.edges[0]).toEqual({
      sourceIndex: first.nodes.findIndex((n) => n.key === edge.from),
      targetIndex: first.nodes.findIndex((n) => n.key === edge.to),
      sourceHandle: 'derives_from',
      targetHandle: edge.handle
    });
  });

  it('templateById trova un template e rifiuta un id sconosciuto', () => {
    expect(templateById(first.id)).toBe(first);
    expect(templateById('non-esiste')).toBeUndefined();
  });
});

describe('la galleria dei template', () => {
  it('ogni categoria ha almeno un template, e ogni template una categoria nota', () => {
    const known = TEMPLATE_CATEGORIES.map((c) => c.id);
    for (const t of CANVAS_TEMPLATES) {
      expect(known, t.id).toContain(t.category);
    }
    for (const category of known) {
      expect(templatesIn(category).length, category).toBeGreaterThan(0);
    }
  });

  it('il filtro "all" mostra tutti i template', () => {
    expect(templatesIn(ALL_TEMPLATES)).toEqual(CANVAS_TEMPLATES);
  });

  it.each(CANVAS_TEMPLATES)('$id: ha una miniatura WebP fra gli asset statici', (t) => {
    const path = templateThumbnail(t);
    expect(path).toMatch(/\.webp$/);
    expect(existsSync(join(STATIC_DIR, path)), path).toBe(true);
  });

  it('Product → 3D model turns a product image into a 3D node, under 3D', () => {
    const t = templateById('product-3d')!;

    expect(t.category).toBe('3d');
    expect(templateNodeTypes(t)).toEqual(['image', 'model3d']);
    expect(t.edges).toEqual([{ from: 'product', to: 'model', handle: 'images' }]);
  });

  it('Text → 3D model feeds a written description into a 3D node, no image needed', () => {
    const t = templateById('text-3d')!;

    expect(t.category).toBe('3d');
    expect(templateNodeTypes(t)).toEqual(['doc', 'model3d']);
    expect(t.edges).toEqual([{ from: 'object', to: 'model', handle: 'text' }]);
    expect(t.nodes[1].data.model).toBe(MODEL3D_MODELS.trellis2);
  });

  it('i tipi di nodo compaiono una volta, nell\'ordine in cui li incontra', () => {
    const t = templateById('ugc-video-ad')!;
    const types = templateNodeTypes(t);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...new Set(t.nodes.map((n) => n.type))]);
  });
});
