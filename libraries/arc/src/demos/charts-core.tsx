import { Sparkline } from '@/components/arc/sparkline/sparkline';
import { Gauge } from '@/components/arc/gauge/gauge';
import { BarChart } from '@/components/arc/bar-chart/bar-chart';
import { ActivityHeatmap } from '@/components/arc/activity-heatmap/activity-heatmap';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
import { Cell, Page, Stack } from './layout';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MRR = [42, 45, 49, 53, 58, 61, 67, 72, 79, 84, 91, 98];
const FORECAST = [40, 44, 48, 52, 57, 62, 66, 73, 78, 85, 92, 100];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SIGNUPS = [184, 226, 241, 219, 198, 96, 74];
const HEATMAP_DAYS = 371;
const HEATMAP_END = Date.UTC(2026, 10, 12);
const DAY_MS = 86400000;

const HEATMAP_DATA = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
  const date = new Date(HEATMAP_END - (HEATMAP_DAYS - 1 - i) * DAY_MS);
  const weekday = date.getUTCDay();
  const base = weekday === 0 || weekday === 6 ? 1 : 4;
  return { date: date.toISOString().slice(0, 10), count: (base + ((i * 7) % 6) + (i % 11 === 0 ? 5 : 0)) % 12 };
});

const SOURCES = [
  { key: 'organic', label: 'Organic search', value: 4820 },
  { key: 'direct', label: 'Direct', value: 3150 },
  { key: 'referral', label: 'Referral', value: 1890 },
  { key: 'social', label: 'Social', value: 1240 },
  { key: 'email', label: 'Email', value: 960 }
];

const formatCurrencyK = (value: number) => `$${value}k`;

export function ChartsCoreDemo() {
  return (
    <Page columns={2}>
      <Cell title="Sparkline">
        <Stack gap={20}>
          <Sparkline label="Weekly active users" data={[310, 322, 318, 341, 356, 349, 372, 388, 401, 396, 418, 432]} value="432" change="+8.2%" tone="success" area width={320} height={72} />
          <Sparkline label="Churned accounts" data={[14, 12, 15, 11, 9, 10, 8, 9, 7, 8, 6, 5]} value="5" change="-64%" tone="accent" width={320} height={72} />
        </Stack>
      </Cell>

      <Cell title="Gauge">
        <Gauge label="Customer satisfaction" value={78} detail="Up 7 points from last quarter" tone="success" />
      </Cell>

      <Cell title="Bar chart">
        <BarChart
          label="Signups by weekday"
          period="Nov 3 to Nov 9"
          unit="signups"
          data={WEEKDAYS.map((day, i) => ({ key: day, label: day, value: SIGNUPS[i] }))}
          height={220}
        />
      </Cell>

      <Cell title="Donut chart">
        <DonutChart label="Traffic by source" unit="visits" data={SOURCES} totalLabel="Visits" />
      </Cell>

      <Cell title="Line chart" span={2}>
        <LineChart
          label="Monthly recurring revenue"
          unit="$k"
          height={260}
          data={MONTHS.map((month, i) => ({ key: month, label: `${month} 2026`, axisLabel: month, values: { actual: MRR[i], forecast: FORECAST[i] } }))}
          series={[
            { key: 'actual', label: 'Actual MRR', area: true },
            { key: 'forecast', label: 'Forecast', dashed: true }
          ]}
          formatValue={formatCurrencyK}
          formatTick={formatCurrencyK}
        />
      </Cell>

      <Cell title="Activity heatmap" span={2}>
        <ActivityHeatmap
          label="Commits"
          period="Nov 2025 to Nov 2026"
          days={HEATMAP_DATA}
          unit={{ one: 'commit', other: 'commits' }}
          weekStartsOn={1}
        />
      </Cell>
    </Page>
  );
}
