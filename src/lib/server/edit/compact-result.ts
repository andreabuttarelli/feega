export enum Detail {
  Compact = 'compact',
  Verbose = 'verbose'
}

export enum Surface {
  Edit = 'edit',
  Rows = 'rows',
  ChatCanvas = 'chat_canvas',
  ChatFrame = 'chat_frame'
}

type FullPath = { hint: string; tools: string[]; option?: string };

export const FULL_PATH: Readonly<Record<Surface, FullPath>> = {
  [Surface.Edit]: { hint: 'edit again with verbose:true', tools: ['edit'], option: 'verbose' },
  [Surface.Rows]: { hint: 'repeat the call with verbose:true', tools: ['insert_row', 'update_row'], option: 'verbose' },
  [Surface.ChatCanvas]: { hint: 'list_nodes {canvasId} returns whole nodes', tools: ['list_nodes'] },
  [Surface.ChatFrame]: { hint: 'frame_tool again with verbose:true', tools: ['frame_tool'], option: 'verbose' }
};

export type CompactAsk = { touched: string[]; surface: Surface; detail?: Detail };

const STRING_CAP = 300;
const VALUE_CAP = 300;
const ARRAY_CAP = 20;
const BLOCK_CAP = 2_000;
const DATA_URI = /^data:[^;,]+(;[^,]*)?,/;
const LINK = /^https?:\/\/\S+$/;

const IDENTITY_FIELDS = ['id', 'type', 'version', 'status', 'display_name', 'canvas_id'];
const NOISE_FIELDS = new Set(['org_id', 'project_id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'actor_kind', 'actor_id', 'agent_key']);

type Plain = Record<string, unknown>;

class Cuts {
  count = 0;

  constructor(readonly hint: string) {}
}

const isPlain = (value: unknown): value is Plain => value !== null && typeof value === 'object' && !Array.isArray(value);

const isEntity = (value: unknown): value is Plain => isPlain(value) && typeof value.id === 'string' && ('version' in value || 'type' in value || 'canvas_id' in value);

const REFUSING_OUTCOMES = ['invalid', 'conflict', 'not_found', 'refused'];

const isRefusal = (value: unknown) => isPlain(value) && (typeof value.error === 'string' || (typeof value.outcome === 'string' && REFUSING_OUTCOMES.includes(value.outcome)));

const marker = (chars: number, cuts: Cuts) => `[${chars} chars, whole: ${cuts.hint}]`;

function shrunk(value: unknown, cuts: Cuts, cap: number): unknown {
  if (typeof value === 'string') {
    if (!DATA_URI.test(value) && (value.length <= cap || LINK.test(value))) {
      return value;
    }
    cuts.count++;
    return marker(value.length, cuts);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const chars = Array.isArray(value) ? 0 : JSON.stringify(value).length;
  if (chars > BLOCK_CAP) {
    cuts.count++;
    return marker(chars, cuts);
  }
  if (Array.isArray(value)) {
    const kept = value.slice(0, ARRAY_CAP).map((item) => shrunk(item, cuts, cap));
    if (value.length <= ARRAY_CAP) {
      return kept;
    }
    cuts.count++;
    return [...kept, `+${value.length - ARRAY_CAP} more`];
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shrunk(item, cuts, cap)]));
}

function trimmedValue(value: unknown, cuts: Cuts): unknown {
  if (value === null || typeof value !== 'object') {
    return shrunk(value, cuts, VALUE_CAP);
  }
  const chars = JSON.stringify(value).length;
  if (chars > VALUE_CAP) {
    cuts.count++;
    return marker(chars, cuts);
  }
  return value;
}

function entityView(entity: Plain, touched: string[], cuts: Cuts): Plain {
  const wanted = new Set([...IDENTITY_FIELDS, ...touched]);
  const view: Plain = {};
  for (const [key, value] of Object.entries(entity)) {
    if (wanted.has(key)) {
      view[key] = trimmedValue(value, cuts);
      continue;
    }
    if (!NOISE_FIELDS.has(key) && value !== null && value !== undefined) {
      cuts.count++;
    }
  }
  return view;
}

function collapsed(value: unknown, touched: string[], cuts: Cuts): unknown {
  if (Array.isArray(value)) {
    const kept = value.slice(0, ARRAY_CAP).map((item) => collapsed(item, touched, cuts));
    if (value.length <= ARRAY_CAP) {
      return kept;
    }
    cuts.count++;
    return [...kept, `+${value.length - ARRAY_CAP} more`];
  }
  if (isEntity(value)) {
    return entityView(value, touched, cuts);
  }
  if (isPlain(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, collapsed(item, touched, cuts)]));
  }
  return shrunk(value, cuts, STRING_CAP);
}

const insideRoot = (root: unknown, cuts: Cuts): unknown =>
  isPlain(root) ? Object.fromEntries(Object.entries(root).map(([key, item]) => [key, shrunk(item, cuts, STRING_CAP)])) : shrunk(root, cuts, STRING_CAP);

export function trimBlobs(value: unknown, hint: string): unknown {
  return insideRoot(value, new Cuts(hint));
}

export function compactWrite(body: unknown, { touched, surface, detail = Detail.Compact }: CompactAsk): unknown {
  if (detail === Detail.Verbose || isRefusal(body) || !isPlain(body)) {
    return body;
  }
  const cuts = new Cuts(FULL_PATH[surface].hint);
  const compact = insideRoot(collapsed(body, touched, cuts), cuts) as Plain;
  return cuts.count > 0 ? { ...compact, trimmed: true, whole: cuts.hint } : compact;
}

export const touchedOf = (input: unknown): string[] => {
  const keys = isPlain(input) ? Object.keys(input) : [];
  const data = isPlain(input) && isPlain(input.data) ? ['data'] : [];
  const values = isPlain(input) && isPlain(input.values) ? Object.keys(input.values) : [];
  return [...new Set([...keys, ...data, ...values])];
};
