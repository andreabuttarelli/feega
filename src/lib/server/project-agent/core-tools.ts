import { asSchema, jsonSchema, tool, type Tool } from 'ai';

export const CORE_LINES: Readonly<Record<string, string>> = {
  list_nodes: 'Nodes of a canvas: {canvasId}. Read before update_node or run_node (version).',
  create_node: 'Create a node: {canvasId, type, x, y, displayName?, data?}. Data per describe_node_types.',
  update_node: 'Patch a node\'s data: {nodeId, data}. Only changed fields; null removes one.',
  run_node: 'Generate into a node, spends credits, only if asked: {nodeId, medium, prompt?, model?, expectedVersion}.',
  canvas_tool: 'Any other canvas op: {op, input, verbose?}. describe_tools {names:["canvas_tool"]} lists the ops.',
  create_motion_video: 'Create an empty motion video frame on the canvas.',
  ask_motion_agent: 'Hand a motion video request to the motion agent: {nodeId, request, media?}. Then get_motion_run.',
  get_motion_run: 'State of a motion agent run: {runId, waitSeconds?}.'
};

const ENUM_CAP = 12;
const DROPPED_KEYS = new Set(['description', 'title', '$schema', 'default', 'examples']);

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

const NESTED_KEYS = new Set(['properties', 'required', 'additionalProperties']);

export function slimSchema(schema: unknown, depth = 0): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => slimSchema(item, depth));
  }
  if (!isObject(schema)) {
    return schema;
  }
  const bigEnum = Array.isArray(schema.enum) && schema.enum.length > ENUM_CAP;
  const nested = depth > 0;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !DROPPED_KEYS.has(key) && !(bigEnum && key === 'enum') && !(nested && NESTED_KEYS.has(key)))
      .map(([key, value]) => {
        if (key === 'properties' && isObject(value)) {
          return [key, Object.fromEntries(Object.entries(value).map(([name, field]) => [name, slimSchema(field, depth + 1)]))];
        }
        return [key, slimSchema(value, key === 'items' ? depth + 1 : depth)];
      })
  );
}

export function slimTool(original: Tool, line: string): Tool {
  const full = asSchema(original.inputSchema);
  return tool({
    description: line,
    inputSchema: jsonSchema(slimSchema(full.jsonSchema) as never),
    execute: async (input: unknown, options) => {
      const checked = await full.validate?.(input);
      if (checked && !checked.success) {
        return { error: 'invalid_input', message: checked.error.message, fix: 'describe_tools {names:[<this tool>]} gives its exact schema.' };
      }
      return original.execute!((checked && checked.success ? checked.value : input) as never, options);
    }
  });
}

export const slimCore = (core: Record<string, Tool>): Record<string, Tool> =>
  Object.fromEntries(Object.entries(CORE_LINES).filter(([name]) => name in core).map(([name, line]) => [name, slimTool(core[name], line)]));

const SENTENCE_END = /(?<=[.!?])\s/;
const LINE_MAX_CHARS = 140;

export function firstLine(description: string): string {
  const sentence = description.split(SENTENCE_END)[0];
  return sentence.length > LINE_MAX_CHARS ? `${sentence.slice(0, LINE_MAX_CHARS - 1)}…` : sentence;
}
