import { describe, expect, test } from 'bun:test';
import { handleMcpFetch } from './http-app.ts';
import { CORE_TOOLS, LOADED_CAP, LoadedSet, TOOL_FAMILY, ToolFamily } from './surface.ts';

const LIST_MAX_CHARS = 8_000;
const TOOL_MAX_CHARS = 600;
const FAMILY_MAX_CHARS = 6_000;
const UNLISTED_ALIASES = ['ask_motion_agent'];

type Tool = { name: string; description?: string; inputSchema?: Record<string, unknown> };
type Rpc = { result?: { tools?: Tool[]; content?: { text?: string }[]; isError?: boolean; capabilities?: { tools?: { listChanged?: boolean } } } };

let nextSession = 0;

function client() {
  const session = `test-${++nextSession}-${Date.now()}`;
  let id = 0;
  const rpc = async (method: string, params: unknown): Promise<Rpc> =>
    (await handleMcpFetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'mcp-session-id': session },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
      })
    )).json();
  const init = () => rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'slim', version: '0' } });
  const list = async () => (await rpc('tools/list', {})).result?.tools ?? [];
  const call = async (name: string, args: Record<string, unknown>) => (await rpc('tools/call', { name, arguments: args })).result;
  return { rpc, init, list, call };
}

const size = (value: unknown) => JSON.stringify(value).length;

describe('the MCP list weighs little', () => {
  test('a new session lists only the core', async () => {
    const c = client();
    await c.init();

    expect((await c.list()).map((t) => t.name).sort()).toEqual(Object.keys(CORE_TOOLS).sort());
  });

  test(`the whole list stays under ${LIST_MAX_CHARS} chars, each tool under ${TOOL_MAX_CHARS}`, async () => {
    const c = client();
    await c.init();
    const tools = await c.list();

    console.log(`tools/list: ${size({ tools })} chars, ${tools.length} tools`);
    expect(size({ tools })).toBeLessThan(LIST_MAX_CHARS);
    for (const tool of tools) {
      expect(size(tool), tool.name).toBeLessThan(TOOL_MAX_CHARS);
    }
  });

  test('advertises tools.listChanged', async () => {
    const c = client();

    expect((await c.init()).result?.capabilities?.tools?.listChanged).toBe(true);
  });

  test(`every family, loaded whole, stays under ${FAMILY_MAX_CHARS} chars`, async () => {
    for (const family of Object.values(ToolFamily)) {
      const names = Object.keys(TOOL_FAMILY).filter((n) => TOOL_FAMILY[n] === family);
      if (names.length === 0) {
        continue;
      }
      const c = client();
      await c.init();
      await c.call('load_tools', { names });
      const loaded = (await c.list()).filter((t) => names.includes(t.name));

      expect(loaded.map((t) => t.name).sort(), family).toEqual([...names].sort());
      expect(size(loaded), family).toBeLessThan(FAMILY_MAX_CHARS);
      for (const tool of loaded) {
        expect(size(tool), tool.name).toBeLessThan(TOOL_MAX_CHARS);
      }
    }
  });
});

describe('nothing is lost: every tool stays reachable', () => {
  test('every registered tool is core, in a family, or a declared alias', async () => {
    const c = client();
    await c.init();
    const described = (await c.call('describe', {}))?.content?.[0]?.text ?? '';
    const local = (JSON.parse(described) as { tools: { name: string }[] }).tools.map((t) => t.name);

    expect(local.sort()).toEqual(Object.keys(TOOL_FAMILY).sort());
  });

  test('view says its call shape: the op arguments go inside input', async () => {
    const c = client();
    await c.init();
    const view = (await c.list()).find((t) => t.name === 'view');

    expect(view?.description).toContain('{op: "snapshot", input: {node_id');
  });

  test('describe answers its JSON once, as text, not again as structuredContent', async () => {
    const c = client();
    await c.init();
    const described = (await c.call('describe', {})) as { structuredContent?: unknown } | undefined;

    expect(described?.structuredContent).toBeUndefined();
  });

  test('a hidden tool is still callable by its old name', async () => {
    const c = client();
    await c.init();
    const result = await c.call('list_layouts', {});

    expect(result?.content?.[0]?.text ?? '').not.toMatch(/not found/);
  });

  test('the motion agent is no longer listed nor loadable, only callable', async () => {
    const c = client();
    await c.init();
    await c.call('load_tools', { names: UNLISTED_ALIASES });

    expect((await c.list()).map((t) => t.name)).not.toContain('ask_motion_agent');
    expect((await c.call('ask_motion_agent', {}))?.content?.[0]?.text ?? '').not.toMatch(/not found/);
  });

  test('edit runs a hidden tool by name', async () => {
    const c = client();
    await c.init();
    const direct = await c.call('describe_node_types', {});
    const routed = await c.call('edit', { op: 'describe_node_types', input: {} });

    expect(routed?.content?.[0]?.text).toBe(direct?.content?.[0]?.text);
  });

  test('describe gives the full description and schema of a hidden tool', async () => {
    const c = client();
    await c.init();
    const text = (await c.call('describe', { op: 'canvas_tool' }))?.content?.[0]?.text ?? '';

    expect(text).toContain('Deprecated, use `edit`');
    expect(text).toContain('input_schema');
  });

  test('a wrong call answers the exact schema', async () => {
    const c = client();
    await c.init();
    const result = await c.call('get_render', {});

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain('Schema: {');
    expect(result?.content?.[0]?.text).toContain('run_id');
  });

  test('an unknown tool points to find_tools', async () => {
    const c = client();
    await c.init();

    expect((await c.call('no_such_tool', {}))?.content?.[0]?.text).toContain('find_tools');
  });
});

describe('a session loads and unloads tools', () => {
  test('load_tools lists them, unload_tools drops them, other sessions unaffected', async () => {
    const a = client();
    const b = client();
    await a.init();
    await b.init();

    await a.call('load_tools', { names: ['list_layouts', 'write_layout'] });
    expect((await a.list()).map((t) => t.name)).toContain('write_layout');
    expect((await b.list()).map((t) => t.name)).not.toContain('write_layout');

    await a.call('unload_tools', { names: ['write_layout'] });
    expect((await a.list()).map((t) => t.name)).not.toContain('write_layout');
    expect((await a.list()).map((t) => t.name)).toContain('list_layouts');
  });

  test('find_tools ranks by name first', async () => {
    const c = client();
    await c.init();
    const text = (await c.call('find_tools', { query: 'layout' }))?.content?.[0]?.text ?? '{}';
    const found = (JSON.parse(text) as { tools: { name: string }[] }).tools.map((t) => t.name);

    expect(found.slice(0, 3).sort()).toEqual(['list_layouts', 'patch_layout', 'write_layout']);
  });

  test(`at most ${LOADED_CAP} stay loaded, the oldest drop first`, () => {
    const set = new LoadedSet();
    const names = Array.from({ length: LOADED_CAP + 2 }, (_, i) => `t${i}`);

    const evicted = set.add(names);

    expect(evicted).toEqual(['t0', 't1']);
    expect(set.list()).toHaveLength(LOADED_CAP);
    set.add(['t2']);
    expect(set.list().at(-1)).toBe('t2');
  });
});
