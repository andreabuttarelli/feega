import type { OrgCaller } from '$lib/server/org-data/auth';
import { callerReach } from '$lib/server/org-data/reach';
import { findNode } from '$lib/server/repos/canvas';
import { describeInputKeys } from './describe-edit';
import { editCatalogue } from './edit-catalogue';
import type { EditPorts } from './run-edit';
import { runCanvasOp, runEditorAction, runFrameTool, type Answer } from './runners';

async function reached(caller: OrgCaller, nodeId: string): Promise<Answer | null> {
  const hidden = await callerReach(caller, { nodes: [nodeId] });
  return hidden ? { status: hidden.status, body: await hidden.json() } : null;
}

export function editPorts(caller: OrgCaller): EditPorts {
  return {
    catalogue: editCatalogue(),
    inputKeys: describeInputKeys,
    projectOf: async (nodeId) => (await findNode(caller.db, { orgId: caller.orgId, nodeId }))?.projectId ?? null,
    canvas: (ask) => runCanvasOp(caller, ask),
    frame: async (ask) => (await reached(caller, ask.nodeId)) ?? runFrameTool(caller, ask),
    editor: async (ask) => (await reached(caller, ask.nodeId)) ?? runEditorAction(caller, ask)
  };
}
