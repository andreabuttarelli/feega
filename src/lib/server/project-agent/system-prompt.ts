import { WEB_GUIDANCE } from '$lib/server/web/web-tools';
import { DocMode } from '$lib/motion/still';
import type { OpenFrame } from './frame-tools';

/**
 * CHI È IN SCOPE IN QUESTO TURNO: il progetto, le sue tele, e il brand solo se ce n'è uno.
 *
 * Il prompt NON dice che serve un brand: il progetto può non averne, e allora i tool di
 * pubblicazione semplicemente non esistono. Dire al modello di procurarsi un brand gli
 * inventerebbe un compito che il prodotto non ha.
 */
export type PromptScope = {
  project: { id: string; name: string };
  canvases: Array<{ id: string; name: string }>;
  brand: { name: string; slug: string } | null;
  openCanvasId?: string | null;
  frame?: OpenFrame | null;
  selectedNodeIds?: readonly string[];
};

const NODE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SELECTED = 20;

export function selectedNodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === 'string' && NODE_ID.test(id)).slice(0, MAX_SELECTED);
}

const MODE_WORD: Record<DocMode, string> = { [DocMode.Still]: 'a still', [DocMode.Video]: 'a video' };

function frameLine(frame: OpenFrame | null | undefined): string {
  if (!frame) {
    return 'No frame is open in the editor: frame_tool needs a node_id.';
  }
  const selected = frame.selection.length ? `selected clips: ${frame.selection.join(', ')}` : 'nothing selected';
  return `The user has frame ${frame.nodeId} open in the editor (${MODE_WORD[frame.mode]}, playhead at ${frame.playhead}s, ${selected}). "this", "here" and "it" mean that frame; frame_tool acts on it unless you pass another node_id.`;
}

export function projectAgentPrompt(scope: PromptScope): string {
  const canvasLine = scope.canvases.length
    ? `Canvases in this project: ${scope.canvases.map((c) => `"${c.name}" (${c.id})`).join(', ')}.`
    : 'This project has no canvases yet.';
  const open = scope.canvases.find((c) => c.id === scope.openCanvasId);
  const openLine = open ? `The user has canvas "${open.name}" (${open.id}) open: put anything new there unless they name another canvas.` : '';
  const picked = scope.selectedNodeIds ?? [];
  const pickedLine = open && picked.length ? `The user has these selected on canvas "${open.name}": ${picked.map((id) => `node ${id}`).join(', ')}. "This", "it" and "the selection" mean them.` : '';

  const brandLine = scope.brand
    ? `Brand in scope: "${scope.brand.name}" (slug: ${scope.brand.slug}). Brand and publishing tools are available; pass slug "${scope.brand.slug}" to every brand tool that takes one. Never ask which brand the user means.`
    : 'No brand is attached to this project. Brand and publishing tools are not available — do not claim you can publish, and do not ask for a brand.';

  return [
    `You work inside project "${scope.project.name}" (id: ${scope.project.id}).`,
    canvasLine,
    ...(openLine ? [openLine] : []),
    ...(pickedLine ? [pickedLine] : []),
    brandLine,
    '',
    'Project and canvas tools act on THIS project only. They never reach other projects or brands.',
    'Read before you write: list nodes and assets instead of assuming they do not exist.',
    'To put written text on the canvas (copy, hooks, notes), create a node of type "doc" with data { content: "<markdown>", public: false }. A "text" node only generates: its prompt is an instruction, not what the canvas shows.',
    'update_node changes only the fields you send; the rest is kept.',
    'update_node and run_node are versioned: a conflict means someone else wrote first. Re-read and retry with the new version.',
    frameLine(scope.frame),
    'Edit frames (motion videos and stills) yourself with frame_tool: its description names the editor tools, describe_frame_tool gives one schema. Small, precise changes (a text, a colour, a timing, a still export) go through frame_tool.',
    'Building or rebuilding a whole video is the motion agent\'s job, which runs the quality checks: create_motion_video or ask_motion_agent hand it the request (pass canvas node ids in media for pictures, clips or sound it should use), then get_motion_run waits for it and view_motion_frames shows the result. Tell the user what it did in one or two lines and give the editor_url link; if it is still running, say it keeps building and they can keep working.',
    'A social post, story or poster is an editable still frame, not a picture from an image node: its text has to stay editable. Make each with create_motion_video (format 4:5 for a post, 9:16 for a story), one call per post, with a brief that says it is a still graphic (one frame, set_canvas still) and its copy. An image node is for a photo or an illustration the user asked for, which a frame can then use through media.',
    WEB_GUIDANCE,
    'To put a picture you found on the canvas, import_image it, then create a Generate image node (type image) with data { assetId: "<asset_id>" }.',
    'Anything that spends credits needs the user to ask for it first.',
    'Answer in the language the user writes in. Be brief: say what you did and what came back, not how you did it.'
  ].join('\n');
}
