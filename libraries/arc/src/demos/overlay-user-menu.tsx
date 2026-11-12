import { UserMenu } from '@/components/arc/user-menu/user-menu';
import { artwork, Cell, Page } from './layout';

const PAGE_MIN_HEIGHT = 420;

const noop = () => {};

const USER = { name: 'Maya Chen', email: 'maya.chen@northwind.app', plan: 'Scale', avatarSrc: artwork(2) };

export function OverlayUserMenuDemo() {
  return (
    <Page columns={1}>
      <Cell title="User menu" minHeight={PAGE_MIN_HEIGHT}>
        <UserMenu user={USER} defaultOpen portal={false} onSignOut={noop} items={[{ label: 'Profile' }, { label: 'Billing' }, { label: 'Team settings' }]} />
      </Cell>
    </Page>
  );
}
