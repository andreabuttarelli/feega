import { Copy, LogOut, Pencil, Share2, Trash2, User } from 'lucide-react';
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu';
import { ContextMenu } from '@/components/arc/context-menu/context-menu';
import { AutoTrigger, Cell, Page } from './layout';

const CELL_HEIGHT = 380;
const ICON_SIZE = 16;

const FILE_MENU = [
  { label: 'Rename', icon: <Pencil size={ICON_SIZE} /> },
  { label: 'Duplicate', icon: <Copy size={ICON_SIZE} /> },
  { label: 'Share', icon: <Share2 size={ICON_SIZE} /> },
  { label: 'Delete board', icon: <Trash2 size={ICON_SIZE} />, destructive: true, separatorBefore: true }
];

const CARD_MENU = [
  { id: 'open', label: 'Open in new tab', icon: <User size={ICON_SIZE} /> },
  { id: 'copy', label: 'Copy link', icon: <Copy size={ICON_SIZE} /> },
  { id: 'archive', label: 'Archive task', icon: <LogOut size={ICON_SIZE} /> },
  { id: 'delete', label: 'Delete task', icon: <Trash2 size={ICON_SIZE} />, destructive: true }
];

export function OverlayMenusDemo() {
  return (
    <Page columns={2}>
      <Cell title="Dropdown menu" minHeight={CELL_HEIGHT}>
        <AutoTrigger kind="pointerdown">
          <DropdownMenu label="Board actions" items={FILE_MENU} />
        </AutoTrigger>
      </Cell>

      <Cell title="Context menu" minHeight={CELL_HEIGHT}>
        <AutoTrigger kind="contextmenu">
          <ContextMenu label="Task actions" items={CARD_MENU}>
            <div style={{ width: 240, padding: 20, border: '1px solid var(--border)', borderRadius: 12 }}>
              <strong>Fix checkout rounding bug</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>NW-482, due Nov 14</div>
            </div>
          </ContextMenu>
        </AutoTrigger>
      </Cell>
    </Page>
  );
}
