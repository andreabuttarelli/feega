import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'marker-highlight',
  title: 'Marker highlight',
  about: 'A highlighter stroke springs across one key word while the text colour shifts.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    before: { type: 'string', title: 'Before', default: 'Made for ', group: 'Content', maxLength: 80 },
    highlight: { type: 'string', title: 'Highlight', default: 'builders', group: 'Content', maxLength: 80 },
    after: { type: 'string', title: 'After', default: '.', group: 'Content', maxLength: 80 },
    markerColor: { type: 'string', title: 'Marker colour', format: PropFormat.Color, default: '#facc15', group: 'Style' },
    baseColor: { type: 'string', title: 'Base colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    highlightedTextColor: { type: 'string', title: 'Highlighted text colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const START_FRAME = 15;
    const SPRING = { damping: 14 };
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const marker = S.h('span', { style: { position: 'absolute', top: 0, bottom: 0, left: '-0.1em', right: '-0.1em', background: String(p.markerColor), transformOrigin: 'left center', zIndex: 0 } }) as HTMLElement;
    const word = S.h('span', { style: { position: 'relative', zIndex: 1, color: String(p.baseColor) } }, String(p.highlight)) as HTMLElement;
    const wrap = S.h('span', { style: { position: 'relative', display: 'inline-block' } }, [marker, word]);
    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.baseColor), letterSpacing: '-0.03em', fontFamily: face, whiteSpace: 'pre' } }, [String(p.before), wrap, String(p.after)]);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      const scale = S.spring({ frame: frame - START_FRAME, fps: view.fps, config: SPRING });
      marker.style.scale = `${scale} 1`;
      word.style.color = S.interpolateColors(S.interpolate(scale, [0.5, 0.8], [0, 1], clamped), [0, 1], [String(p.baseColor), String(p.highlightedTextColor)]);
    };
  }
};
