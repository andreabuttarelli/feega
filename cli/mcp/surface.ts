export const FIND_TOOLS = 'find_tools';
export const LOAD_TOOLS = 'load_tools';
export const UNLOAD_TOOLS = 'unload_tools';
export const DESCRIBE = 'describe';
export const LOADED_CAP = 40;
export const SESSIONS_CAP = 500;
export const FOUND_MAX = 25;

export enum ToolFamily {
  Canvas = 'canvas',
  Frame = 'frame',
  Editor = 'editor',
  Motion = 'motion',
  Templates = 'templates',
  Storyboard = 'storyboard',
  Generation = 'generation',
  Effects = 'effects',
  Data = 'data',
  Gallery = 'gallery',
  Layouts = 'layouts',
  Team = 'team',
  Legacy = 'legacy'
}

export const EDIT_FAMILIES: ReadonlySet<string> = new Set([ToolFamily.Canvas, ToolFamily.Frame, ToolFamily.Editor]);

const DESCRIBE_HINT = 'Schema: `describe`.';

export const CORE_TOOLS: Readonly<Record<string, string>> = {
  query: `Read any org table (free): {table, columns?, where?, order?, limit?, offset?, count?, embed?}. ${DESCRIBE_HINT}`,
  view: `See a canvas (free), as {op, input}: canvas_summary {canvas_id} | get {id, frame_id?} | activity {canvas_id} | list_history {canvas_id, author?} | snapshot {node_id, time?} (an image), e.g. {op: "snapshot", input: {node_id, time: 2}}. ${DESCRIBE_HINT}`,
  edit: `Change a canvas, its nodes and frames: {op, target?, element?, input?, version?, project_id?}, or op "batch" with ops[]. Also runs any tool below by name: {op: "<tool>", input}. ${DESCRIBE_HINT}`,
  [DESCRIBE]: 'Free. {} lists the tools and the op families; {family} names its ops; {op} or {ops:[...]} give exact input schemas.',
  render_video: `Render a motion video to MP4: {node_id, mode?}. Poll get_render. ${DESCRIBE_HINT}`,
  get_render: 'State of a render: {run_id}; done carries file_url.',
  list_orgs: 'Your orgs; pass `org` to other tools when you have several.',
  [FIND_TOOLS]: `Search every tool and op by keywords, best match first: {query?, family?}. Free. Then ${LOAD_TOOLS} or call via edit.`,
  [LOAD_TOOLS]: `Add tools to this session's list by name (several at once); at most ${LOADED_CAP}, oldest drop. Free.`,
  [UNLOAD_TOOLS]: 'Drop loaded tools from this session\'s list: {names}.'
};

