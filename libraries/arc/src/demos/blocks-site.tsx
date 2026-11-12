import { SiteHeaderBlock } from '@/components/arc/blocks/site-header/site-header';
import { HeroSectionBlock } from '@/components/arc/blocks/hero-section/hero-section';
import { Cell, Page } from './layout';

export function BlocksSiteDemo() {
  return (
    <Page columns={1}>
      <Cell title="Site header">
        <SiteHeaderBlock />
      </Cell>

      <Cell title="Hero section">
        <HeroSectionBlock />
      </Cell>
    </Page>
  );
}
