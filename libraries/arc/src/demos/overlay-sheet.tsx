import { BottomSheet, BottomSheetClose } from '@/components/arc/bottom-sheet/bottom-sheet';
import { Button } from '@/components/arc/button/button';
import { Cell, Page, Stack } from './layout';

const PAGE_MIN_HEIGHT = 720;

const SHARE_TARGETS = ['Copy link to the board', 'Send to #design-review', 'Email to client', 'Export as PDF'];

export function OverlaySheetDemo() {
  return (
    <Page columns={1}>
      <Cell title="Bottom sheet" minHeight={PAGE_MIN_HEIGHT}>
        <BottomSheet
          defaultOpen
          trigger={<Button variant="secondary">Share board</Button>}
          title="Share Q4 launch board"
          description="Choose where to send the latest snapshot."
        >
          <Stack gap={8}>
            {SHARE_TARGETS.map((target) => (
              <BottomSheetClose key={target} asChild>
                <Button variant="ghost">{target}</Button>
              </BottomSheetClose>
            ))}
          </Stack>
        </BottomSheet>
      </Cell>
    </Page>
  );
}
