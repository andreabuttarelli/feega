import { layoutOf } from './node-layout';
import { SECTION_TYPE } from './section';
import { hasUpstreamCycle, type UpstreamEdge } from './upstream-inputs';

type Held = { id: string; type: string; data: Record<string, unknown> };

export type SectionItem = { id: string; type: string; included: boolean };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function excludedOf(data: Record<string, unknown>): string[] {
  return Array.isArray(data.sectionExcluded) ? data.sectionExcluded.filter((id): id is string => typeof id === 'string') : [];
}

function contentsOf(nodes: readonly Held[], sectionId: string, consumerId: string): Held[] {
  return nodes.filter((n) => n.id !== consumerId && n.type !== SECTION_TYPE && layoutOf(n.data).groupId === sectionId);
}

export function sectionItemsOf(nodes: readonly Held[], sectionId: string, consumerId: string): SectionItem[] {
  const excluded = new Set(excludedOf(nodes.find((n) => n.id === consumerId)?.data ?? {}));
  return contentsOf(nodes, sectionId, consumerId).map((n) => ({ id: n.id, type: n.type, included: !excluded.has(n.id) }));
}

export function expandSectionEdges(nodes: readonly Held[], edges: readonly UpstreamEdge[]): UpstreamEdge[] {
  const sections = new Set(nodes.filter((n) => n.type === SECTION_TYPE).map((n) => n.id));
  const plain = edges.filter((e) => !sections.has(e.sourceNodeId));
  const result = [...plain];
  const wired = new Set(plain.map((e) => `${e.sourceNodeId}>${e.targetNodeId}`));

  for (const wire of edges.filter((e) => sections.has(e.sourceNodeId)).sort(byId)) {
    for (const item of sectionItemsOf(nodes, wire.sourceNodeId, wire.targetNodeId)) {
      const key = `${item.id}>${wire.targetNodeId}`;
      if (!item.included || wired.has(key)) {
        continue;
      }

      const added: UpstreamEdge = { ...wire, id: `${wire.id}~${item.id}`, sourceNodeId: item.id };
      if (hasUpstreamCycle([...result, added], wire.targetNodeId)) {
        continue;
      }

      result.push(added);
      wired.add(key);
    }
  }

  return result;
}

export type SectionInputs = { id: string; name: string; items: { id: string; label: string; included: boolean }[]; trimmed: string | null };

export function trimNote(images: number, maxRefs: number): string | null {
  return images > maxRefs ? `Only the first ${maxRefs} of ${images} images are sent: this model takes at most ${maxRefs} references.` : null;
}
