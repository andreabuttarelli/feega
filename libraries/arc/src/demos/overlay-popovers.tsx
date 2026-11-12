import { Popover, PopoverContent, PopoverTrigger } from '@/components/arc/popover/popover';
import { Button } from '@/components/arc/button/button';
import { Input } from '@/components/arc/input/input';
import { Cell, Page, Stack } from './layout';

const CELL_HEIGHT = 320;

export function OverlayPopoversDemo() {
  return (
    <Page columns={1}>
      <Cell title="Popover" minHeight={CELL_HEIGHT}>
        <Popover defaultOpen>
          <PopoverTrigger asChild>
            <Button variant="secondary">Rename board</Button>
          </PopoverTrigger>
          <PopoverContent>
            <Stack>
              <Input label="Board name" defaultValue="Q4 launch plan" />
              <Button variant="primary" size="sm">Save name</Button>
            </Stack>
          </PopoverContent>
        </Popover>
      </Cell>
    </Page>
  );
}
