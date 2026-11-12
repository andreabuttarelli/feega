import { CtaSectionBlock } from '@/components/arc/blocks/cta-section/cta-section';
import { FaqSectionBlock } from '@/components/arc/blocks/faq-section/faq-section';
import { Cell, Page } from './layout';

export function BlocksMarketingDemo() {
  return (
    <Page columns={1}>
      <Cell title="Call to action">
        <CtaSectionBlock />
      </Cell>

      <Cell title="FAQ section">
        <FaqSectionBlock />
      </Cell>
    </Page>
  );
}
