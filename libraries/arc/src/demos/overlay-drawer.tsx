import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/arc/drawer/drawer';
import { Button } from '@/components/arc/button/button';
import { Switch } from '@/components/arc/switch/switch';
import { Select } from '@/components/arc/select/select';
import { Cell, Page, Row, Stack } from './layout';

const PAGE_MIN_HEIGHT = 720;

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
  { value: 'timeline', label: 'Timeline' }
];

export function OverlayDrawerDemo() {
  return (
    <Page columns={1}>
      <Cell title="Drawer" minHeight={PAGE_MIN_HEIGHT}>
        <Drawer defaultOpen>
          <DrawerTrigger asChild>
            <Button variant="secondary">Project settings</Button>
          </DrawerTrigger>
          <DrawerContent side="right" title="Project settings" description="Changes apply to everyone on Northwind Mobile.">
            <Stack gap={20}>
              <Select label="Default view" options={VIEWS} defaultValue="board" />
              <Switch label="Notify the team on new releases" defaultChecked />
              <Switch label="Archive completed tasks after 30 days" />
              <Row>
                <DrawerClose asChild>
                  <Button variant="ghost">Close</Button>
                </DrawerClose>
                <Button variant="primary">Save settings</Button>
              </Row>
            </Stack>
          </DrawerContent>
        </Drawer>
      </Cell>
    </Page>
  );
}
