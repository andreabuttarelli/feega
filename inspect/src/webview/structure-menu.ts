import { AddKind } from '@feega/live-edit/add-node';
import { StructureOp } from '@feega/live-edit/structure';

export type MenuItem = { id: string; label: string; shortcut?: string };

export const MENU_ITEMS: MenuItem[] = [
  { id: StructureOp.Duplicate, label: 'Duplicate', shortcut: '⌘D' },
  { id: StructureOp.Wrap, label: 'Wrap in container', shortcut: '⌘G' },
  { id: StructureOp.Unwrap, label: 'Unwrap', shortcut: '⇧⌘G' },
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

export const ADD_LOOP_ITEM: MenuItem = { id: StructureOp.AddItem, label: 'Add item' };
