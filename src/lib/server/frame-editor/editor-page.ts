import { fail } from '@sveltejs/kit';
import type { Actions, ServerLoadEvent } from '@sveltejs/kit';
import { loadEditorSession } from '$lib/server/motion/editor-session';
import { motionScope as scopeFor, type MotionEditorScope } from '$lib/server/motion/editor-scope';
import { EDITOR_OPS, runEditorOp, type EditorAnswer, type EditorCtx } from '$lib/server/frame-editor/editor-ops';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { savePoster } from '$lib/server/motion/poster';

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const HTTP_BAD_REQUEST = 400;

type EditorParams = { projectId: string; canvasId: string; nodeId: string };

export const load = ({ locals, params }: ServerLoadEvent<EditorParams>) => loadEditorSession(locals, params);

const editorCtx = (scope: MotionEditorScope): EditorCtx => ({
  ...scope,
  actor: { kind: 'user', id: scope.userId },
  gate: async () => {
    const denied = await gateOrgAiActionForForm(scope.orgId);
    return denied ? { status: denied.status, body: denied.data } : null;
  }
});

const answered = (answer: EditorAnswer) => (answer.status >= HTTP_BAD_REQUEST ? fail(answer.status, answer.body) : answer.body);

export const actions: Actions<EditorParams> = {
  save: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    let doc: unknown;
    try {
      doc = JSON.parse(String(form.get('doc') ?? ''));
    } catch {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid_doc' });
    }
    return answered(await runEditorOp('save_doc', editorCtx(scope), { version: Number(form.get('version')), doc, summary: String(form.get('summary') ?? '') }));
  },

  ops: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const input = { version: Number(form.get('version')), ops: parsedJson(String(form.get('ops') ?? '')), summary: String(form.get('summary') ?? '') };
    return answered(await runEditorOp('apply_ops', editorCtx(scope), input));
  },

  head: async ({ locals, params }) => answered(await runEditorOp('read_head', editorCtx(await scopeFor(locals, params)), {})),

  revisions: async ({ locals, params }) => answered(await runEditorOp('list_revisions', editorCtx(await scopeFor(locals, params)), {})),

  branches: async ({ locals, params }) => answered(await runEditorOp('list_branches', editorCtx(await scopeFor(locals, params)), {})),

  createBranch: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const input = EDITOR_OPS.create_branch.input.safeParse({ name: (await request.formData()).get('name') });
    return input.success ? answered(await runEditorOp('create_branch', editorCtx(scope), input.data)) : fail(HTTP_BAD_REQUEST, { error: 'invalid_branch_name' });
  },

  reviewBranch: async ({ locals, params }) => answered(await runEditorOp('review_branch', editorCtx(await scopeFor(locals, params)), {})),

  mergeBranch: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const input = EDITOR_OPS.merge_branch.input.safeParse({ choices: parsedJson(String((await request.formData()).get('choices') ?? '{}')) });
    return input.success ? answered(await runEditorOp('merge_branch', editorCtx(scope), input.data)) : fail(HTTP_BAD_REQUEST, { error: 'invalid_choices' });
  },

  dropBranch: async ({ locals, params }) => answered(await runEditorOp('drop_branch', editorCtx(await scopeFor(locals, params)), {})),

  restore: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const version = Number((await request.formData()).get('version'));
    return answered(await runEditorOp('restore_revision', editorCtx(scope), { version }));
  },

  nameVersion: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('name_revision', editorCtx(scope), { version: Number(form.get('version')), name: String(form.get('name') ?? '') }));
  },

  exported: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const input = { path: String(form.get('path') ?? ''), width: Number(form.get('width')), height: Number(form.get('height')), seconds: Number(form.get('seconds')) };
    return answered(await runEditorOp('record_export', editorCtx(scope), input));
  },

  poster: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    return savePoster(scope.db, { orgId: scope.orgId, projectId: params.projectId, nodeId: scope.motion.record.id, actor: { kind: 'user', id: scope.userId }, form: await request.formData() });
  },

  still: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('export_still', editorCtx(scope), { format: form.get('format') ?? undefined, scale: form.get('scale') ?? undefined }));
  },

  uploadFont: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('upload_font', editorCtx(scope), { path: String(form.get('path') ?? '') }));
  },

  fonts: async ({ locals, params }) => answered(await runEditorOp('list_fonts', editorCtx(await scopeFor(locals, params)), {})),

  renameFont: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('rename_font', editorCtx(scope), { family: String(form.get('family') ?? ''), to: String(form.get('to') ?? '') }));
  },

  deleteFont: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    return answered(await runEditorOp('delete_font', editorCtx(scope), { family: String((await request.formData()).get('family') ?? '') }));
  },

  analyze: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('analyze_sounds', editorCtx(scope), { assetIds: form.getAll('assetId').map(String) }));
  },

  sound: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const input = { sound: String(form.get('sound')), text: String(form.get('text') ?? ''), seconds: Number(form.get('seconds')) || undefined };
    return answered(await runEditorOp('generate_sound', editorCtx(scope), input));
  },

  render: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const settings = form.get('settings') ? parsedJson(String(form.get('settings'))) : undefined;
    return answered(await runEditorOp('start_render', editorCtx(scope), { version: Number(form.get('version')), settings }));
  },

  renderBatch: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const settings = form.get('settings') ? parsedJson(String(form.get('settings'))) : undefined;
    const input = { version: Number(form.get('version')), settings, rows: parsedJson(String(form.get('rows') ?? '')) };
    return answered(await runEditorOp('render_batch', editorCtx(scope), input));
  },

  templateSounds: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    return answered(await runEditorOp('template_sounds', editorCtx(scope), { doc: parsedJson(String(form.get('doc') ?? '')), clipId: String(form.get('clipId') ?? '') }));
  },

  saveTemplate: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const input = {
      doc: parsedJson(String(form.get('doc') ?? '')),
      compId: String(form.get('compId') ?? '') || null,
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      posterFrame: Number(form.get('posterFrame')) || 0
    };
    return answered(await runEditorOp('save_template', editorCtx(scope), input));
  },

  publishGallery: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const input = { title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''), tags: String(form.get('tags') ?? '') };
    return answered(await runEditorOp('publish_gallery', editorCtx(scope), input));
  },

  withdrawGallery: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    return answered(await runEditorOp('withdraw_gallery', editorCtx(scope), { id: String((await request.formData()).get('id') ?? '') }));
  },

  deleteTemplate: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    return answered(await runEditorOp('delete_template', editorCtx(scope), { id: String((await request.formData()).get('id') ?? '') }));
  },

  batchStatus: async ({ locals, params }) => answered(await runEditorOp('batch_status', editorCtx(await scopeFor(locals, params)), {})),

  cancelRender: async ({ locals, params }) => answered(await runEditorOp('cancel_render', editorCtx(await scopeFor(locals, params)), {})),

  renderStatus: async ({ locals, params }) => answered(await runEditorOp('render_status', editorCtx(await scopeFor(locals, params)), {}))
};

export type EditorPageData = Awaited<ReturnType<typeof load>>;
