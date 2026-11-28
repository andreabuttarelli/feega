import { isCondition, isOwnership } from './when';

export enum Point {
  RightBar = 'rightBar',
  TopBar = 'topBar',
  AddMenu = 'addMenu',
  ContextMenu = 'contextMenu',
  SidePanel = 'sidePanel',
  Command = 'command',
  Overlay = 'overlay',
  Popover = 'popover'
}

export enum Permission {
  Selection = 'selection',
  Source = 'source',
  Project = 'project',
  EditStyle = 'edit.style',
  EditAttributes = 'edit.attributes',
  EditInsert = 'edit.insert',
  EditDependency = 'edit.dependency',
  EditAsset = 'edit.asset',
  PickFile = 'file.pick'
}

export enum Where {
  Layers = 'layers',
  Preview = 'preview',
  Both = 'both'
}

export type Contribution = { id: string; title?: string; category?: string; where?: Where; html?: string; popover?: string; when?: string[] };

type Field = 'title' | 'category' | 'where' | 'html' | 'popover';

export const POINTS: Record<Point, { required: Field[]; optional: Field[] }> = {
  [Point.RightBar]: { required: ['title'], optional: [] },
  [Point.TopBar]: { required: ['title'], optional: [] },
  [Point.AddMenu]: { required: ['title'], optional: ['category', 'popover'] },
  [Point.ContextMenu]: { required: ['title', 'where'], optional: [] },
  [Point.SidePanel]: { required: ['title', 'html'], optional: [] },
  [Point.Command]: { required: ['title'], optional: [] },
  [Point.Overlay]: { required: [], optional: [] },
  [Point.Popover]: { required: ['title'], optional: [] }
};

export type Manifest = {
  id: string;
  name: string;
  version: string;
  grants: Permission[];
  hosts: string[];
  owns: string[];
  contributions: Partial<Record<Point, Contribution[]>>;
};

export type Parsed = { ok: true; manifest: Manifest } | { ok: false; reason: string };

const ID = /^[a-z0-9][a-z0-9.-]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const NETWORK = 'network:';
const PERMISSIONS = new Set<string>(Object.values(Permission));
const PLACES = new Set<string>(Object.values(Where));
const POINT_NAMES = new Set<string>(Object.values(Point));

const refuse = (reason: string): Parsed => ({ ok: false, reason });

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function permissionsOf(list: unknown): { grants: Permission[]; hosts: string[] } | string {
  const grants: Permission[] = [];
  const hosts: string[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (typeof item === 'string' && PERMISSIONS.has(item)) {
      grants.push(item as Permission);
      continue;
    }
    if (typeof item === 'string' && item.startsWith(NETWORK) && item.length > NETWORK.length) {
      hosts.push(item.slice(NETWORK.length));
      continue;
    }
    return `unknown permission ${JSON.stringify(item)}`;
  }
  return { grants, hosts };
}

function entryProblem(point: Point, entry: unknown, seen: Set<string>): string | null {
  if (!isObject(entry) || !isText(entry.id)) {
    return `${point}: every entry needs an id`;
  }
  if (seen.has(entry.id)) {
    return `${point}: duplicate id ${entry.id}`;
  }
  seen.add(entry.id);
  const missing = POINTS[point].required.find((field) => !isText(entry[field]));
  if (missing) {
    return `${point}/${entry.id}: ${missing} is required`;
  }
  if ('where' in entry && !PLACES.has(String(entry.where))) {
    return `${point}/${entry.id}: where must be one of ${[...PLACES].join(', ')}`;
  }
  if ('when' in entry && !(Array.isArray(entry.when) && entry.when.every((c) => typeof c === 'string' && isCondition(c)))) {
    return `${point}/${entry.id}: when holds unknown conditions`;
  }
  return null;
}

function contributionsOf(raw: unknown): Manifest['contributions'] | string {
  const out: Manifest['contributions'] = {};
  for (const [name, entries] of Object.entries(isObject(raw) ? raw : {})) {
    if (!POINT_NAMES.has(name)) {
      return `unknown contribution point ${name}`;
    }
    const point = name as Point;
    const seen = new Set<string>();
    const list = Array.isArray(entries) ? entries : [];
    const problem = list.map((entry) => entryProblem(point, entry, seen)).find((p) => p !== null);
    if (problem) {
      return problem;
    }
    out[point] = list as Contribution[];
  }
  return out;
}

const missingPopover = (contributions: Manifest['contributions']) => {
  const declared = new Set((contributions[Point.Popover] ?? []).map((entry) => entry.id));
  const ghost = (contributions[Point.AddMenu] ?? []).find((entry) => entry.popover !== undefined && !declared.has(entry.popover));
  return ghost ? `addMenu/${ghost.id}: popover ${ghost.popover} is not declared` : null;
};

export function parseManifest(input: unknown): Parsed {
  if (!isObject(input)) {
    return refuse('the manifest must be an object');
  }
  if (!isText(input.id) || !ID.test(input.id)) {
    return refuse('id must be lowercase letters, digits, dots and dashes');
  }
  if (!isText(input.name)) {
    return refuse('name is required');
  }
  if (!isText(input.version) || !VERSION.test(input.version)) {
    return refuse('version must look like 1.0.0');
  }
  const permissions = permissionsOf(input.permissions);
  if (typeof permissions === 'string') {
    return refuse(permissions);
  }
  const owns = Array.isArray(input.owns) ? input.owns : [];
  if (!owns.every((rule) => typeof rule === 'string' && isOwnership(rule))) {
    return refuse('owns holds unknown rules');
  }
  const contributions = contributionsOf(input.contributions);
  if (typeof contributions === 'string') {
    return refuse(contributions);
  }
  const ghost = missingPopover(contributions);
  if (ghost) {
    return refuse(ghost);
  }
  return { ok: true, manifest: { id: input.id, name: input.name, version: input.version, ...permissions, owns, contributions } };
}