export const TOOL_FAMILY: Readonly<Record<string, ToolFamily>> = {
  list_motion_videos: ToolFamily.Motion,
  get_motion_run: ToolFamily.Motion,
  get_motion_summary: ToolFamily.Motion,
  motion_budget: ToolFamily.Motion,
  list_motion_revisions: ToolFamily.Motion,
  export_code: ToolFamily.Motion,
  restore_motion_revision: ToolFamily.Motion,
  view_motion_frames: ToolFamily.Motion,
  share_motion_frame: ToolFamily.Motion,
  get_play_link: ToolFamily.Motion,
  publish_motion_embed: ToolFamily.Motion,
  get_motion_embed: ToolFamily.Motion,
  list_shader_effects: ToolFamily.Motion,
  list_motion_templates: ToolFamily.Templates,
  new_motion_from_template: ToolFamily.Templates,
  add_motion_template: ToolFamily.Templates,
  get_storyboard: ToolFamily.Storyboard,
  write_storyboard: ToolFamily.Storyboard,
  edit_storyboard_card: ToolFamily.Storyboard,
  run_node_generation: ToolFamily.Generation,
  enhance_prompt: ToolFamily.Generation,
  run_node_loop: ToolFamily.Generation,
  preview_node_loop: ToolFamily.Generation,
  cancel_node_loop: ToolFamily.Generation,
  get_media: ToolFamily.Generation,
  list_effects: ToolFamily.Effects,
  write_effect: ToolFamily.Effects,
  patch_effect: ToolFamily.Effects,
  apply_effects: ToolFamily.Effects,
  make_effects_pair: ToolFamily.Effects,
  insert_row: ToolFamily.Data,
  update_row: ToolFamily.Data,
  delete_row: ToolFamily.Data,
  describe_node_types: ToolFamily.Data,
  search_gallery: ToolFamily.Gallery,
  remix_gallery_item: ToolFamily.Gallery,
  publish_to_gallery: ToolFamily.Gallery,
  studio_quote: ToolFamily.Generation,
  studio_start: ToolFamily.Generation,
  studio_status: ToolFamily.Generation,
  studio_run: ToolFamily.Generation,
  studio_more: ToolFamily.Generation,
  studio_cancel: ToolFamily.Generation,
  studio_retry: ToolFamily.Generation,
  studio_regenerate: ToolFamily.Generation,
  studio_approve: ToolFamily.Generation,
  studio_reject: ToolFamily.Generation,
  list_layouts: ToolFamily.Layouts,
  write_layout: ToolFamily.Layouts,
  patch_layout: ToolFamily.Layouts,
  list_team: ToolFamily.Team,
  team_op: ToolFamily.Team,
  model_allowlist: ToolFamily.Team,
  org_fonts: ToolFamily.Team,
  spend_caps: ToolFamily.Team,
  get_app_account: ToolFamily.Team,
  forget_app_account: ToolFamily.Team,
  cloud: ToolFamily.Team,
  figma_token_status: ToolFamily.Team,
  canvas_tool: ToolFamily.Legacy,
  canvas_file: ToolFamily.Canvas,
  motion_tool: ToolFamily.Legacy,
  motion_editor_op: ToolFamily.Legacy
};

export type Findable = { name: string; family: string; summary?: string };

const NAME_WEIGHT = 3;

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function score(query: string, entry: Findable): number {
  const named = entry.name.replace(/_/g, ' ');
  const described = (entry.summary ?? '').toLowerCase();
  return words(query).reduce((sum, w) => sum + (named.includes(w) ? NAME_WEIGHT : 0) + (described.includes(w) ? 1 : 0), 0);
}

export function rank(entries: readonly Findable[], query?: string, family?: string): Findable[] {
  const inFamily = family ? entries.filter((e) => e.family === family) : [...entries];
  if (!query) {
    return inFamily;
  }
  return inFamily
    .map((entry) => ({ entry, score: score(query, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, FOUND_MAX)
    .map((r) => r.entry);
}

export type RemoteTool = { name: string; family: string; description: string; inputSchema: Record<string, unknown> };

export class LoadedSet {
  private readonly names: string[] = [];
  readonly remote = new Map<string, RemoteTool>();

  add(names: readonly string[]): string[] {
    for (const name of names) {
      this.drop([name]);
      this.names.push(name);
    }
    const evicted = this.names.splice(0, Math.max(0, this.names.length - LOADED_CAP));
    for (const name of evicted) {
      this.remote.delete(name);
    }
    return evicted;
  }

  drop(names: readonly string[]): void {
    for (const name of names) {
      const at = this.names.indexOf(name);
      if (at >= 0) {
        this.names.splice(at, 1);
      }
    }
  }

  forget(names: readonly string[]): void {
    this.drop(names);
    for (const name of names) {
      this.remote.delete(name);
    }
  }

  has(name: string): boolean {
    return this.names.includes(name);
  }

  list(): string[] {
    return [...this.names];
  }
}

const sessions = new Map<string, LoadedSet>();

export function sessionLoaded(key: string): LoadedSet {
  const found = sessions.get(key) ?? new LoadedSet();
  sessions.delete(key);
  sessions.set(key, found);
  for (const oldest of sessions.keys()) {
    if (sessions.size <= SESSIONS_CAP) {
      break;
    }
    sessions.delete(oldest);
  }
  return found;
}

export const STDIO_SESSION = 'stdio';
