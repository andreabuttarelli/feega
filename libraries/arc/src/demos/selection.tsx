import { AlignCenter, AlignLeft, AlignRight, Cloud, Globe, Server, Building2, Rocket, Users } from 'lucide-react';
import { Select } from '@/components/arc/select/select';
import { Combobox } from '@/components/arc/combobox/combobox';
import { MultiSelect } from '@/components/arc/multi-select/multi-select';
import { MorphSelect } from '@/components/arc/morph-select/morph-select';
import { Checkbox } from '@/components/arc/checkbox/checkbox';
import { Switch } from '@/components/arc/switch/switch';
import { RadioGroup } from '@/components/arc/radio-group/radio-group';
import { RadioCards } from '@/components/arc/radio-cards/radio-cards';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { ToggleGroup, ToggleGroupItem } from '@/components/arc/toggle-group/toggle-group';
import { ChipGroup } from '@/components/arc/chip-group/chip-group';
import { BillingToggle, BillingPrice } from '@/components/arc/billing-toggle/billing-toggle';
import { Rating } from '@/components/arc/rating/rating';
import { Cell, Page, Row, Stack } from './layout';

const noop = () => {};
const ICON_SIZE = 16;

const REGIONS = [
  { value: 'us-east', label: 'US East (Virginia)' },
  { value: 'eu-west', label: 'EU West (Dublin)' },
  { value: 'ap-south', label: 'Asia Pacific (Singapore)' }
];

const COUNTRIES = [
  { value: 'pt', label: 'Portugal' },
  { value: 'nl', label: 'Netherlands' },
  { value: 'se', label: 'Sweden' },
  { value: 'ca', label: 'Canada' },
  { value: 'jp', label: 'Japan' }
];

const TEAMS = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'growth', label: 'Growth' },
  { value: 'support', label: 'Customer support' }
];

const MORPH_ITEMS = [
  {
    label: 'Environments',
    options: [
      { value: 'prod', label: 'Production', meta: 'us-east-1', icon: <Server size={ICON_SIZE} /> },
      { value: 'staging', label: 'Staging', meta: 'eu-west-1', icon: <Cloud size={ICON_SIZE} /> }
    ]
  },
  { label: 'Edge', options: [{ value: 'cdn', label: 'Global CDN', meta: '38 locations', icon: <Globe size={ICON_SIZE} /> }] }
];

const PLAN_CARDS = [
  { value: 'starter', label: 'Starter', description: 'For side projects', meta: '$0', icon: <Rocket size={ICON_SIZE} /> },
  { value: 'team', label: 'Team', description: 'Up to 25 seats', meta: '$12', icon: <Users size={ICON_SIZE} /> },
  { value: 'scale', label: 'Scale', description: 'SSO and audit logs', meta: '$29', icon: <Building2 size={ICON_SIZE} /> }
];

export function SelectionDemo() {
  return (
    <Page columns={3}>
      <Cell title="Select">
        <Select label="Data region" options={REGIONS} defaultValue="eu-west" description="Where your workspace data is stored." />
      </Cell>

      <Cell title="Combobox">
        <Combobox label="Billing country" options={COUNTRIES} defaultValue="pt" />
      </Cell>

      <Cell title="Multi select">
        <MultiSelect label="Notify teams" options={TEAMS} defaultValue={['design', 'engineering', 'growth']} maxVisible={2} />
      </Cell>

      <Cell title="Morph select">
        <MorphSelect label="Deploy target" items={MORPH_ITEMS} defaultValue="staging" />
      </Cell>

      <Cell title="Checkbox">
        <Stack>
          <Checkbox label="Email me weekly usage summaries" description="Every Monday at 8:00." defaultChecked />
          <Checkbox label="Share anonymous crash reports" />
        </Stack>
      </Cell>

      <Cell title="Switch">
        <Stack>
          <Switch label="Two-factor authentication" defaultChecked />
          <Switch label="Public project page" />
        </Stack>
      </Cell>

      <Cell title="Radio group">
        <RadioGroup
          label="Invoice delivery"
          value="email"
          onValueChange={noop}
          options={[
            { value: 'email', label: 'Email PDF', description: 'Sent on the 1st of each month.' },
            { value: 'portal', label: 'Billing portal', description: 'Download whenever you need.' }
          ]}
        />
      </Cell>

      <Cell title="Radio cards" span={2}>
        <RadioCards options={PLAN_CARDS} defaultValue="team" />
      </Cell>

      <Cell title="Segmented control">
        <SegmentedControl
          label="Time range"
          value="30d"
          onValueChange={noop}
          options={[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' }
          ]}
        />
      </Cell>

      <Cell title="Toggle group">
        <Stack>
          <ToggleGroup label="Alignment" defaultValue="left">
            <ToggleGroupItem value="left" label="Align left"><AlignLeft size={ICON_SIZE} /></ToggleGroupItem>
            <ToggleGroupItem value="center" label="Align center"><AlignCenter size={ICON_SIZE} /></ToggleGroupItem>
            <ToggleGroupItem value="right" label="Align right"><AlignRight size={ICON_SIZE} /></ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup label="Visible columns" type="multiple" defaultValue={['owner', 'status']}>
            <ToggleGroupItem value="owner">Owner</ToggleGroupItem>
            <ToggleGroupItem value="status">Status</ToggleGroupItem>
            <ToggleGroupItem value="due">Due date</ToggleGroupItem>
          </ToggleGroup>
        </Stack>
      </Cell>

      <Cell title="Chip group">
        <ChipGroup
          label="Filter by topic"
          multiple
          value={['billing', 'security']}
          onValueChange={noop}
          options={[
            { value: 'billing', label: 'Billing' },
            { value: 'security', label: 'Security' },
            { value: 'api', label: 'API' },
            { value: 'mobile', label: 'Mobile' },
            { value: 'integrations', label: 'Integrations' }
          ]}
        />
      </Cell>

      <Cell title="Billing toggle">
        <Stack>
          <BillingToggle value="yearly" onValueChange={noop} />
          <Row>
            <BillingPrice amount={29} currency="$" period="seat / mo" was={35} />
          </Row>
        </Stack>
      </Cell>

      <Cell title="Rating">
        <Stack>
          <Rating label="Rate your onboarding" defaultValue={4} showValue />
          <Rating label="Average review" defaultValue={4.5} allowHalf readOnly description="1,284 reviews" />
        </Stack>
      </Cell>
    </Page>
  );
}
