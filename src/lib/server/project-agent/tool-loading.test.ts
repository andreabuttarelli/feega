import { describe, it, expect } from 'vitest';
import type { Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Turn } from '$lib/server/repos/chat';
import { createProjectTools } from './project-tools';
import { FRAME_TOOL, frameRunner, type FrameAsk } from './frame-tools';
import { CORE_LINES } from './core-tools';
import { DESCRIBE_TOOLS, FIND_TOOLS, LOADED_CAP, LOAD_TOOLS, LoadedSet, ToolLoading, frameSurface, toolLoadingOf, warmTools } from './tool-loading';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };
const CALL = { toolCallId: 'c', messages: [] };

function surface(mode: ToolLoading, turns: Turn[] = []) {
  const { db } = fakeDb({});
  const deps = { db, ...SCOPE, open: null, editor: null };
  const asked: FrameAsk[] = [];
  const runner = { run: async (ask: FrameAsk) => (asked.push(ask), { ran: ask.tool }), seen: new Map() };
  const core = createProjectTools({ db, ...SCOPE });
  return { asked, core, made: frameSurface(mode, deps, runner, core, turns) };
}

const run = (t: Tool, input: unknown) => t.execute!(input as never, CALL as never);

describe('the canvas chat loads frame tools instead of carrying them all', () => {
  it('starts on the core and the loader, no frame tool offered', async () => {
    const { core, made } = surface(ToolLoading.Load);
    const { active } = await made;

    expect(active()).toEqual([...Object.keys(core).filter((name) => name in CORE_LINES), FIND_TOOLS, LOAD_TOOLS, DESCRIBE_TOOLS]);
  });

  it('a project tool outside the core is found, loaded and then offered', async () => {
    const { tools, active } = await surface(ToolLoading.Load).made;

    const found = (await run(tools[FIND_TOOLS], { query: 'connect' })) as { tools: { name: string }[] };
    await run(tools[LOAD_TOOLS], { names: ['connect_nodes'] });

    expect(found.tools.map((t) => t.name)).toContain('connect_nodes');
    expect(active()).toContain('connect_nodes');
  });

  it('a tool kept by the caller stays offered without being loaded', async () => {
    const { db } = fakeDb({});
    const deps = { db, ...SCOPE, open: null, editor: null };
    const runner = { run: async () => ({}), seen: new Map() };
    const core = { ...createProjectTools({ db, ...SCOPE }), ask_reference_pick: createProjectTools({ db, ...SCOPE }).list_nodes };

    const { active } = await frameSurface(ToolLoading.Load, deps, runner, core, [], { ask_reference_pick: core.ask_reference_pick });

    expect(active()).toContain('ask_reference_pick');
  });

  it('describes a core tool by its exact schema, the slim one hides the details', async () => {
    const { tools } = await surface(ToolLoading.Load).made;

    const answer = (await run(tools[DESCRIBE_TOOLS], { names: ['create_node', 'nope'] })) as { tools: { name: string; schema: { properties: Record<string, { description?: string }> } }[]; unknown: string[] };

    expect(answer.tools[0].name).toBe('create_node');
    expect(JSON.stringify(answer.tools[0].schema).length).toBeGreaterThan(JSON.stringify(tools.create_node.inputSchema).length);
    expect(answer.unknown).toEqual(['nope']);
  });

  it('a slim core tool still refuses bad input with the reason', async () => {
    const { tools } = await surface(ToolLoading.Load).made;

    expect(await run(tools.update_node, { nodeId: 3 })).toMatchObject({ error: 'invalid_input' });
  });

  it('offers a loaded tool directly from the next step', async () => {
    const { tools, active } = await surface(ToolLoading.Load).made;

    const answer = await run(tools[LOAD_TOOLS], { names: ['add_clip', 'no_such_tool'] });

    expect(answer).toMatchObject({ loaded: ['add_clip'], unknown: ['no_such_tool'] });
    expect(active()).toContain('add_clip');
  });

  it('finds tools by keyword and says which are loaded', async () => {
    const { tools } = await surface(ToolLoading.Load).made;
    await run(tools[LOAD_TOOLS], { names: ['set_keyframes'] });

    const found = (await run(tools[FIND_TOOLS], { query: 'keyframes' })) as { tools: { name: string; loaded: boolean }[] };

    expect(found.tools.find((t) => t.name === 'set_keyframes')).toMatchObject({ loaded: true });
  });

  it('runs a direct tool on the frame it names, node_id kept out of the tool input', async () => {
    const { asked, made } = surface(ToolLoading.Load);
    const { tools } = await made;

    await run(tools.set_props, { node_id: 'frame-1', clipId: 'a', props: { text: 'hi' } });

    expect(asked).toEqual([{ node_id: 'frame-1', tool: 'set_props', input: { clipId: 'a', props: { text: 'hi' } } }]);
  });

  it('never shadows a core tool with a frame tool of the same name', async () => {
    const { core, made } = surface(ToolLoading.Load);
    const { tools } = await made;

    expect(Object.keys(tools).filter((name) => name in core && !(name in CORE_LINES))).toEqual([]);
  });

  it('keeps the proxy as the only frame surface in proxy mode', async () => {
    const { tools, active } = await surface(ToolLoading.Proxy).made;

    expect(Object.keys(tools)).toContain(FRAME_TOOL);
    expect(active()).toBeUndefined();
  });

  it('reads the mode from its name, load when unset or unknown', () => {
    expect(toolLoadingOf(undefined)).toBe(ToolLoading.Load);
    expect(toolLoadingOf('bogus')).toBe(ToolLoading.Load);
    expect(toolLoadingOf('direct')).toBe(ToolLoading.Direct);
  });
});

