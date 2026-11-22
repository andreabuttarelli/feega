import { AddKind, AddPlace } from '@feega/live-edit/add-node';
import { StructureOp } from '@feega/live-edit/structure';
import { WrapTag } from '@feega/live-edit/wrap-node';

export type MenuItem = { id: string; label: string; shortcut?: string; items?: MenuItem[]; single?: boolean };

export const COPY_FOR_AGENT = 'copy-for-agent';
export const ADD_CHILD_PREFIX = 'add-child:';
export const WRAP_PREFIX = 'wrap:';

export enum Command {
  Copy = 'copy',
  Structure = 'structure',
  Add = 'add',
  Wrap = 'wrap'
}

export type Picked = { command: Command.Copy } | { command: Command.Structure; op: StructureOp } | { command: Command.Add; kind: AddKind; place: AddPlace } | { command: Command.Wrap; tag: WrapTag };

export const ADD_ITEMS: MenuItem[] = [
  { id: AddKind.Text, label: 'Text' },
  { id: AddKind.Heading, label: 'Heading' },
  { id: AddKind.Button, label: 'Button' },
  { id: AddKind.Link, label: 'Link' },
  { id: AddKind.Image, label: 'Image' },
  { id: AddKind.Container, label: 'Container' }
];

export const WRAP_ITEMS: MenuItem[] = [
  { id: WrapTag.Div, label: 'Div', shortcut: '⌘G' },
  { id: WrapTag.Section, label: 'Section' },
  { id: WrapTag.Article, label: 'Article' },
  { id: WrapTag.Nav, label: 'Nav' },
  { id: WrapTag.Header, label: 'Header' },
  { id: WrapTag.Footer, label: 'Footer' },
  { id: WrapTag.Link, label: 'Link' },
  { id: WrapTag.Button, label: 'Button' }
];

const prefixed = (prefix: string, items: MenuItem[]): MenuItem[] => items.map((item) => ({ ...item, id: prefix + item.id }));

export const MENU_ITEMS: MenuItem[] = [
  { id: COPY_FOR_AGENT, label: 'Copy for agent' },
  { id: StructureOp.Duplicate, label: 'Duplicate', shortcut: '⌘D' },
  { id: 'add-child', label: 'Add as child', items: prefixed(ADD_CHILD_PREFIX, ADD_ITEMS), single: true },
  { id: 'wrap-with', label: 'Wrap with', items: prefixed(WRAP_PREFIX, WRAP_ITEMS) },
  { id: StructureOp.Unwrap, label: 'Unwrap', shortcut: '⇧⌘G' },
  { id: StructureOp.Delete, label: 'Delete', shortcut: '⌫' }
];

export const menuFor = (selected: number): MenuItem[] => MENU_ITEMS.filter((item) => !item.single || selected === 1);

export const ADD_LOOP_ITEM: MenuItem = { id: StructureOp.AddItem, label: 'Add item' };

export function pickedOf(id: string): Picked {
  if (id === COPY_FOR_AGENT) {
    return { command: Command.Copy };
  }
  if (id.startsWith(ADD_CHILD_PREFIX)) {
    return { command: Command.Add, kind: id.slice(ADD_CHILD_PREFIX.length) as AddKind, place: AddPlace.Child };
  }
  if (id.startsWith(WRAP_PREFIX)) {
    return { command: Command.Wrap, tag: id.slice(WRAP_PREFIX.length) as WrapTag };
  }
  return { command: Command.Structure, op: id as StructureOp };
}

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Row = { left: number; right: number; top: number };

const EDGE_GAP = 8;

export function fitMenu(at: Point, menu: Size, view: Size): Point {
  return {
    x: Math.max(0, Math.min(at.x, view.width - menu.width - EDGE_GAP)),
    y: Math.max(0, Math.min(at.y, view.height - menu.height - EDGE_GAP))
  };
}

export function submenuSpot(row: Row, menu: Size, view: Size): Point {
  const flips = row.right + menu.width + EDGE_GAP > view.width;
  return fitMenu({ x: flips ? row.left - menu.width : row.right, y: row.top }, menu, view);
}
