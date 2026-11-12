import { FileText, Folder, Info, Plus, Settings, Users } from 'lucide-react';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { Button } from '@/components/arc/button/button';
import { CommandPalette } from '@/components/arc/command-palette/command-palette';
import { AutoTrigger, Cell, Page } from './layout';

const CELL_HEIGHT = 160;
const ICON_SIZE = 16;
const TOOLTIP_OFFSET = 56;

const COMMANDS = [
  { id: 'new-project', label: 'New project', group: 'Create', icon: <Plus size={ICON_SIZE} />, shortcut: 'N' },
  { id: 'new-doc', label: 'New document', group: 'Create', icon: <FileText size={ICON_SIZE} />, shortcut: 'D' },
  { id: 'open-files', label: 'Open files', group: 'Navigate', icon: <Folder size={ICON_SIZE} />, shortcut: 'F' },
  { id: 'team', label: 'Go to team', group: 'Navigate', icon: <Users size={ICON_SIZE} /> },
  { id: 'settings', label: 'Workspace settings', group: 'Navigate', icon: <Settings size={ICON_SIZE} />, shortcut: ',' }
];

export function OverlayTooltipDemo() {
  return (
    <Page columns={1}>
      <Cell title="Tooltip" minHeight={CELL_HEIGHT / 2}>
        <div style={{ paddingTop: TOOLTIP_OFFSET }}>
          <AutoTrigger kind="focus">
            <Tooltip content="Syncs every 5 minutes" side="top">
              <Button variant="secondary">
                <Info size={ICON_SIZE} /> Sync status
              </Button>
            </Tooltip>
          </AutoTrigger>
        </div>
      </Cell>

      <Cell title="Command palette">
        <CommandPalette items={COMMANDS} placeholder="Search commands" />
      </Cell>
    </Page>
  );
}
