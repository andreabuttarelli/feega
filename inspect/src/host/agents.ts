import { delimiter, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { AgentId } from '../messages';

export enum Probe {
  Binary = 'binary',
  Dir = 'dir',
  App = 'app',
  Extension = 'extension'
}

export type Clue = { probe: Probe; value: string };

export type AgentEnv = {
  path: string[];
  home: string;
  exists: (path: string) => boolean;
  appName: string;
  extensions: string[];
};

export const AGENT_CLUES: Record<AgentId, Clue[]> = {
  [AgentId.ClaudeCode]: [{ probe: Probe.Binary, value: 'claude' }, { probe: Probe.Dir, value: '.claude' }],
  [AgentId.Cursor]: [{ probe: Probe.App, value: 'cursor' }, { probe: Probe.Binary, value: 'cursor' }],
  [AgentId.Codex]: [{ probe: Probe.Binary, value: 'codex' }, { probe: Probe.Dir, value: '.codex' }],
  [AgentId.Windsurf]: [{ probe: Probe.App, value: 'windsurf' }, { probe: Probe.Binary, value: 'windsurf' }],
  [AgentId.Copilot]: [{ probe: Probe.Extension, value: 'github.copilot' }, { probe: Probe.Extension, value: 'github.copilot-chat' }],
  [AgentId.Gemini]: [{ probe: Probe.Binary, value: 'gemini' }, { probe: Probe.Dir, value: '.gemini' }]
};

const PROBES: Record<Probe, (env: AgentEnv, value: string) => boolean> = {
  [Probe.Binary]: (env, value) => env.path.some((dir) => env.exists(join(dir, value))),
  [Probe.Dir]: (env, value) => env.exists(join(env.home, value)),
  [Probe.App]: (env, value) => env.appName.toLowerCase().includes(value),
  [Probe.Extension]: (env, value) => env.extensions.includes(value)
};

export const seen = (env: AgentEnv, { probe, value }: Clue): boolean => {
  try {
    return PROBES[probe](env, value);
  } catch {
    return false;
  }
};

export const detectAgents = (env: AgentEnv): AgentId[] => (Object.values(AgentId) as AgentId[]).filter((id) => AGENT_CLUES[id].some((clue) => seen(env, clue)));

export const machineEnv = (appName = '', extensions: string[] = []): AgentEnv => ({ path: (process.env.PATH ?? '').split(delimiter), home: homedir(), exists: existsSync, appName, extensions });

export const machineAgents = (appName = '', extensions: string[] = []): AgentId[] => detectAgents(machineEnv(appName, extensions));
