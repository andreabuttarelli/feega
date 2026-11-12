import { Alert } from '@/components/arc/alert/alert';
import { Progress } from '@/components/arc/progress/progress';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter';
import { OnboardingChecklist } from '@/components/arc/onboarding-checklist/onboarding-checklist';
import { Stepper } from '@/components/arc/stepper/stepper';
import { Countdown } from '@/components/arc/countdown/countdown';
import { AnnouncementBar } from '@/components/arc/announcement-bar/announcement-bar';
import { Cell, Page, Stack } from './layout';

const NOW = Date.UTC(2026, 10, 12, 9, 0, 0);
const LAUNCH = Date.UTC(2026, 10, 19, 17, 30, 0);

const USAGE_SEGMENTS = [
  { id: 'storage', label: 'Documents', value: 38 },
  { id: 'media', label: 'Media', value: 27 },
  { id: 'backups', label: 'Backups', value: 14 }
];

const CHECKLIST_STEPS = [
  { id: 'profile', title: 'Complete your profile', description: 'Add a photo and your job title.' },
  { id: 'invite', title: 'Invite your team', description: 'Northwind works best with three or more people.', actionLabel: 'Invite teammates' },
  { id: 'integration', title: 'Connect Slack', description: 'Get board updates in the channel you already use.', actionLabel: 'Connect' },
  { id: 'board', title: 'Create your first board' }
];

const STEPS = [
  { id: 'account', label: 'Account', description: 'Create your login' },
  { id: 'workspace', label: 'Workspace', description: 'Name your team' },
  { id: 'billing', label: 'Billing', description: 'Choose a plan' },
  { id: 'launch', label: 'Launch', description: 'Invite and go live' }
];

const ANNOUNCEMENTS = [
  { id: 'summit', message: 'Northwind Summit 2026 tickets are open', action: { label: 'Reserve a seat', href: '#' } },
  { id: 'api', message: 'The v3 API is now generally available', action: { label: 'Read the docs', href: '#' } }
];

export function FeedbackDemo() {
  return (
    <Page columns={2}>
      <Cell title="Announcement bar" span={2}>
        <AnnouncementBar id="northwind-demo-bar" messages={ANNOUNCEMENTS} autoPlay={false} dismissible={false} />
      </Cell>

      <Cell title="Alert">
        <Stack>
          <Alert tone="info" title="Scheduled maintenance">Northwind will be read-only on Saturday from 02:00 to 02:30 UTC.</Alert>
          <Alert tone="success" title="Payment received">Invoice INV-2048 for $4,800.00 was paid.</Alert>
          <Alert tone="warning" title="Seats almost full">You are using 24 of 25 seats on the Team plan.</Alert>
          <Alert tone="danger" title="Sync failed">We could not reach your Salesforce account. Reconnect to resume syncing.</Alert>
        </Stack>
      </Cell>

      <Cell title="Progress and usage">
        <Stack gap={24}>
          <Progress label="Importing contacts" value={72} showValue />
          <Progress label="Profile completeness" value={40} showValue />
          <UsageMeter label="Storage" segments={USAGE_SEGMENTS} limit={100} unit="GB" />
        </Stack>
      </Cell>

      <Cell title="Skeleton">
        <Skeleton label="Loading comments" lines={3} avatar />
      </Cell>

      <Cell title="Countdown">
        <Stack gap={24}>
          <Countdown target={LAUNCH} clock={() => NOW} label="Time until the Northwind 5.0 launch" />
          <Countdown target={LAUNCH} clock={() => NOW} variant="compact" label="Early bird pricing ends in" units={['days', 'hours', 'minutes']} />
        </Stack>
      </Cell>

      <Cell title="Onboarding checklist">
        <OnboardingChecklist title="Get started with Northwind" steps={CHECKLIST_STEPS} defaultCompleted={['profile']} />
      </Cell>

      <Cell title="Stepper">
        <Stack gap={32}>
          <Stepper steps={STEPS} current={1} label="Setup progress" />
          <Stepper steps={STEPS} current={2} orientation="vertical" label="Setup progress, vertical" details="current" />
        </Stack>
      </Cell>
    </Page>
  );
}
