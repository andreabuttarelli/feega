import { NotificationCenter } from '@/components/arc/notification-center/notification-center';
import { artwork, Cell, Page } from './layout';

const PAGE_MIN_HEIGHT = 720;

const NOTIFICATIONS = [
  { id: 'n1', title: 'Priya Nair commented on Checkout redesign', description: 'Can we try a single-column layout on mobile?', time: '2m ago', actor: { name: 'Priya Nair', photo: artwork(0) } },
  { id: 'n2', title: 'Deploy to production succeeded', description: 'Northwind web v4.2.1 is live in 3 regions.', time: '1h ago', tone: 'success' as const },
  { id: 'n3', title: 'Invoice INV-2048 is overdue', description: 'Acme Logistics, $4,800.00 due Nov 8.', time: 'Yesterday', tone: 'warning' as const, read: true }
];

export function OverlayNotificationsDemo() {
  return (
    <Page columns={1}>
      <Cell title="Notification center" minHeight={PAGE_MIN_HEIGHT}>
        <NotificationCenter notifications={NOTIFICATIONS} open />
      </Cell>
    </Page>
  );
}
