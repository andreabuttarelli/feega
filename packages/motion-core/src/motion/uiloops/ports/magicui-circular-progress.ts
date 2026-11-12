import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-circular-progress',
  title: 'Circular progress',
  about: 'A round gauge fills to a value while its number fades in, one gauge alone. Pick it for a single percentage; KPI counter shows several metric cards.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    value: { type: 'number', title: 'Value', default: 78, minimum: 0, maximum: 1000, step: 1, group: 'Content' },
    min: { type: 'number', title: 'Min', default: 0, minimum: -1000, maximum: 1000, step: 1, group: 'Content' },
    max: { type: 'number', title: 'Max', default: 100, minimum: -1000, maximum: 1000, step: 1, group: 'Content' },
    delay: { type: 'number', title: 'Delay (s)', default: 0, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    size: { type: 'number', title: 'Size', default: 400, minimum: 80, maximum: 700, step: 1, group: 'Layout' },
    gaugePrimaryColor: { type: 'string', title: 'Gauge colour', format: PropFormat.Color, default: '#79ffe1', group: 'Style' },
    gaugeSecondaryColor: { type: 'string', title: 'Track colour (drawn at 10%)', format: PropFormat.Color, default: '#000000', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#141414', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const RADIUS = 45;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const PERCENT_PX = CIRCUMFERENCE / 100;
    const TRACK_MAX = 90;
    const TRACK_ALPHA = 0.1;
    const GAP_DEGREES = 5 * 3.6;
    const TRANSITION = 1;
    const CSS_EASE = S.Easing.bezier(0.25, 0.1, 0.25, 1);
    const target = Math.round(((Number(p.value) - Number(p.min)) / (Number(p.max) - Number(p.min))) * 100);
    const dash = (percent: number) => `${percent * PERCENT_PX} ${CIRCUMFERENCE}`;
    const track = S.h('circle', { cx: 50, cy: 50, r: RADIUS, strokeWidth: 10, strokeDashoffset: 0, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', stroke: S.withAlpha(String(p.gaugeSecondaryColor), TRACK_ALPHA), transform: `translate(50 50) rotate(${360 - 90 - GAP_DEGREES}) scale(1 -1) translate(-50 -50)` });
    const gauge = S.h('circle', { cx: 50, cy: 50, r: RADIUS, strokeWidth: 10, strokeDashoffset: 0, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', stroke: String(p.gaugePrimaryColor), transform: 'rotate(-90 50 50)' });
    const number = S.h('span', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 'auto', width: 'fit-content', height: 'fit-content', fontSize: Number(p.size) * 0.15, fontWeight: 600, color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter') } }, String(target)) as HTMLElement;
    const dial = S.h('div', { style: { position: 'relative', width: Number(p.size), height: Number(p.size) } }, S.h('svg', { viewBox: '0 0 100 100', fill: 'none', style: { width: '100%', height: '100%' } }, target <= TRACK_MAX && target >= 0 ? track : null, gauge), number);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, dial));

    return (frame) => {
      const into = S.clamp((frame / view.fps - Number(p.delay)) / TRANSITION, 0, 1);
      const percent = target * CSS_EASE(into);
      gauge.setAttribute('stroke-dasharray', dash(percent));
      track.setAttribute('stroke-dasharray', dash(TRACK_MAX - percent));
      number.style.opacity = String(into);
    };
  }
};
