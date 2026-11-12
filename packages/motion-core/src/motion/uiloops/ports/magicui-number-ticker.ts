import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-number-ticker',
  title: 'Number ticker',
  about: 'A number springs from a start value to its target with thousands separators.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    value: { type: 'number', title: 'Value', default: 100000, minimum: -1000000000, maximum: 1000000000, step: 1, group: 'Content' },
    startValue: { type: 'number', title: 'Start value', default: 0, minimum: -1000000000, maximum: 1000000000, step: 1, group: 'Content' },
    direction: { type: 'string', title: 'Direction', enum: ['up', 'down'], default: 'up', group: 'Motion' },
    delay: { type: 'number', title: 'Delay (s)', default: 0, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    decimalPlaces: { type: 'number', title: 'Decimal places', default: 0, minimum: 0, maximum: 6, step: 1, group: 'Content' },
    damping: { type: 'number', title: 'Spring damping', default: 60, minimum: 1, maximum: 200, step: 1, group: 'Motion' },
    stiffness: { type: 'number', title: 'Spring stiffness', default: 100, minimum: 1, maximum: 500, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 220, minimum: 20, maximum: 500, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const digits = Math.round(Number(p.decimalPlaces));
    const down = p.direction === 'down';
    const from = down ? Number(p.value) : Number(p.startValue);
    const to = down ? Number(p.startValue) : Number(p.value);
    const GROUP = /\B(?=(\d{3})+(?!\d))/g;
    const format = (n: number) => {
      const [whole, fraction] = Math.abs(n).toFixed(digits).split('.');
      return `${n < 0 ? '-' : ''}${whole.replace(GROUP, ',')}${fraction ? `.${fraction}` : ''}`;
    };
    const settle = (seconds: number, stiffness: number, damping: number) => {
      const w0 = Math.sqrt(stiffness);
      const zeta = damping / (2 * w0);
      const t = Math.max(0, seconds);
      if (zeta <= 1) {
        return S.spring({ frame: t * view.fps, fps: view.fps, config: { stiffness, damping } });
      }
      const wd = w0 * Math.sqrt(zeta * zeta - 1);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cosh(wd * t) + ((zeta * w0) / wd) * Math.sinh(wd * t));
    };
    const label = S.h('span', { style: { display: 'inline-block', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter') } }, String(from)) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, label));

    return (frame) => {
      const started = frame / view.fps >= Number(p.delay);
      const latest = started ? from + (to - from) * settle(frame / view.fps - Number(p.delay), Number(p.stiffness), Number(p.damping)) : from;
      label.textContent = started ? format(Number(latest.toFixed(digits))) : String(from);
    };
  }
};
