import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

const SOURCES = ['src/lib/motion', 'src/lib/server/motion'].map((dir) => join(process.cwd(), dir));
const TOOL_SHAPED = /\b(?:add|set|list|get|apply|remove|view|read|write|patch|edit|render|register|analyze|import|move|trim|mark|cut|duck|pulse|freeze|morph|expose|unexpose|insert|detach|save|generate|use|export|parent|arrange)_[a-z_]+\b/g;
const NOT_TOOLS: ReadonlySet<string> = new Set(['parent_id', 'render_in_progress', 'render_unavailable', 'render_unsupported', 'render_not_found', 'render_url']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|svelte)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

type Run = (name: string, input: unknown) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run: Run = async (name, input) => {
    const found = tools[name] as (Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }) | undefined;
    if (!found) {
      return { ok: false, error: `no tool ${name}` };
    }
    return found.execute(input, { toolCallId: 'c' });
  };
  return { tools, run };
}

describe('a tool named to the agent is a tool it has', () => {
  it('every tool-shaped name in the motion sources and prompt is a real tool', () => {
    const { tools } = setup();
    const named = new Set(SOURCES.flatMap(sourceFiles).flatMap((file) => readFileSync(file, 'utf8').match(TOOL_SHAPED) ?? []));
    const missing = [...named].filter((name) => !NOT_TOOLS.has(name) && !(name in tools));

    expect(missing).toEqual([]);
  });

  it('a missing font names a tool that, called with just the family, lets the clip in', async () => {
    const { run } = setup();
    const clip = { component: 'Title', start: 0, duration: 2, props: { text: 'Hi', font: 'Inter' } };

    const refused = await run('add_clip', clip);
    const suggested = /call (\w+)/.exec(String(refused.error))?.[1] ?? '';
    const registered = await run(suggested, { family: 'Inter' });

    expect(refused.ok).toBe(false);
    expect(registered.ok).toBe(true);
    expect((await run('add_clip', clip)).ok).toBe(true);
  });
});
