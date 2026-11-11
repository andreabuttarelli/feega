import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

const SERIES = 'Northwind: 42, 58, 71, 96, 118, 131\nCobalt: 30, 46, 68, 92, 126, 168\nFerry: 55, 62, 66, 70, 74, 79\nMarlow: 18, 33, 52, 61, 88, 104\nAster: 25, 28, 44, 58, 63, 72\nPell: 12, 20, 39, 47, 55, 90\nQuill: 8, 11, 15, 24, 40, 66\nDunmore: 35, 37, 38, 40, 42, 44';

export const PORT: HfPort = {
  id: 'bar-chart-race',
  title: 'Bar chart race',
  about: 'Horizontal bars race and overtake each other as the periods tick by, with a rescaling axis and the current leader in the accent colour.',
  category: HfCategory.Chart,
  origin: HfOrigin.Block,
  source: 'bar-chart-race',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 360,
  background: '#f5f3ef',
  fonts: ['Inter'],
  props: {
    title: { type: 'string', title: 'Title', default: 'Streaming Subscribers by Service', group: 'Content', maxLength: 80 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Ranked by reported subscribers', group: 'Content', maxLength: 100 },
    periods: { type: 'string', title: 'Period labels (comma separated)', default: '2019, 2020, 2021, 2022, 2023, 2024', group: 'Content', maxLength: 200 },
    series: { type: 'string', title: 'Series (one per line: Name: v1, v2, ...)', format: PropFormat.Textarea, default: SERIES, group: 'Content', maxLength: 1500 },
    source: { type: 'string', title: 'Source note', default: 'Placeholder data', group: 'Content', maxLength: 80 },
    barCount: { type: 'number', title: 'Bars shown', default: 6, minimum: 3, maximum: 12, step: 1, group: 'Layout' },
    periodDuration: { type: 'number', title: 'Seconds per period', default: 2, minimum: 0.4, maximum: 6, step: 0.1, group: 'Motion' },
    valuePrefix: { type: 'string', title: 'Value prefix', default: '$', group: 'Content', maxLength: 8 },
    valueSuffix: { type: 'string', title: 'Value suffix', default: 'M', group: 'Content', maxLength: 8 },
    valueDecimals: { type: 'number', title: 'Value decimals', default: 0, minimum: 0, maximum: 3, step: 1, group: 'Content' },
    accent: { type: 'string', title: 'Leader accent', format: PropFormat.Color, default: '#c8452d', group: 'Style' },
    barColor: { type: 'string', title: 'Bar colour', format: PropFormat.Color, default: '#1f1d1b', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
    const num = (v: unknown, fallback: number, lo: number, hi: number) => {
      const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
      return clamp(Number.isFinite(n) ? n : fallback, lo, hi);
    };
    const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.length > 0 ? v : fallback);
    const BG = String(p.background || '#f5f3ef');
    const INK = '#1f1d1b';
    const MUTED = '#6b6560';
    const barCount = Math.round(num(p.barCount, 6, 1, 24));
    const periodDuration = num(p.periodDuration, 2, 0.1, 30);
    const decimals = Math.round(num(p.valueDecimals, 0, 0, 6));
    const prefix = typeof p.valuePrefix === 'string' ? p.valuePrefix : '';
    const suffix = typeof p.valueSuffix === 'string' ? p.valueSuffix : '';

    const periodsRaw = String(p.periods).split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const periods = periodsRaw.length ? periodsRaw : ['1'];
    const T = periods.length;
    const series = String(p.series)
      .split(/[\n;]+/)
      .map((line) => {
        const at = line.indexOf(':');
        const label = at < 0 ? '' : line.slice(0, at).trim();
        const values = at < 0 ? [] : line.slice(at + 1).split(',').map((s) => Number.parseFloat(s.trim())).filter((n) => Number.isFinite(n));
        return { label, values };
      })
      .filter((s) => s.label && s.values.length > 0)
      .map((s) => {
        const values = [...s.values];
        while (values.length < T) {
          values.push(values[values.length - 1]);
        }
        return { label: s.label, values: values.slice(0, T) };
      });
    const N = series.length;

    const K = 10;
    const kfDuration = periodDuration / K;
    const kfCount = T > 1 ? (T - 1) * K + 1 : 1;
    const raceSeconds = T > 1 ? (T - 1) * periodDuration : 0;
    const valueAt = (t: number, s: { values: number[] }) => {
      if (T < 2) {
        return s.values[0];
      }
      const u = t / periodDuration;
      const i = clamp(Math.floor(u), 0, T - 2);
      const f = clamp(u - i, 0, 1);
      return s.values[i] + (s.values[i + 1] - s.values[i]) * f;
    };
    const ranks = Array.from({ length: kfCount }, (_, m) => {
      const order = series.map((s, j) => ({ j, v: valueAt(m * kfDuration, s) })).sort((a, b) => b.v - a.v || a.j - b.j);
      const row = new Array<number>(N);
      order.forEach((o, r) => {
        row[o.j] = r;
      });
      return row;
    });
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const rankPos = (t: number, j: number) => {
      if (kfCount < 2) {
        return ranks[0][j];
      }
      const m = t / kfDuration;
      const m0 = clamp(Math.floor(m), 0, kfCount - 2);
      const e = smooth(clamp(m - m0, 0, 1));
      return ranks[m0][j] + (ranks[m0 + 1][j] - ranks[m0][j]) * e;
    };
    const fmt = (v: number) => prefix + v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
    const niceStep = (x: number) => {
      const e = Math.pow(10, Math.floor(Math.log10(x)));
      const f = x / e;
      return e * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
    };

    const TRACK_X = 400;
    const TRACK_W = 1180;
    const PLOT_H = 760;
    const POOL = 12;
    const pitch = PLOT_H / barCount;
    const barH = Math.max(12, pitch * 0.62);
    const chip = { position: 'absolute', fontSize: 26, fontWeight: 600, lineHeight: 1.7, whiteSpace: 'nowrap', background: BG };

    const periodEl = S.h('span', { style: { marginTop: 4, fontSize: 72, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' } }, periods[0]) as HTMLElement;
    const head = S.h('div', { style: { position: 'absolute', top: 58, left: 96, width: 1728, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
      S.h('div', null,
        S.h('h1', { style: { fontSize: 46, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.1, margin: 0 } }, text(p.title, 'Streaming Subscribers by Service')),
        S.h('p', { style: { marginTop: 10, marginBottom: 0, fontSize: 19, fontWeight: 400, color: MUTED } }, text(p.subtitle, 'Ranked by reported subscribers'))),
      S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
        S.h('span', { style: { fontSize: 15, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED } }, 'Period'),
        periodEl));

    const rows = series.map((s) => {
      const bar = S.h('div', { style: { position: 'absolute', left: TRACK_X, top: '50%', borderRadius: 3, background: INK, height: barH, transform: 'translateY(-50%)' } }) as HTMLElement;
      const value = S.h('div', { style: { ...chip, left: TRACK_X + 4, top: '50%', padding: '0 12px' } }) as HTMLElement;
      const name = S.h('div', { style: { ...chip, left: 96, width: 272, top: '50%', transform: 'translateY(-50%)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.label);
      const row = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: 1920, height: pitch } }, name, bar, value) as HTMLElement;
      return { row, bar, value };
    });
    const plot = S.h('div', { style: { position: 'absolute', left: 0, top: 236, width: 1920, height: PLOT_H, overflow: 'hidden' } }, ...rows.map((r) => r.row));

    const ticks = Array.from({ length: POOL }, (_, k) => {
      const line = S.h('div', { style: { position: 'absolute', top: 232, left: 0, width: 1, height: 768, background: k === 0 ? 'rgba(31, 29, 27, 0.5)' : 'rgba(31, 29, 27, 0.11)' } }) as HTMLElement;
      const label = S.h('div', { style: { position: 'absolute', top: 198, left: 0, fontSize: 17, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: MUTED, whiteSpace: 'nowrap' } }) as HTMLElement;
      return { line, label };
    });
    const axis = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5000 } }, ...ticks.flatMap((t) => [t.line, t.label]));
    const source = S.h('p', { style: { position: 'absolute', left: 96, top: 1014, margin: 0, fontSize: 16, color: MUTED } }, String(p.source ?? ''));

    view.root.replaceChildren(S.fill({ fontFamily: 'Inter, sans-serif', color: INK, overflow: 'hidden' }, head, plot, axis, source));

    return (frame) => {
      if (N === 0) {
        return;
      }
      const t = Math.min(raceSeconds, frame / view.fps);
      const values = series.map((s) => valueAt(t, s));
      const byValue = values.map((_, i) => i).sort((a, b) => values[b] - values[a] || a - b);
      const zRank = new Array<number>(N);
      byValue.forEach((idx, q) => {
        zRank[idx] = q;
      });
      const leader = byValue[0];
      const scaleMax = Math.max(values[leader] * 1.06, 1e-6);
      const step = niceStep(scaleMax / 4);

      ticks.forEach((tick, i) => {
        const tv = i * step;
        const visible = tv <= scaleMax;
        const tx = TRACK_X + (tv / scaleMax) * TRACK_W;
        tick.line.style.transform = `translateX(${tx.toFixed(2)}px)`;
        tick.line.style.opacity = visible ? '1' : '0';
        tick.label.style.transform = `translateX(${tx.toFixed(2)}px) translateX(-50%)`;
        tick.label.style.opacity = visible ? '1' : '0';
        tick.label.textContent = visible ? fmt(tv) : '';
      });

      rows.forEach((el, j) => {
        const pos = rankPos(t, j);
        const barW = (values[j] / scaleMax) * TRACK_W;
        el.row.style.transform = `translateY(${(pos * pitch).toFixed(2)}px)`;
        el.row.style.opacity = clamp(barCount - pos, 0, 1).toFixed(3);
        el.row.style.zIndex = String(1000 - zRank[j]);
        el.bar.style.width = `${barW.toFixed(2)}px`;
        el.bar.style.background = j === leader ? String(p.accent) : String(p.barColor);
        el.value.style.transform = `translate(${barW.toFixed(2)}px, -50%)`;
        el.value.textContent = fmt(values[j]);
      });

      periodEl.textContent = periods[clamp(Math.floor(t / periodDuration), 0, T - 1)];
    };
  }
};
