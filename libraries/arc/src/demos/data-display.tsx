import { Avatar } from '@/components/arc/avatar/avatar';
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group';
import { Badge } from '@/components/arc/badge/badge';
import { Card } from '@/components/arc/card/card';
import { MetricCard } from '@/components/arc/metric-card/metric-card';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter';
import { ReorderableList } from '@/components/arc/reorderable-list/reorderable-list';
import { Button } from '@/components/arc/button/button';
import { Inbox } from 'lucide-react';
import { artwork, Cell, Page, Row, Stack } from './layout';

const noop = () => {};

const TEAM = [
  { name: 'Maya Chen', src: artwork(0), status: 'online' as const },
  { name: 'Tomas Ferreira', src: artwork(1) },
  { name: 'Lena Okafor', src: artwork(2), status: 'online' as const },
  { name: 'Priya Nair', src: artwork(3) },
  { name: 'Jonas Weber', src: artwork(4) },
  { name: 'Ana Souza', src: artwork(0) }
];

const PRIORITIES = [
  { id: 'p1', title: 'Ship checkout redesign', detail: 'Due Nov 19, Maya Chen' },
  { id: 'p2', title: 'Migrate billing to Stripe Tax', detail: 'Due Nov 26, Tomas Ferreira' },
  { id: 'p3', title: 'Publish Q4 customer story', detail: 'Due Dec 3, Lena Okafor' },
  { id: 'p4', title: 'Renew SOC 2 audit', detail: 'Due Dec 12, Priya Nair' }
];

const frame = (index: number, label: string) => (
  <img src={artwork(index, label)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
);

export function DataDisplayDemo() {
  return (
    <Page columns={3}>
      <Cell title="Avatar">
        <Row>
          <Avatar name="Maya Chen" src={artwork(0)} size="sm" />
          <Avatar name="Tomas Ferreira" size="md" status="online" />
          <Avatar name="Lena Okafor" src={artwork(2)} size="lg" status="online" />
          <Avatar name="Priya Nair" size="xl" status="offline" />
        </Row>
      </Cell>

      <Cell title="Avatar group">
        <AvatarGroup members={TEAM} max={4} label="Project members" />
      </Cell>

      <Cell title="Badge">
        <Row>
          <Badge tone="success" dot>Active</Badge>
          <Badge tone="warning">Past due</Badge>
          <Badge tone="danger">Failed</Badge>
          <Badge tone="info" pill>Beta</Badge>
          <Badge color="violet" outline>Enterprise</Badge>
          <Badge>Draft</Badge>
        </Row>
      </Cell>

      <Cell title="Metric card">
        <MetricCard label="Monthly recurring revenue" value={98.4} suffix="k" context="vs. $91,200 last month" change="+7.9%" />
      </Cell>

      <Cell title="Animated counter">
        <Stack>
          <AnimatedCounter value={12480} label="Active workspaces" animateOnView={false} />
          <AnimatedCounter value={99.98} decimals={2} suffix="%" label="Uptime, last 90 days" animateOnView={false} />
        </Stack>
      </Cell>

      <Cell title="Empty state">
        <EmptyState
          icon={<Inbox size={24} />}
          title="No invoices yet"
          description="Invoices appear here once your first billing cycle closes."
          action={<Button variant="secondary" size="sm">Create invoice</Button>}
        />
      </Cell>

      <Cell title="Card" span={2}>
        <Card
          title="Checkout redesign"
          description="Single-column mobile flow with Apple Pay and saved cards."
          media={frame(1, 'Checkout')}
          meta="Updated 2 hours ago"
          status="In review"
          avatar={<Avatar name="Maya Chen" src={artwork(0)} size="sm" />}
          action={<Button variant="secondary" size="sm">Open</Button>}
        />
      </Cell>

      <Cell title="Reorderable list">
        <ReorderableList label="Roadmap priorities" items={PRIORITIES} onReorder={noop} />
      </Cell>
    </Page>
  );
}
