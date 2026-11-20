import { StructureOp } from '@feega/live-edit/structure';

export type MenuItem = { op: StructureOp; label: string; shortcut: string };

export const MENU_ITEMS: MenuItem[] = [
  { op: StructureOp.Duplicate, label: 'Duplicate', shortcut: '⌘D' },
  { op: StructureOp.Delete, label: 'Delete', shortcut: '⌫' }
];
