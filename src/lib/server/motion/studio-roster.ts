import type { MotionDoc } from '$lib/motion/doc';
import { answersCut } from '$lib/motion/cut-review';
import { WEB_TOOLS } from '$lib/server/web/web-tools';

export enum StudioRole {
  Director = 'director',
  ShotBuilder = 'shot-builder',
  Builder = 'builder',
  Fixer = 'fixer',
  Critic = 'critic',
  Copywriter = 'copywriter'
}

enum ToolScope {
  Story = 'story',
  Shots = 'shots',
  All = 'all',
  None = 'none'
}

export const OPUS = 'anthropic/claude-opus-5.5';

export enum RoleModel {
  Opus = 'opus',
  Vision = 'vision'
}

export enum WritesCode {
  Yes = 'yes',
  No = 'no'
}

export type RoleSpec = { label: string; budgetShare: number; tools: ToolScope; model: RoleModel; code: WritesCode };

export const STUDIO_ROSTER: Record<StudioRole, RoleSpec> = {
  [StudioRole.Director]: { label: 'motion-director', budgetShare: 0.6, tools: ToolScope.Story, model: RoleModel.Opus, code: WritesCode.No },
  [StudioRole.ShotBuilder]: { label: 'motion-shots', budgetShare: 0.88, tools: ToolScope.Shots, model: RoleModel.Opus, code: WritesCode.No },
  [StudioRole.Builder]: { label: 'motion-agent', budgetShare: 0.88, tools: ToolScope.All, model: RoleModel.Opus, code: WritesCode.Yes },
  [StudioRole.Fixer]: { label: 'motion-fixer', budgetShare: 0.5, tools: ToolScope.All, model: RoleModel.Opus, code: WritesCode.Yes },
  [StudioRole.Critic]: { label: 'motion-critic', budgetShare: 0.12, tools: ToolScope.None, model: RoleModel.Vision, code: WritesCode.No },
  [StudioRole.Copywriter]: { label: 'motion-copywriter', budgetShare: 0.05, tools: ToolScope.None, model: RoleModel.Opus, code: WritesCode.No }
};

const STORY_TOOLS: ReadonlySet<string> = new Set([
  ...WEB_TOOLS,
  'get_motion_doc',
  'list_assets',
  'analyze_site',
  'use_brand',
  'import_asset',
  'add_asset',
  'recreate_ui',
  'set_reference_look',
  'write_script',
  'write_storyboard',
  'read_storyboard',
  'update_storyboard_card'
]);

const SHOT_TOOLS: ReadonlySet<string> = new Set([
  ...STORY_TOOLS,
  'list_shots',
  'add_shot',
  'set_props',
  'set_timing',
  'trim_clip',
  'move_clip',
  'remove_clip',
  'set_clip_transition',
  'fit_duration',
  'set_canvas',
  'set_style',
  'list_fonts',
  'set_font',
  'register_font',
  'add_music',
  'analyze_audio',
  'beat_times',
  'mark_beats',
  'cut_to_beat',
  'link_storyboard_beat',
  'view_frames'
]);

const SCOPES: Record<ToolScope, (name: string) => boolean> = {
  [ToolScope.Shots]: (name) => SHOT_TOOLS.has(name),
  [ToolScope.Story]: (name) => STORY_TOOLS.has(name),
  [ToolScope.All]: () => true,
  [ToolScope.None]: () => false
};

export const roleModel = (role: StudioRole, vision: string): string => (STUDIO_ROSTER[role].model === RoleModel.Opus ? OPUS : vision);

export const REVIEWED: ReadonlySet<StudioRole> = new Set([StudioRole.Builder, StudioRole.ShotBuilder]);

export const roleBudgetUsd = (role: StudioRole, capUsd: number) => capUsd * STUDIO_ROSTER[role].budgetShare;

export const roleTools = (role: StudioRole, names: readonly string[]) => names.filter(SCOPES[STUDIO_ROSTER[role].tools]);

const NEW_VIDEO = /\b(trailer|promo|launch|teaser|spot|reel|ad|video|filmato)\b/i;

const unbuilt = (doc: Pick<MotionDoc, 'tracks'>) => doc.tracks.every((t) => t.clips.length === 0);

const blank = (doc: Pick<MotionDoc, 'script' | 'tracks'>) => !doc.script && doc.tracks.every((t) => t.clips.length === 0);

export function turnRole(message: string, doc: Pick<MotionDoc, 'script' | 'tracks'>): StudioRole {
  if (answersCut(message)) {
    return StudioRole.Fixer;
  }
  if (blank(doc)) {
    return NEW_VIDEO.test(message) ? StudioRole.Director : StudioRole.Builder;
  }
  return doc.script && unbuilt(doc) ? StudioRole.ShotBuilder : StudioRole.Builder;
}
