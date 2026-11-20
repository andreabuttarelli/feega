import { AddKind } from '@feega/live-edit/add-node';
import { StructureOp } from '@feega/live-edit/structure';

export type MenuItem = { id: string; label: string; shortcut?: string };

export const MENU_ITEMS: MenuItem[] = [
  { id: StructureOp.Duplicate, label: 'Duplicate', shortcut: '⌘D' },
  { id: StructureOp.Delete, label: 'Delete', shortcut: '⌫' }
];

export const ADD_ITEMS: MenuItem[] = [
  { id: AddKind.Text, label: 'Text' },
  { id: AddKind.Heading, label: 'Heading' },
  { id: AddKind.Button, label: 'Button' },
  { id: AddKind.Link, label: 'Link' },
  { id: AddKind.Image, label: 'Image' },
  { id: AddKind.Container, label: 'Container' }
];
