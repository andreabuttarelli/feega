import { describe, expect, it } from 'vitest';
import { Stored } from './platform';
import { HintSurface, SKILL_COMMAND, hintDue, needsSkillHint, terminalTip, type HintFs } from './skill-hint';

const HOME = '/home/me';
const APP = '/work/app';
const WORKSPACE = '/work';

const fsOf = (files: Record<string, string>): HintFs => ({
  exists: (path) => path in files || Object.keys(files).some((file) => file.startsWith(`${path}/`)),
  text: (path) => files[path],
  entries: (path) => [...new Set(Object.keys(files).filter((file) => file.startsWith(`${path}/`)).map((file) => file.slice(path.length + 1).split('/')[0]))]
});

const needs = (files: Record<string, string>) => needsSkillHint(fsOf(files), { roots: [APP, WORKSPACE], home: HOME });

describe('needsSkillHint', () => {
  it('stays quiet for a project with no agent traces', () => {
    expect(needs({ [`${APP}/package.json`]: '{}' })).toBe(false);
  });

  it.each(['CLAUDE.md', 'AGENTS.md', '.claude/settings.json', '.cursor/rules', '.codex/config.toml', '.agents/notes'])('shows for an agent project marked by %s in the app root', (marker) => {
    expect(needs({ [`${APP}/${marker}`]: '' })).toBe(true);
  });

  it('shows for a marker in the workspace root', () => {
    expect(needs({ [`${WORKSPACE}/AGENTS.md`]: '' })).toBe(true);
  });

  it.each([
    `${APP}/.claude/skills/feega/SKILL.md`,
    `${WORKSPACE}/.agents/skills/feega/SKILL.md`,
    `${APP}/.cursor/skills/feega/SKILL.md`,
    `${HOME}/.claude/skills/feega/SKILL.md`,
    `${HOME}/.agents/skills/feega/SKILL.md`
  ])('stays quiet when the skill is at %s', (skill) => {
    expect(needs({ [`${APP}/CLAUDE.md`]: '', [skill]: '' })).toBe(false);
  });

  it('stays quiet when skills-lock.json lists feega', () => {
    expect(needs({ [`${APP}/CLAUDE.md`]: '', [`${APP}/skills-lock.json`]: '{"skills":{"feega":{}}}' })).toBe(false);
  });

  it('shows when skills-lock.json lists other skills only', () => {
    expect(needs({ [`${APP}/CLAUDE.md`]: '', [`${APP}/skills-lock.json`]: '{"skills":{"seo":{}}}' })).toBe(true);
  });

  it('stays quiet when the Claude plugin cache holds feega', () => {
    expect(needs({ [`${APP}/CLAUDE.md`]: '', [`${HOME}/.claude/plugins/cache/feega/feega/0.1.0/plugin.json`]: '' })).toBe(false);
  });

  it('shows when the Claude plugin cache holds other plugins only', () => {
    expect(needs({ [`${APP}/CLAUDE.md`]: '', [`${HOME}/.claude/plugins/cache/other/tool/1/plugin.json`]: '' })).toBe(true);
  });
});

type Memory = { stored: Map<Stored, unknown>; never: boolean };

const platformOf = (files: Record<string, string>, surface: HintSurface, memory: Memory = { stored: new Map(), never: false }) => ({
  memory,
  platform: {
    stored: <T>(key: Stored) => memory.stored.get(key) as T | undefined,
    store: async (key: Stored, value: unknown) => void memory.stored.set(key, value),
    skillHint: { fs: fsOf(files), home: HOME, surface, never: () => memory.never }
  }
});

const AGENT_PROJECT = { [`${APP}/CLAUDE.md`]: '' };

describe('hintDue', () => {
  it('is due for an agent project without the skill', () => {
    expect(hintDue(platformOf(AGENT_PROJECT, HintSurface.Panel).platform, [APP])).toBe(true);
  });

  it('is not due once dismissed for the project', () => {
    const { platform, memory } = platformOf(AGENT_PROJECT, HintSurface.Panel);
    memory.stored.set(Stored.SkillHint, true);
    expect(hintDue(platform, [APP])).toBe(false);
  });

  it('is not due when the user chose never', () => {
    const { platform, memory } = platformOf(AGENT_PROJECT, HintSurface.Panel);
    memory.never = true;
    expect(hintDue(platform, [APP])).toBe(false);
  });

  it('is not due for a platform without the hint', () => {
    expect(hintDue({ stored: () => undefined, store: async () => undefined }, [APP])).toBe(false);
  });
});

describe('terminalTip', () => {
  const run = (interactive: boolean) => {
    const made = platformOf(AGENT_PROJECT, HintSurface.Terminal);
    return { ...made, tip: () => terminalTip({ platform: made.platform, roots: [APP], interactive }) };
  };

  it('names the command', async () => {
    expect(await run(true).tip()).toContain(`Tip: let your agent drive Feega — ${SKILL_COMMAND}`);
  });

  it('shows once per project', async () => {
    const { tip } = run(true);
    await tip();
    expect(await tip()).toBeNull();
  });

  it('never shows without a TTY', async () => {
    const { tip, memory } = run(false);
    expect(await tip()).toBeNull();
    expect(memory.stored.has(Stored.SkillHint)).toBe(false);
  });

  it('stays out of a panel platform', async () => {
    const { platform } = platformOf(AGENT_PROJECT, HintSurface.Panel);
    expect(await terminalTip({ platform, roots: [APP], interactive: true })).toBeNull();
  });
});
