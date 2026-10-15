const HTTP_BAD_REQUEST = 400;

export enum UploadPurpose {
  Export = 'export',
  Font = 'font'
}

export type OpAsk = { op: string; input: Record<string, unknown> };
export type ActionAsk = OpAsk | { refused: { status: number; body: { error: string } } };

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? '');
const jsonOf = (form: FormData, key: string) => parsedJson(text(form, key));
const optionalJson = (form: FormData, key: string) => (form.get(key) ? jsonOf(form, key) : undefined);
const ask = (op: string, input: Record<string, unknown> = {}): OpAsk => ({ op, input });

function saveAsk(form: FormData): ActionAsk {
  try {
    return ask('save_doc', { version: Number(form.get('version')), doc: JSON.parse(text(form, 'doc')), summary: text(form, 'summary') });
  } catch {
    return { refused: { status: HTTP_BAD_REQUEST, body: { error: 'invalid_doc' } } };
  }
}

export const EDITOR_ACTIONS = {
  save: saveAsk,
  ops: (form: FormData) => ask('apply_ops', { version: Number(form.get('version')), ops: jsonOf(form, 'ops'), summary: text(form, 'summary') }),
  head: () => ask('read_head'),
  revisions: () => ask('list_revisions'),
  restore: (form: FormData) => ask('restore_revision', { version: Number(form.get('version')) }),
  exported: (form: FormData) => ask('record_export', { path: text(form, 'path'), width: Number(form.get('width')), height: Number(form.get('height')), seconds: Number(form.get('seconds')) }),
  still: (form: FormData) => ask('export_still', { format: form.get('format') ?? undefined, scale: form.get('scale') ?? undefined }),
  uploadFont: (form: FormData) => ask('upload_font', { path: text(form, 'path') }),
  analyze: (form: FormData) => ask('analyze_sounds', { assetIds: form.getAll('assetId').map(String) }),
  sound: (form: FormData) => ask('generate_sound', { sound: String(form.get('sound')), text: text(form, 'text'), seconds: Number(form.get('seconds')) || undefined }),
  render: (form: FormData) => ask('start_render', { version: Number(form.get('version')), settings: optionalJson(form, 'settings') }),
  renderBatch: (form: FormData) => ask('render_batch', { version: Number(form.get('version')), settings: optionalJson(form, 'settings'), rows: jsonOf(form, 'rows') }),
  templateSounds: (form: FormData) => ask('template_sounds', { doc: jsonOf(form, 'doc'), clipId: text(form, 'clipId') }),
  saveTemplate: (form: FormData) =>
    ask('save_template', {
      doc: jsonOf(form, 'doc'),
      compId: text(form, 'compId') || null,
      name: text(form, 'name'),
      description: text(form, 'description'),
      posterFrame: Number(form.get('posterFrame')) || 0
    }),
  publishGallery: (form: FormData) => ask('publish_gallery', { title: text(form, 'title'), description: text(form, 'description'), tags: text(form, 'tags') }),
  withdrawGallery: (form: FormData) => ask('withdraw_gallery', { id: text(form, 'id') }),
  deleteTemplate: (form: FormData) => ask('delete_template', { id: text(form, 'id') }),
  batchStatus: () => ask('batch_status'),
  cancelRender: () => ask('cancel_render'),
  renderStatus: () => ask('render_status')
} satisfies Record<string, (form: FormData) => ActionAsk>;

export type EditorActionName = keyof typeof EDITOR_ACTIONS;

export function isEditorAction(name: string): name is EditorActionName {
  return Object.hasOwn(EDITOR_ACTIONS, name);
}

export function actionAsk(name: EditorActionName, form: FormData): ActionAsk {
  return EDITOR_ACTIONS[name](form);
}
