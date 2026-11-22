import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Stored, type Platform } from './platform';

export const SKILL_COMMAND = 'npx skills add andreabuttarelli/feega';

const SKILL_NAME = 'feega';
const LOCK_FILE = 'skills-lock.json';
const PLUGIN_CACHE = join('.claude', 'plugins', 'cache');
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

export enum HintSurface {
  Panel = 'panel',
  Terminal = 'terminal'
}

export type HintFs = {
  exists: (path: string) => boolean;
  text: (path: string) => string | undefined;
  entries: (path: string) => string[];
};

export type SkillHintHost = {
  fs: HintFs;
  home: string;
  surface: HintSurface;
  never?: () => boolean;
  setNever?: () => Promise<unknown>;
};

type Where = { roots: string[]; home: string };

type Rule = (fs: HintFs, where: Where) => boolean;

const AGENT_MARKERS = ['CLAUDE.md', 'AGENTS.md', '.claude', '.cursor', '.codex', '.agents'];

const PROJECT_SKILLS = [join('.claude', 'skills', SKILL_NAME, 'SKILL.md'), join('.agents', 'skills', SKILL_NAME, 'SKILL.md'), join('.cursor', 'skills', SKILL_NAME)];

const HOME_SKILLS = [join('.claude', 'skills', SKILL_NAME), join('.agents', 'skills', SKILL_NAME)];

const anyAt = (fs: HintFs, bases: string[], names: string[]) => bases.some((base) => names.some((name) => fs.exists(join(base, name))));

const INSTALLED: Rule[] = [
  (fs, { roots }) => anyAt(fs, roots, PROJECT_SKILLS),
  (fs, { home }) => anyAt(fs, [home], HOME_SKILLS),
  (fs, { roots }) => roots.some((root) => fs.text(join(root, LOCK_FILE))?.includes(SKILL_NAME) ?? false),
  (fs, { home }) => fs.entries(join(home, PLUGIN_CACHE)).some((marketplace) => marketplace.includes(SKILL_NAME) || fs.entries(join(home, PLUGIN_CACHE, marketplace)).some((plugin) => plugin.includes(SKILL_NAME)))
];

export const needsSkillHint = (fs: HintFs, where: Where) => anyAt(fs, where.roots, AGENT_MARKERS) && !INSTALLED.some((rule) => rule(fs, where));

export const nodeHintFs: HintFs = {
  exists: existsSync,
  text: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  },
  entries: (path) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  }
};

export const nodeSkillHint = (surface: HintSurface): SkillHintHost => ({ fs: nodeHintFs, home: homedir(), surface });

type Hinting = Pick<Platform, 'stored' | 'store'> & { skillHint?: SkillHintHost };

export function hintDue(platform: Hinting, roots: string[]): boolean {
  const host = platform.skillHint;
  if (!host || platform.stored(Stored.SkillHint) || host.never?.()) {
    return false;
  }
  return needsSkillHint(host.fs, { roots, home: host.home });
}

export async function terminalTip({ platform, roots, interactive }: { platform: Hinting; roots: string[]; interactive: boolean }): Promise<string | null> {
  if (!interactive || platform.skillHint?.surface !== HintSurface.Terminal || !hintDue(platform, roots)) {
    return null;
  }
  await platform.store(Stored.SkillHint, true);
  return `${DIM}Tip: let your agent drive Feega — ${SKILL_COMMAND}${RESET}`;
}
