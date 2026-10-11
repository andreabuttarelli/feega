import type { MotionDoc } from '$lib/motion/doc';
import { answersCut } from '$lib/motion/cut-review';
import { WEB_TOOLS } from '$lib/server/web/web-tools';

export enum StudioRole {
  Director = 'director',
  Builder = 'builder',
  Fixer = 'fixer',
  Critic = 'critic'
}

enum ToolScope {
  Story = 'story',
  All = 'all',
  None = 'none'
}

export type RoleSpec = { label: string; budgetShare: number; tools: ToolScope };

export const STUDIO_ROSTER: Record<StudioRole, RoleSpec> = {
  [StudioRole.Director]: { label: 'motion-director', budgetShare: 0.6, tools: ToolScope.Story },
  [StudioRole.Builder]: { label: 'motion-agent', budgetShare: 0.88, tools: ToolScope.All },
  [StudioRole.Fixer]: { label: 'motion-fixer', budgetShare: 0.5, tools: ToolScope.All },
  [StudioRole.Critic]: { label: 'motion-critic', budgetShare: 0.12, tools: ToolScope.None }
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

const SCOPES: Record<ToolScope, (name: string) => boolean> = {
  [ToolScope.Story]: (name) => STORY_TOOLS.has(name),
  [ToolScope.All]: () => true,
  [ToolScope.None]: () => false
};

export const roleBudgetUsd = (role: StudioRole, capUsd: number) => capUsd * STUDIO_ROSTER[role].budgetShare;

export const roleTools = (role: StudioRole, names: readonly string[]) => names.filter(SCOPES[STUDIO_ROSTER[role].tools]);

const NEW_VIDEO = /\b(trailer|promo|launch|teaser|spot|reel|ad|video|filmato)\b/i;

const blank = (doc: Pick<MotionDoc, 'script' | 'tracks'>) => !doc.script && doc.tracks.every((t) => t.clips.length === 0);

export function turnRole(message: string, doc: Pick<MotionDoc, 'script' | 'tracks'>): StudioRole {
  if (answersCut(message)) {
    return StudioRole.Fixer;
  }
  return blank(doc) && NEW_VIDEO.test(message) ? StudioRole.Director : StudioRole.Builder;
}
