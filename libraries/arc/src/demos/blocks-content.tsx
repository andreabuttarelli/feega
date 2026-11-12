import { BlogGridBlock } from '@/components/arc/blocks/blog-grid/blog-grid';
import { Cell, Page } from './layout';

export function BlocksContentDemo() {
  return (
    <Page columns={1}>
      <Cell title="Blog grid">
        <BlogGridBlock />
      </Cell>
    </Page>
  );
}
