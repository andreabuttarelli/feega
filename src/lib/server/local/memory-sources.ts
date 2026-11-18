import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';

enum Root {
  Home = 'home',
  Cwd = 'cwd'
}

type Source = { id: string; label: string; root: Root; path: string };

export type FoundSource = { id: string; label: string; path: string; bytes: number };

export type Places = { home: string; cwd: string };

const SOURCE_MAX_BYTES = 200 * 1024;

const SOURCES: readonly Source[] = [
  { id: 'claude', label: 'Claude Code', root: Root.Home, path: '.claude/CLAUDE.md' },
  { id: 'codex', label: 'Codex', root: Root.Home, path: '.codex/AGENTS.md' },
  { id: 'gemini', label: 'Gemini CLI', root: Root.Home, path: '.gemini/GEMINI.md' },
  { id: 'opencode', label: 'opencode', root: Root.Home, path: '.config/opencode/AGENTS.md' },
  { id: 'cursor', label: 'Cursor', root: Root.Home, path: '.cursor/rules' },
  { id: 'project-claude', label: 'Project CLAUDE.md', root: Root.Cwd, path: 'CLAUDE.md' },
  { id: 'project-agents', label: 'Project AGENTS.md', root: Root.Cwd, path: 'AGENTS.md' }
];

const defaultPlaces = (): Places => ({ home: homedir(), cwd: process.cwd() });

const absolute = (source: Source, places: Places) => join(source.root === Root.Home ? places.home : places.cwd, source.path);

async function usableBytes(file: string): Promise<number> {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size === 0 || info.size > SOURCE_MAX_BYTES) {
      return 0;
    }
    return info.size;
  } catch {
    return 0;
  }
}

export async function foundSources(places = defaultPlaces()): Promise<FoundSource[]> {
  const checked = await Promise.all(
    SOURCES.map(async (source) => {
      const path = absolute(source, places);
      return { id: source.id, label: source.label, path, bytes: await usableBytes(path) };
    })
  );
  return checked.filter((found) => found.bytes > 0);
}

export async function readSources(ids: readonly string[], places = defaultPlaces()): Promise<string> {
  const chosen = SOURCES.filter((source) => ids.includes(source.id));
  const sections: string[] = [];

  for (const source of chosen) {
    const path = absolute(source, places);
    if ((await usableBytes(path)) === 0) {
      continue;
    }

    const text = (await readFile(path, 'utf8')).trim();
    sections.push(`## ${source.label}\n\n${text}`);
  }

  return sections.join('\n\n').slice(0, MEMORY_MAX_CHARS);
}
