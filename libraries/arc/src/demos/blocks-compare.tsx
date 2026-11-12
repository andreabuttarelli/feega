import { ChangelogFeed } from '@/components/arc/blocks/changelog-feed/changelog-feed';
import { ComparisonTableBlock } from '@/components/arc/blocks/comparison-table/comparison-table';
import { Cell, Page } from './layout';

export function BlocksCompareDemo() {
  return (
    <Page columns={1}>
      <Cell title="Changelog feed">
        <ChangelogFeed />
      </Cell>

      <Cell title="Comparison table">
        <ComparisonTableBlock />
      </Cell>
    </Page>
  );
}
