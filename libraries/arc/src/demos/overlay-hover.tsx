import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card';
import { artwork, AutoTrigger, Cell, Page } from './layout';

const CELL_HEIGHT = 300;

export function OverlayHoverDemo() {
  return (
    <Page columns={1}>
      <Cell title="Hover card" minHeight={CELL_HEIGHT}>
        <AutoTrigger kind="click">
          <HoverCard
            side="bottom"
            content={
              <HoverCardProfile
                name="Priya Nair"
                role="Head of Design, Northwind"
                avatar={artwork(1)}
                bio="Leads the product design team. Previously at Linear and Figma."
                stats={[
                  { label: 'Projects', value: 18 },
                  { label: 'Reviews', value: 242 }
                ]}
              />
            }
          >
            <button type="button" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
              @priya.nair
            </button>
          </HoverCard>
        </AutoTrigger>
      </Cell>
    </Page>
  );
}
