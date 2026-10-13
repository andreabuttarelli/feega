import type { MotionDoc } from '$lib/motion/doc';
import { Product, pieceOf } from '$lib/motion/script';
import { answersCut } from '$lib/motion/cut-review';
import { WEB_TOOLS } from '$lib/server/web/web-tools';
import { DESCRIBE_FRAMES } from './frames';
import { Looks } from './look';

export enum StudioRole {
  Director = 'director',
  ShotBuilder = 'shot-builder',
  Builder = 'builder',
  Fixer = 'fixer',
  Critic = 'critic',
  Copywriter = 'copywriter',
  Viewer = 'viewer',
  Researcher = 'researcher',
  Sound = 'sound'
}

enum ToolScope {
  Research = 'research',
  Sound = 'sound',
  Story = 'story',
  Shots = 'shots',
  All = 'all',
  None = 'none'
}

export const OPUS = 'anthropic/claude-opus-5.5';
export const SONNET = 'anthropic/claude-sonnet-5.5';

export enum RoleModel {
  Opus = 'opus',
  Sonnet = 'sonnet',
  Vision = 'vision'
}

export enum WritesCode {
  Yes = 'yes',
  No = 'no'
}

export type RoleSpec = { label: string; budgetShare: number; tools: ToolScope; model: RoleModel; code: WritesCode; looks: Looks };

export const STUDIO_ROSTER: Record<StudioRole, RoleSpec> = {
  [StudioRole.Director]: { label: 'motion-director', budgetShare: 0.6, tools: ToolScope.Story, model: RoleModel.Opus, code: WritesCode.No, looks: Looks.Blind },
  [StudioRole.ShotBuilder]: { label: 'motion-shots', budgetShare: 0.88, tools: ToolScope.Shots, model: RoleModel.Opus, code: WritesCode.No, looks: Looks.Describes },
  [StudioRole.Builder]: { label: 'motion-agent', budgetShare: 0.88, tools: ToolScope.All, model: RoleModel.Opus, code: WritesCode.Yes, looks: Looks.Describes },
  [StudioRole.Fixer]: { label: 'motion-fixer', budgetShare: 0.5, tools: ToolScope.All, model: RoleModel.Opus, code: WritesCode.Yes, looks: Looks.Describes },
  [StudioRole.Critic]: { label: 'motion-critic', budgetShare: 0.08, tools: ToolScope.None, model: RoleModel.Vision, code: WritesCode.No, looks: Looks.Blind },
  [StudioRole.Copywriter]: { label: 'motion-copywriter', budgetShare: 0.05, tools: ToolScope.None, model: RoleModel.Opus, code: WritesCode.No, looks: Looks.Blind },
  [StudioRole.Viewer]: { label: 'motion-viewer', budgetShare: 0.04, tools: ToolScope.None, model: RoleModel.Vision, code: WritesCode.No, looks: Looks.Blind },
  [StudioRole.Researcher]: { label: 'motion-researcher', budgetShare: 0.35, tools: ToolScope.Research, model: RoleModel.Sonnet, code: WritesCode.No, looks: Looks.Blind },
  [StudioRole.Sound]: { label: 'motion-sound', budgetShare: 0.1, tools: ToolScope.Sound, model: RoleModel.Sonnet, code: WritesCode.No, looks: Looks.Blind }
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

const WRITES_STORY: ReadonlySet<string> = new Set(['write_script', 'write_storyboard', 'update_storyboard_card']);

const SOUND_TOOLS: ReadonlySet<string> = new Set(['get_motion_doc', 'add_music', 'analyze_audio', 'beat_times', 'mark_beats', 'cut_to_beat', 'duck_audio', 'pulse_with_music']);

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
  'mark_story',
  'view_frames',
  DESCRIBE_FRAMES
]);

const SCOPES: Record<ToolScope, (name: string) => boolean> = {
  [ToolScope.Shots]: (name) => SHOT_TOOLS.has(name),
  [ToolScope.Research]: (name) => STORY_TOOLS.has(name) && !WRITES_STORY.has(name),
  [ToolScope.Sound]: (name) => SOUND_TOOLS.has(name),
  [ToolScope.Story]: (name) => STORY_TOOLS.has(name),
  [ToolScope.All]: () => true,
  [ToolScope.None]: () => false
};

const MODELS: Record<RoleModel, (vision: string) => string> = { [RoleModel.Opus]: () => OPUS, [RoleModel.Sonnet]: () => SONNET, [RoleModel.Vision]: (vision) => vision };

export const roleModel = (role: StudioRole, vision: string): string => MODELS[STUDIO_ROSTER[role].model](vision);

export const DRAWS_FIX_RESERVE: ReadonlySet<StudioRole> = new Set([StudioRole.Fixer]);

export const REVIEWED: ReadonlySet<StudioRole> = new Set([StudioRole.Builder, StudioRole.ShotBuilder]);

export const roleBudgetUsd = (role: StudioRole, capUsd: number) => capUsd * STUDIO_ROSTER[role].budgetShare;

export const roleLooks = (role: StudioRole) => STUDIO_ROSTER[role].looks;

export const roleTools = (role: StudioRole, names: readonly string[]) => names.filter(SCOPES[STUDIO_ROSTER[role].tools]);

const NEW_VIDEO = /\b(trailer|promo|launch|teaser|spot|reel|ad|video|filmato)\b/i;

const unbuilt = (doc: Pick<MotionDoc, 'tracks'>) => doc.tracks.every((t) => t.clips.length === 0);

const blank = (doc: Pick<MotionDoc, 'script' | 'tracks'>) => !doc.script && doc.tracks.every((t) => t.clips.length === 0);

const BUILDS: Record<Product, StudioRole> = { [Product.Rebuilt]: StudioRole.ShotBuilder, [Product.Pictured]: StudioRole.Builder, [Product.Absent]: StudioRole.Builder };

export function turnRole(message: string, doc: Pick<MotionDoc, 'script' | 'tracks'>): StudioRole {
  if (answersCut(message)) {
    return StudioRole.Fixer;
  }
  if (blank(doc)) {
    return NEW_VIDEO.test(message) ? StudioRole.Director : StudioRole.Builder;
  }
  return doc.script && unbuilt(doc) ? BUILDS[pieceOf(doc.script).product] : StudioRole.Builder;
}
