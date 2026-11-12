import { Input } from '@/components/arc/input/input';
import { Textarea } from '@/components/arc/textarea/textarea';
import { SearchField } from '@/components/arc/search-field/search-field';
import { PasswordField } from '@/components/arc/password-field/password-field';
import { PasswordStrength } from '@/components/arc/password-strength/password-strength';
import { NumberField } from '@/components/arc/number-field/number-field';
import { MoneyInput } from '@/components/arc/money-input/money-input';
import { PhoneInput } from '@/components/arc/phone-input/phone-input';
import { OtpInput } from '@/components/arc/otp-input/otp-input';
import { TagInput } from '@/components/arc/tag-input/tag-input';
import { MentionInput, type MentionValue } from '@/components/arc/mention-input/mention-input';
import { InlineEdit } from '@/components/arc/inline-edit/inline-edit';
import { ScrubInput } from '@/components/arc/scrub-input/scrub-input';
import { Cell, Page, Stack } from './layout';

const noop = () => {};

const MENTION_TEXT = 'Looping in @Priya Nair and #launch-q3 before the Friday freeze.';

const MENTION_VALUE: MentionValue = {
  text: MENTION_TEXT,
  mentions: [
    { kind: 'person', id: 'priya', label: 'Priya Nair', start: MENTION_TEXT.indexOf('@Priya'), end: MENTION_TEXT.indexOf('@Priya') + '@Priya Nair'.length },
    { kind: 'channel', id: 'launch', label: 'launch-q3', start: MENTION_TEXT.indexOf('#launch'), end: MENTION_TEXT.indexOf('#launch') + '#launch-q3'.length }
  ]
};

const PEOPLE = [
  { id: 'priya', name: 'Priya Nair', role: 'Head of Design' },
  { id: 'tomas', name: 'Tomas Ferreira', role: 'Staff Engineer' },
  { id: 'lena', name: 'Lena Okafor', role: 'Product Manager' }
];

const CHANNELS = [
  { id: 'launch', name: 'launch-q3', description: 'Q3 launch coordination', members: 42 },
  { id: 'support', name: 'support-escalations', description: 'Tier 2 handoffs', members: 18 }
];

export function FormsDemo() {
  return (
    <Page columns={3}>
      <Cell title="Input">
        <Stack>
          <Input label="Work email" type="email" defaultValue="maya.chen@northwind.app" description="We send invoices here." />
          <Input label="Workspace URL" defaultValue="northwind" error="That workspace name is already taken." />
        </Stack>
      </Cell>

      <Cell title="Textarea">
        <Textarea label="Release notes" rows={4} defaultValue="Faster board loading, new CSV export and a fix for duplicate notifications on mobile." description="Shown to every customer in the changelog." />
      </Cell>

      <Cell title="Search field">
        <SearchField label="Search projects" value="Q3 roadmap" onValueChange={noop} placeholder="Search projects" />
      </Cell>

      <Cell title="Password field">
        <PasswordField label="Password" defaultValue="northwind-2026" description="At least 12 characters." />
      </Cell>

      <Cell title="Password strength">
        <PasswordStrength label="Create password" defaultValue="Nw!Board2026" />
      </Cell>

      <Cell title="Number field">
        <Stack>
          <NumberField label="Seats" defaultValue={25} min={1} max={500} step={5} description="Billed monthly per seat." />
          <NumberField label="Discount" defaultValue={15} min={0} max={100} suffix="%" />
        </Stack>
      </Cell>

      <Cell title="Money input">
        <MoneyInput label="Annual contract value" defaultValue={4800000} defaultCurrency="USD" currencies={['USD', 'EUR', 'GBP']} quickAdd={[1000, 5000]} />
      </Cell>

      <Cell title="Phone input">
        <PhoneInput label="Mobile number" defaultCountry="US" defaultValue="+14155550142" />
      </Cell>

      <Cell title="OTP input">
        <OtpInput label="Verification code" description="Sent to maya.chen@northwind.app" value="482915" onChange={noop} />
      </Cell>

      <Cell title="Tag input">
        <TagInput label="Labels" defaultValue={['billing', 'enterprise', 'q3-renewal']} placeholder="Add a label" />
      </Cell>

      <Cell title="Mention input" span={2}>
        <MentionInput defaultValue={MENTION_VALUE} people={PEOPLE} channels={CHANNELS} aria-label="Post an update" minRows={3} />
      </Cell>

      <Cell title="Inline edit">
        <Stack>
          <InlineEdit label="Project name" value="Northwind Mobile Redesign" onSave={noop} variant="title" as="h3" />
          <InlineEdit label="Project summary" value="Rebuild the iOS and Android checkout flow ahead of the November release." onSave={noop} multiline />
        </Stack>
      </Cell>

      <Cell title="Scrub input" span={2}>
        <Stack>
          <ScrubInput label="Corner radius" defaultValue={12} min={0} max={64} unit="px" />
          <ScrubInput label="Opacity" defaultValue={85} min={0} max={100} unit="%" track />
        </Stack>
      </Cell>
    </Page>
  );
}
