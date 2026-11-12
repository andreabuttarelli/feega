import { TextReveal } from '@/components/arc/text-reveal/text-reveal';
import { InViewTitle } from '@/components/arc/in-view-title/in-view-title';
import { TextMorph } from '@/components/arc/text-morph/text-morph';
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer';
import { SlotText } from '@/components/arc/slot-text/slot-text';
import { Cell, Page, Stack } from './layout';

export function TextDemo() {
  return (
    <Page columns={2}>
      <Cell title="Text reveal">
        <TextReveal as="h2" text="Plan the quarter in one place" />
      </Cell>

      <Cell title="In view title">
        <Stack gap={20}>
          <InViewTitle as="h2" variant="word" text="Ship faster with fewer meetings" once />
          <InViewTitle as="h3" variant="tracking" text="Built for teams that move" once />
        </Stack>
      </Cell>

      <Cell title="Text morph">
        <TextMorph as="h3">Northwind Scale plan</TextMorph>
      </Cell>

      <Cell title="Text shimmer">
        <TextShimmer as="p" active={false}>Generating your weekly report</TextShimmer>
      </Cell>

      <Cell title="Slot text">
        <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1 }}>
          <SlotText value="$98,400" duration={0} />
        </div>
      </Cell>
    </Page>
  );
}
