import { Streamgraph } from '@/components/arc/streamgraph/streamgraph';
import { BrushChart } from '@/components/arc/brush-chart/brush-chart';
import { Ridgeline } from '@/components/arc/ridgeline/ridgeline';
import { Treemap } from '@/components/arc/treemap/treemap';
import { WaffleChart } from '@/components/arc/waffle-chart/waffle-chart';
import { SlopeChart } from '@/components/arc/slope-chart/slope-chart';
import { Cell, Page } from './layout';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86400000;
const BRUSH_START = Date.UTC(2026, 6, 1);
const BRUSH_DAYS = 120;

const STREAM_SERIES = [
  { key: 'web', label: 'Web' },
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
  { key: 'api', label: 'API' }
];

const STREAM_DATA = MONTHS.map((month, i) => ({
  key: month,
  label: `${month} 2026`,
  axisLabel: month,
  values: {
    web: 120 + ((i * 17) % 40),
    ios: 60 + i * 9,
    android: 40 + i * 6 + ((i * 5) % 12),
    api: 30 + ((i * i) % 50)
  }
}));

const BRUSH_DATA = Array.from({ length: BRUSH_DAYS }, (_, i) => ({
  date: BRUSH_START + i * DAY_MS,
  value: Math.round(1800 + i * 14 + Math.sin(i / 6) * 220 + ((i * 37) % 90))
}));

const RIDGE_BUCKETS = 24;

const RIDGE_SERIES = [
  { id: 'mon', label: 'Monday', peak: 10 },
  { id: 'wed', label: 'Wednesday', peak: 11 },
  { id: 'fri', label: 'Friday', peak: 9 },
  { id: 'sun', label: 'Sunday', peak: 15 }
].map(({ id, label, peak }) => ({
  id,
  label,
  values: Array.from({ length: RIDGE_BUCKETS }, (_, h) => Math.round(8 + 92 * Math.exp(-(((h - peak) / 3.5) ** 2))))
}));

const TREEMAP_DATA = {
  id: 'revenue',
  label: 'Revenue',
  children: [
    {
      id: 'platform',
      label: 'Platform',
      children: [
        { id: 'boards', label: 'Boards', value: 480, color: 12 },
        { id: 'docs', label: 'Docs', value: 310, color: 8 },
        { id: 'automations', label: 'Automations', value: 190, color: 24 }
      ]
    },
    {
      id: 'services',
      label: 'Services',
      children: [
        { id: 'onboarding', label: 'Onboarding', value: 160, color: -3 },
        { id: 'training', label: 'Training', value: 90, color: 4 }
      ]
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      children: [
        { id: 'templates', label: 'Templates', value: 140, color: 18 },
        { id: 'plugins', label: 'Plugins', value: 110, color: -9 }
      ]
    }
  ]
};

const WAFFLE_DATA = [
  { key: 'enterprise', label: 'Enterprise', value: 38 },
  { key: 'midmarket', label: 'Mid-market', value: 31 },
  { key: 'smb', label: 'Small business', value: 21 },
  { key: 'solo', label: 'Individuals', value: 10 }
];

const SLOPE_DATA = [
  { key: 'boards', label: 'Boards', start: 3200, end: 4800 },
  { key: 'docs', label: 'Docs', start: 2900, end: 3400 },
  { key: 'automations', label: 'Automations', start: 1100, end: 2600 },
  { key: 'forms', label: 'Forms', start: 1800, end: 1500 },
  { key: 'reports', label: 'Reports', start: 900, end: 1200 }
];

export function ChartsMoreDemo() {
  return (
    <Page columns={2}>
      <Cell title="Streamgraph">
        <Streamgraph label="Sessions by platform" unit="sessions" data={STREAM_DATA} series={STREAM_SERIES} height={240} />
      </Cell>

      <Cell title="Ridgeline">
        <Ridgeline label="Active users by hour of day" unit="users" series={RIDGE_SERIES} rowHeight={64} />
      </Cell>

      <Cell title="Brush chart" span={2}>
        <BrushChart
          label="Daily page views"
          unit="views"
          data={BRUSH_DATA}
          height={240}
          defaultRange={[BRUSH_START + 30 * DAY_MS, BRUSH_START + 90 * DAY_MS]}
          annotations={[{ date: BRUSH_START + 56 * DAY_MS, label: 'v4.0 launch', description: 'Northwind 4.0 shipped' }]}
        />
      </Cell>

      <Cell title="Treemap">
        <Treemap
          label="Revenue by product line"
          data={TREEMAP_DATA}
          height={300}
          colorLabel="Growth"
          formatValue={(value) => `$${value}k`}
          formatColor={(value) => `${value}%`}
        />
      </Cell>

      <Cell title="Waffle chart">
        <WaffleChart label="Customers by segment" unit="%" data={WAFFLE_DATA} />
      </Cell>

      <Cell title="Slope chart" span={2}>
        <SlopeChart label="Active workspaces by feature" startLabel="Q1 2026" endLabel="Q3 2026" data={SLOPE_DATA} height={300} />
      </Cell>
    </Page>
  );
}
