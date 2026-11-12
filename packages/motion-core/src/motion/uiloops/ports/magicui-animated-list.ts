import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-animated-list',
  title: 'Animated list',
  about: 'Notifications pop in one after another at the top while the earlier ones spring down.',
  category: SnapcnCategory.Effect,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    items: { type: 'string', title: 'Items (one per line)', format: PropFormat.Textarea, default: 'Payment received\nNew follower\nRender finished\nComment on your post\nTeam invite accepted\nExport ready', group: 'Content', maxLength: 600 },
    delay: { type: 'number', title: 'Delay between items (ms)', default: 1000, minimum: 100, maximum: 5000, step: 50, group: 'Motion' },
    stiffness: { type: 'number', title: 'Spring stiffness', default: 350, minimum: 10, maximum: 1000, step: 10, group: 'Motion' },
    damping: { type: 'number', title: 'Spring damping', default: 40, minimum: 1, maximum: 200, step: 1, group: 'Motion' },
    cardColor: { type: 'string', title: 'Card colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#141414', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const CARD_W = 560;
    const CARD_H = 84;
    const GAP = 16;
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
    const lines = String(p.items).split('\n').map((l) => l.trim()).filter(Boolean);
    const rise = (seconds: number) => settle(seconds, Number(p.stiffness), Number(p.damping));
    const cards = lines.map((line) => S.h('div', { style: { position: 'absolute', left: '50%', top: 0, width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, boxSizing: 'border-box', padding: '0 28px', display: 'flex', alignItems: 'center', borderRadius: 20, background: String(p.cardColor), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), fontSize: 30, fontWeight: 600, boxShadow: '0 -20px 40px -20px #00000014, 0 20px 40px -20px #0000001f', border: '1px solid #0000000f', transformOrigin: '50% 0' } }, line) as HTMLElement);
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, S.h('div', { style: { position: 'absolute', top: 40, left: 0, right: 0 } }, ...cards)));

    return (frame) => {
      const t = frame / view.fps;
      cards.forEach((card, index) => {
        const arrived = t - (index * Number(p.delay)) / 1000;
        if (arrived < 0) {
          card.style.display = 'none';
          return;
        }
        card.style.display = 'flex';
        const grow = rise(arrived);
        const newer = lines.slice(index + 1).map((_, k) => (index + 1 + k) * Number(p.delay) / 1000).filter((a) => a <= t);
        const settled = newer.reduce((sum, a) => sum + (1 - rise(t - a)), 0);
        const y = (newer.length - settled) * (CARD_H + GAP);
        card.style.opacity = String(S.clamp(grow, 0, 1));
        card.style.transform = `translateY(${y}px) scale(${grow})`;
      });
    };
  }
};
