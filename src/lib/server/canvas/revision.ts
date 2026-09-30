import { createHash } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import type { Membership } from '$lib/server/repos/orgs';
import type { CanvasNodeRecord, Connection } from '$lib/server/repos/canvas';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { findProjectForUser } from '$lib/server/projects/lookup';
import { Remote, type RemoteState } from '$lib/canvas/staleness';

type NodeStamp = { id: string; version: number; x: number; y: number; width: number | null; height: number | null };
type EdgeStamp = { id: string };

const NODE_STAMP_COLUMNS = 'id, version, x, y, width, height';

export function revisionOf(nodes: NodeStamp[], edges: EdgeStamp[]): string {
  const stamps = nodes.map((n) => `${n.id}:${n.version}:${n.x}:${n.y}:${n.width}:${n.height}`).sort();
  const links = edges.map((e) => e.id).sort();
  return createHash('sha1').update(`${stamps.join('|')}#${links.join('|')}`).digest('base64url');
}

export function recordsRevision(nodes: CanvasNodeRecord[], connections: Connection[]): string {
  return revisionOf(nodes.map((n) => ({ id: n.id, version: n.version, ...n.position, ...n.size })), connections);
}

async function liveRevision(db: Db, scope: { orgId: string; canvasId: string }): Promise<string> {
  const [nodes, edges] = await Promise.all([
    db.from('nodes').select(NODE_STAMP_COLUMNS).eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).is('deleted_at', null),
    db.from('nodes_connections').select('id').eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).is('deleted_at', null)
  ]);
  if (nodes.error) {
    throw nodes.error;
  }
  if (edges.error) {
    throw edges.error;
  }
  return revisionOf((nodes.data ?? []) as NodeStamp[], (edges.data ?? []) as EdgeStamp[]);
}

export async function canvasRevision(
  db: Db,
  input: { canvasId: string; projectId: string; memberships: Membership[] }
): Promise<RemoteState> {
  const found = await findCanvasForUser(db, input);
  if (found) {
    return { kind: Remote.Live, revision: await liveRevision(db, { orgId: found.orgId, canvasId: input.canvasId }) };
  }

  const project = await findProjectForUser(db, input);
  return project ? { kind: Remote.CanvasGone } : { kind: Remote.ProjectGone };
}
