import { LogoMarquee } from '@/components/arc/blocks/logo-marquee/logo-marquee';
import { StatsBandBlock } from '@/components/arc/blocks/stats-band/stats-band';
import { SiteFooterBlock } from '@/components/arc/blocks/site-footer/site-footer';
import { Cell, Page } from './layout';

export function BlocksBandDemo() {
  return (
    <Page columns={1}>
      <Cell title="Logo marquee">
        <LogoMarquee />
      </Cell>

      <Cell title="Stats band">
        <StatsBandBlock />
      </Cell>

      <Cell title="Site footer">
        <SiteFooterBlock />
      </Cell>
    </Page>
  );
}