describe('a thread keeps its tools warm', () => {
  const used = (...names: string[]): Turn => ({ role: 'assistant', content: '', tools: names.map((toolName, i) => ({ toolCallId: `${i}`, toolName, status: 'done' })) });
  const loadable = new Set(['add_clip', 'set_props', 'set_keyframes', 'add_shape']);

  it('starts a turn with the frame tools of the last three replies', () => {
    const turns = [used('add_shape'), used('add_clip'), { role: 'user' as const, content: 'more' }, used('set_props', 'list_nodes'), used('add_clip')];

    expect(warmTools(turns, loadable)).toEqual(['add_clip', 'set_props']);
  });

  it('counts a tool run through the old proxy as used', () => {
    const turns: Turn[] = [{ role: 'assistant', content: '', tools: [{ toolCallId: '1', toolName: FRAME_TOOL, status: 'done', input: { tool: 'set_keyframes' } }] }];

    expect(warmTools(turns, loadable)).toEqual(['set_keyframes']);
  });

  it('starts warm in the turn itself', async () => {
    const { active } = await surface(ToolLoading.Load, [used('add_clip')]).made;

    expect(active()).toContain('add_clip');
  });

  it('caps the loaded tools, dropping the least recently loaded', () => {
    const set = new LoadedSet(['first']);
    set.add(Array.from({ length: LOADED_CAP }, (_, i) => `t${i}`));

    expect(set.list()).toHaveLength(LOADED_CAP);
    expect(set.list()).not.toContain('first');
  });

  it('moves a reloaded tool to the newest end', () => {
    const set = new LoadedSet(['a', 'b']);
    set.add(['a']);

    expect(set.list()).toEqual(['b', 'a']);
  });
});

describe('the real runner behind direct tools', () => {
  it('asks for a frame when none is open and none is named', async () => {
    const { db } = fakeDb({});
    const runner = frameRunner({ db, ...SCOPE, open: null, editor: null });

    expect(await runner.run({ tool: 'add_clip', input: {} }, 'c')).toMatchObject({ error: 'no_frame' });
  });
});
