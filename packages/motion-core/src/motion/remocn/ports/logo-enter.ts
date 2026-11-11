import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'logo-enter',
  title: 'Logo enter',
  about: 'A row of round logo badges springs in one after another, overlapping like an avatar stack.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: [],
  props: {
    diameter: { type: 'number', title: 'Diameter', default: 118, minimum: 48, maximum: 300, step: 1, group: 'Style' },
    overlap: { type: 'number', title: 'Overlap', default: 38, minimum: 0, maximum: 200, step: 1, group: 'Style' },
    ringColor: { type: 'string', title: 'Ring', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    orientation: { type: 'string', title: 'Orientation', enum: ['horizontal', 'vertical'], default: 'horizontal', group: 'Style' },
    stagger: { type: 'number', title: 'Stagger', default: 7, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const diameter = Number(p.diameter);
    const overlap = Number(p.overlap);
    const stagger = Number(p.stagger);
    const speed = Number(p.speed);
    const vertical = p.orientation === 'vertical';
    const RING_PX = 5;
    const MARK_RATIO = 0.52;
    const SPRING = { damping: 13, stiffness: 130, mass: 0.8 };
    const FROM_SCALE = 0.5;
    const DROP_PX = 22;

    const mark = (viewBox: string, ...parts: Element[]) => S.h('svg', { width: '100%', height: '100%', viewBox }, ...parts);
    const logos = [
      { bg: '#F0EEE6', mark: mark('0 0 24 24', S.h('path', { d: 'M12 2l2.2 6.3L20.5 6l-3.2 6 3.2 6-6.3-2.3L12 22l-2.2-6.3L3.5 18l3.2-6-3.2-6 6.3 2.3z', fill: '#D97757' })) },
      { bg: '#0A0A0A', mark: mark('0 0 24 24', S.h('circle', { cx: 12, cy: 12, r: 8, fill: 'none', stroke: '#ffffff', strokeWidth: 3 }), S.h('circle', { cx: 12, cy: 12, r: 2.4, fill: '#ffffff' })) },
      { bg: '#0A0A0A', mark: mark('0 0 24 24', S.h('path', { d: 'M12 2l8.66 5v10L12 22l-8.66-5V7z', fill: '#ffffff' })) },
      { bg: '#0A0A0A', mark: mark('0 0 24 24', S.h('path', { d: 'M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z', fill: '#ffffff' })) }
    ];

    const badges = logos.map((logo, i) => {
      const lead = i === 0 ? 0 : -overlap;
      return S.h(
        'div',
        {
          style: {
            width: diameter,
            height: diameter,
            borderRadius: '50%',
            marginLeft: vertical ? 0 : lead,
            marginTop: vertical ? lead : 0,
            zIndex: logos.length - i,
            background: logo.bg,
            border: `${RING_PX}px solid ${String(p.ringColor)}`,
            boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
            boxSizing: 'content-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0
          }
        },
        S.h('div', { style: { width: diameter * MARK_RATIO, height: diameter * MARK_RATIO, display: 'flex' } }, logo.mark)
      ) as HTMLElement;
    });

    const row = S.h('div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row' } }, badges);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, row));

    return (at) => {
      badges.forEach((el, i) => {
        const s = S.spring({ fps: view.fps, frame: at * speed - i * stagger, config: SPRING });
        const offset = S.interpolate(s, [0, 1], [DROP_PX, 0]);
        el.style.opacity = String(s);
        el.style.translate = vertical ? `${offset}px` : `0 ${offset}px`;
        el.style.scale = String(S.interpolate(s, [0, 1], [FROM_SCALE, 1]));
      });
    };
  }
};
