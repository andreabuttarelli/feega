import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { canvasApi } from '../../lib/canvas.ts';
import { withAuth } from '../util.ts';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

export function registerCanvasTools(server: McpServer) {
  server.registerTool(
    'canvas_tool',
    {
      title: 'Work a project canvas',
      description:
        'The canvas ops of the project chat, on one project (`project_id`), with `input` in camelCase. ' +
        'Reads: list_canvases {}, list_nodes {canvasId}, list_runs {nodeId}, preview_node_loop {nodeId}. ' +
        'Writes, free: create_node {canvasId,type,x,y,displayName?,data?} (data per describe_node_types), update_node {nodeId,data} (only changed fields, null removes), ' +
        'move_node {nodeId,x,y,z?}, connect_nodes {canvasId,sourceNodeId,targetNodeId,sourceHandle?,targetHandle?}, delete_node {nodeId} (soft), cancel_node_loop {nodeId}. ' +
        'Spends credits: run_node {nodeId,medium,prompt?,model?,params?,expectedVersion}, run_node_loop {nodeId,confirm?}. ' +
        'Unknown op answers the list; bad input answers the issues.',
      inputSchema: z.object({
        org,
        project_id: z.string(),
        op: z.string(),
        input: z.record(z.string(), z.unknown()).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, project_id, op, input }) => withAuth((token) => canvasApi.run(token, { project: project_id, op, input }, org))
  );
}
