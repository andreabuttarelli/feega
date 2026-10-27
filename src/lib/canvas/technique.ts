import { planDuplicate, type DuplicateEdge, type DuplicateNode, type DuplicatePlan } from './duplicate-plan';
import { GENERATIVE_TYPES, planWorkflow } from './workflow-plan';

export type TechniqueSlot = { node: number; type: string };

export type Technique = { plan: DuplicatePlan; inputs: TechniqueSlot[]; outputs: TechniqueSlot[] };

export type SlotValue = { node: number; value: string };

export type Packaged = { ok: true; technique: Technique } | { ok: false; reason: string };

const DOC_TYPE = 'doc';

const MEDIA_TYPES = new Set(['image', 'video', 'audio']);

const slotKey = (type: string) => (type === DOC_TYPE ? 'content' : MEDIA_TYPES.has(type) ? 'url' : 'prompt');

export function packageTechnique(input: { ids: string[]; nodes: DuplicateNode[]; edges: DuplicateEdge[] }): Packaged {
  const asGenerative = new Map(input.ids.map((id) => [id, [...GENERATIVE_TYPES][0]]));
  const valid = planWorkflow(input.ids, input.edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target })), asGenerative);
  if (!valid.ok) {
    return valid;
  }

  const chosen = new Set(input.ids);
  const picked = input.nodes.filter((n) => chosen.has(n.id));
  const origin = { x: Math.min(...picked.map((n) => n.x)), y: Math.min(...picked.map((n) => n.y)) };
  const plan = planDuplicate({ ids: input.ids, nodes: input.nodes, edges: input.edges, offset: { dx: -origin.x, dy: -origin.y } });

  return { ok: true, technique: { plan, inputs: slots(plan, 'targetIndex'), outputs: slots(plan, 'sourceIndex') } };
}

function slots(plan: DuplicatePlan, taken: 'targetIndex' | 'sourceIndex'): TechniqueSlot[] {
  const used = new Set(plan.edges.map((e) => e[taken]));
  return plan.nodes.filter((_, i) => !used.has(i)).map((n) => ({ node: n.sourceIndex, type: n.type }));
}

export function techniquePlan(technique: Technique, at: { x: number; y: number }): DuplicatePlan {
  return {
    nodes: technique.plan.nodes.map((n) => ({ ...structuredClone(n), x: n.x + at.x, y: n.y + at.y })),
    edges: structuredClone(technique.plan.edges)
  };
}

export function withInputs(plan: DuplicatePlan, values: SlotValue[]): DuplicatePlan {
  const nodes = plan.nodes.map((n) => {
    const given = values.find((v) => v.node === n.sourceIndex);
    if (!given) {
      return n;
    }

    return { ...n, data: { ...n.data, [slotKey(n.type)]: given.value } };
  });

  return { ...plan, nodes };
}
