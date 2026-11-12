import { Sun, Volume1, Volume2 } from 'lucide-react';
import { Calendar } from '@/components/arc/calendar/calendar';
import { DatePicker } from '@/components/arc/date-picker/date-picker';
import { DateRangePicker } from '@/components/arc/date-range-picker/date-range-picker';
import { TimePicker } from '@/components/arc/time-picker/time-picker';
import { ColorPicker } from '@/components/arc/color-picker/color-picker';
import { Slider } from '@/components/arc/slider/slider';
import { ElasticSlider } from '@/components/arc/elastic-slider/elastic-slider';
import { RangeHistogramSlider } from '@/components/arc/range-histogram-slider/range-histogram-slider';
import { RulerSlider } from '@/components/arc/ruler-slider/ruler-slider';
import { ShortcutRecorder, ShortcutList } from '@/components/arc/shortcut-recorder/shortcut-recorder';
import { Cell, Page, Stack } from './layout';

const ICON_SIZE = 16;
const ANCHOR_DATE = new Date(2026, 10, 12);
const RANGE = { start: new Date(2026, 10, 3), end: new Date(2026, 10, 17) };

const NIGHTLY_RATES = Array.from({ length: 80 }, (_, i) => 60 + ((i * 53) % 17) * 9 + (i % 7) * 11);

const BRAND_SWATCHES = [
  { id: 'indigo', color: '#4f46e5' },
  { id: 'emerald', color: '#10b981' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'rose', color: '#e11d48' }
];

const SHORTCUT_GROUPS = [
  {
    label: 'Navigation',
    items: [
      { label: 'Open command palette', shortcut: 'Mod+K' },
      { label: 'Go to inbox', shortcut: 'G I' },
      { label: 'Toggle sidebar', shortcut: 'Mod+B' }
    ]
  },
  {
    label: 'Editing',
    items: [
      { label: 'Duplicate block', shortcut: 'Mod+D' },
      { label: 'Publish changes', shortcut: 'Mod+Shift+P' }
    ]
  }
];

export function PickersDemo() {
  return (
    <Page columns={3}>
      <Cell title="Calendar">
        <Calendar value={ANCHOR_DATE} month={ANCHOR_DATE} showToday={false} />
      </Cell>

      <Cell title="Date picker">
        <Stack>
          <DatePicker label="Renewal date" value={ANCHOR_DATE} description="Your plan renews automatically." showToday={false} />
          <DateRangePicker label="Reporting period" defaultValue={RANGE} />
        </Stack>
      </Cell>

      <Cell title="Time picker">
        <Stack>
          <TimePicker label="Daily digest" defaultValue="08:30" format="24h" description="Local time, Europe/Lisbon." />
          <TimePicker label="Standup" defaultValue="09:45" format="12h" minuteStep={15} />
        </Stack>
      </Cell>

      <Cell title="Color picker" span={2}>
        <ColorPicker label="Brand accent" defaultValue="#4f46e5" defaultSwatches={BRAND_SWATCHES} />
      </Cell>

      <Cell title="Shortcut recorder">
        <Stack>
          <ShortcutRecorder label="Quick capture" defaultValue="Mod+Shift+N" platform="mac" description="Opens a new note from anywhere." />
          <ShortcutList groups={SHORTCUT_GROUPS} platform="mac" label="Keyboard shortcuts" />
        </Stack>
      </Cell>

      <Cell title="Slider">
        <Stack>
          <Slider label="Team budget" defaultValue={6500} min={0} max={10000} step={500} showValue format={(v) => `$${v.toLocaleString('en-US')}`} />
          <Slider label="Price range" defaultValue={[20, 80]} min={0} max={100} showValue />
        </Stack>
      </Cell>

      <Cell title="Elastic slider">
        <Stack>
          <ElasticSlider label="Brightness" defaultValue={70} showValue startIcon={<Sun size={ICON_SIZE} />} endIcon={<Sun size={ICON_SIZE + 4} />} />
          <ElasticSlider label="Volume" defaultValue={35} showValue startIcon={<Volume1 size={ICON_SIZE} />} endIcon={<Volume2 size={ICON_SIZE} />} />
        </Stack>
      </Cell>

      <Cell title="Range histogram slider">
        <RangeHistogramSlider label="Nightly rate" data={NIGHTLY_RATES} min={50} max={250} defaultValue={[90, 180]} format={(v) => `$${v}`} />
      </Cell>

      <Cell title="Ruler slider">
        <RulerSlider label="Frame rate" defaultValue={30} min={0} max={60} step={1} majorEvery={10} unit="fps" />
      </Cell>
    </Page>
  );
}
