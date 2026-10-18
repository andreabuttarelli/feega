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
        'Reads: list_canvases {}, estimate_text_cost {canvasId,nodeId,prompt?,model?} (token estimate of a text run), suggest_next_steps {canvasId,nodeId}, list_nodes {canvasId}, canvas_snapshot {canvasId} (nodes, connections, runs, products, socialPosts, influencers, revision), canvas_revision {canvasId} (live revision, or canvas/project gone), list_runs {nodeId}, list_models {medium} (models this project can run: provider, credits, uncensored, and routes[] — one per provider that serves it, for run_node provider), preview_node_loop {nodeId}, ' +
        'preview_run_graph {graph:"downstream",nodeId} | {graph:"stale",canvasId,nodeIds?} (ordered steps + credits: quote before run_graph). ' +
        'Writes, free: create_node {canvasId,type,x,y,displayName?,data?} (data per describe_node_types), update_node {nodeId,data} (only changed fields, null removes), ' +
        'move_node {nodeId,x,y,z?}, resize_node {nodeId,width,height}, connect_nodes {canvasId,sourceNodeId,targetNodeId,sourceHandle?,targetHandle?} (a frame takes no inputs: use place_in_frame), delete_node {nodeId} (soft, drops its lines), cancel_node_loop {nodeId}, ' +
        'duplicate_nodes {canvasId,nodeIds}, write_nodes {canvasId,items:[{node_id,version,patch}]} (merge each patch, per-node written|conflict|not_found), paste_nodes {canvasId,nodes:[{type,data,x,y}],edges?:[{sourceIndex,targetIndex,sourceHandle?,targetHandle?}]}, list_connections {canvasId}, disconnect_nodes {connectionId}, set_edge_mode {connectionId,mode:fixed|iterate}, undo_gesture {canvasId,items} (replay a recorded gesture inverse; refused when the canvas moved on), run_demo {canvasId} (first-run example chain), end_onboarding {status:dismissed|completed}, ' +
        'create_canvas {}, rename_canvas {canvasId,name}, delete_canvas {canvasId}, rename_project {name}, share_canvas {canvasId,on} (view-only link), share_doc {nodeId,on}, ' +
        'list_templates {}, insert_template {canvasId,templateId,x,y}, add_frame_from_template {canvasId,templateId,format?,values?,x,y}, move_frame_element {frameId,elementId,toFrameId?,x?,y?,canvasX?,canvasY?}, copy_frame_element {same input as move_frame_element; copies, the source keeps the element}, create_formats {frameId,targets:[{format:1:1|4:5|9:16|16:9}|{size:{width,height}}]} (editable copies of a frame in other formats, content refitted, placed to its right), place_in_frame {nodeId,toFrameId?,x?,y?}, draw_element {canvasId,drawn:{tool:text|rectangle|ellipse,box:{left,top,width,height}}|{tool:pen,path}} (a free Text/Box/Ellipse/Path on the canvas, outside any frame), group_elements {canvasId,nodeIds} (2+ free elements into one Group), ungroup_element {canvasId,nodeId}, rotate_group {canvasId,nodeId,degrees} (turns the Group and its members around its centre), move_group {canvasId,nodeId,x,y} (moves the Group and its members), scale_group {canvasId,nodeId,width,height} (resizes the Group and scales its members), ' +
        'show_run {nodeId,runId} (show an older result), sync_node {nodeId} (products, social feed), preview_workflow {canvasId,nodeIds}, cancel_workflow {workflowId}, cancel_render {nodeId}, withdraw_from_gallery {itemId}. ' +
        'Upload a file into a new node: request_upload {fileName,mimeType,bytes} (checked like the canvas upload: image/document 4MB, video 200MB) answers path + uploadUrl; PUT the bytes there with the Content-Type, then register_upload {canvasId,path,fileName,mimeType,bytes,x?,y?} answers node + asset. Copy a picture or video from a link into the project library: import_link {url} answers asset (use its id in a media prop; a raw link does not render in frames). ' +
        'Custom voices: list_voices {}, voice_library {search?,language?,gender?,accent?,useCase?,page?}, use_library_voice {ownerId,voiceId,name}, save_voice {generatedVoiceId,name,description?}, delete_voice {id}. ' +
        'Spends credits: run_node {nodeId,medium,prompt?,model?,params?,provider?,expectedVersion}, run_node_loop {nodeId,confirm?}, retry_loop_combination {nodeId,outputListNodeId,label,runId?}, run_workflow {canvasId,nodeIds}, run_graph (same input as preview_run_graph; queued, each step after its inputs; cycles refused), design_voice {description} (previews to save_voice), read_video_reference {assetId} (a video asset into transcript, scenes with durations, on-screen text, UI, camera, transitions, pacing, palette, type; spends only on the first read), clone_voice {name,consentBasis:own_voice|consented_speaker,speaker?,attested:true,seconds:60-180,sampleBase64 (max 3MB),mimeType?} (only with the user\'s consent). ' +
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
