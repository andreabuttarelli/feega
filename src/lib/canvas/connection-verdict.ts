import type { CanvasNode } from './graph';
import { DEFAULT_EDGE_KIND, edgeKindsFor, verdictBetween } from './connect-rules';
import { connectorAccepts, nodeAcceptsConnection } from './connector-ports';
import { anyPortAccepts, landingPort, portListValued, type ConnectorType } from './connectors';
import { isOutputHandle, portOfHandle, unavailableOutput, type SelectOutput } from './select-outputs';
import type { CanvasEdgeKind } from '$lib/canvas-edges';

export type VerdictTile = { id: string; kind?: string; connectors?: ConnectorType[]; output?: ConnectorType | null; outputs?: SelectOutput[] };
export type VerdictEdge = { id: string; target: string; targetHandle?: string | null };
export type Connection = { source?: string | null; target?: string | null; sourceHandle?: string | null; targetHandle?: string | null };
export type Lookup = (id: string) => CanvasNode | null;

export function connectionRefusal(tiles: VerdictTile[], edges: VerdictEdge[], lookup: Lookup, c: Connection): string | null {
  const { source, target, sourceHandle, targetHandle } = c;
  if (!source || !target) {
    return '';
  }

  const verdict = verdictBetween(lookup, source, target, sourceHandle);
  if (!verdict.ok) {
    return verdict.why;
  }

  const connector = targetHandle as ConnectorType | null | undefined;
  const connectors = tiles.find((t) => t.id === target)?.connectors;
  const sourceTile = tiles.find((t) => t.id === source);
  if (sourceTile && unavailableOutput(sourceTile, sourceHandle)) {
    return 'This output is not available for the connected source';
  }
  const output = sourceTile ? portOfHandle(sourceTile, sourceHandle) : null;
  const targetKind = tiles.find((t) => t.id === target)?.kind ?? '';
  const portEdges = edges.map((e) => ({ id: e.id, target: e.target, targetHandle: e.targetHandle ?? null }));
  if (!nodeAcceptsConnection(portEdges, target, targetKind)) {
    return 'An effects node takes one media input';
  }
  if (output && connectors?.length && !anyPortAccepts(connectors, output)) {
    return `No port accepts ${output}`;
  }
  if (connector && connectors?.includes(connector)) {
    const free = connectorAccepts(portEdges, target, connector, portListValued(targetKind, connector));
    if (!free) {
      return `Port ${connector} is already taken`;
    }
  }

  return null;
}

export type Landing = { source: string; target: string; kind: CanvasEdgeKind; targetHandle: ConnectorType | null; sourceHandle: string | null };

export function landingOf(tiles: VerdictTile[], lookup: Lookup, c: Connection): Landing | null {
  const { source, target } = c;
  if (!source || !target || source === target) {
    return null;
  }
  const sourceTile = tiles.find((t) => t.id === source);
  const output = sourceTile ? portOfHandle(sourceTile, c.sourceHandle) : null;
  const connectors = tiles.find((t) => t.id === target)?.connectors ?? [];
  const handle = landingPort((c.targetHandle as ConnectorType | null) ?? null, output, connectors);
  const outputHandle = isOutputHandle(c.sourceHandle) ? c.sourceHandle : null;
  return { source, target, kind: edgeKindsFor(lookup, source, target, outputHandle)[0] ?? DEFAULT_EDGE_KIND, targetHandle: handle, sourceHandle: outputHandle };
}
