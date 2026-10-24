import { describe, it, expect } from 'vitest';
import { asSchema, type Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { createMotionDelegation } from './motion-delegation';
import { frameRunner } from './frame-tools';
import { LOADED_CAP, LOAD_TOOLS, ToolLoading, frameSurface } from './tool-loading';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };
const FRAME_TOOLS_MAX_CHARS = 4_000;
const CANVAS_CHAT_MAX_CHARS = 32_000;
const EDITOR_TO_FRAME_TOOLS_RATIO = 35;
const CORE_MAX_CHARS = 29_000;
const CATALOGUE_TO_CORE_RATIO = 6;

async function promptChars(tools: Record<string, Tool>): Promise<number> {
  const sizes = await Promise.all(Object.entries(tools).map(async ([name, t]) => name.length + String(t.description ?? '').length + JSON.stringify(await asSchema(t.inputSchema).jsonSchema).length));
  return sizes.reduce((a, b) => a + b, 0);
}

describe('the canvas chat offers a small core and loads the rest', () => {
  const { db } = fakeDb({});
  const deps = { db, ...SCOPE, open: null, editor: null };
  const core = { ...createProjectTools({ db, ...SCOPE }), ...createMotionDelegation({ db, ...SCOPE, origin: 'https://feega.test' }) };
  const made = frameSurface(ToolLoading.Load, deps, frameRunner(deps), core, []);
  const offered = (tools: Record<string, Tool>, names: string[]) => Object.fromEntries(names.map((n) => [n, tools[n]]));

  it('the core stays under its budget', async () => {
    const { tools, active } = await made;

    expect(await promptChars(offered({ ...core, ...tools }, active()!))).toBeLessThan(CORE_MAX_CHARS);
  });

  it('the catalogue it reaches is several times the core', async () => {
    const { tools, active } = await made;

    expect(await promptChars(tools)).toBeGreaterThan((await promptChars(offered({ ...core, ...tools }, active()!))) * CATALOGUE_TO_CORE_RATIO);
  });

  it('never offers more than the loaded cap on top of the core', async () => {
    const { tools, active } = await made;
    const frameNames = Object.keys(tools).filter((n) => !n.endsWith('_tools'));

    await tools[LOAD_TOOLS].execute!({ names: frameNames.slice(0, LOADED_CAP) } as never, { toolCallId: 'a', messages: [] } as never);
    await tools[LOAD_TOOLS].execute!({ names: frameNames.slice(LOADED_CAP, LOADED_CAP + 5) } as never, { toolCallId: 'b', messages: [] } as never);

    expect(active()!.filter((n) => frameNames.includes(n))).toHaveLength(LOADED_CAP);
  });
});

