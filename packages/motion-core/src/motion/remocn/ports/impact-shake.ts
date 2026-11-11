import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'impact-shake',
  title: 'Impact shake',
  about: 'A heavy word drops, squashes on the floor, splits into red and blue ghosts and shakes the camera with dust.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 50,
  background: '#111111',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'LAUNCH', group: 'Content', maxLength: 40 },
    intensity: { type: 'number', title: 'Intensity', default: 1, minimum: 0, maximum: 2, step: 0.1, group: 'Motion' },
    impact: { type: 'number', title: 'Impact frame', default: 7, minimum: 2, maximum: 30, step: 1, group: 'Motion' },
    foregroundColor: { type: 'string', title: 'Foreground', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 1, minimum: 1, maximum: 24, step: 1, group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const speed = Number(p.speed);
    const k = Math.max(0, Number(p.intensity));
    const impact = Number(p.impact);
    const seed = Number(p.seed);
    const fg = String(p.foregroundColor);
    const face = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const SPLIT_A = '#FF2A2A';
    const SPLIT_B = '#2A6BFF';
    const DUST_COLOR = '#D9D9D9';
    const DUST = 36;
    const unit = height / 720;
    const floorY = height * 0.62;
    const NS = 'impact-shake';

    const tintMatrix = (hex: string) => {
      const v = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
      return `0 0 0 0 ${((v >> 16) & 255) / 255} 0 0 0 0 ${((v >> 8) & 255) / 255} 0 0 0 0 ${(v & 255) / 255} 0 0 0 1 0`;
    };

    const dust = Array.from({ length: DUST }, (_, i) => {
      const key = `${NS}-${seed}-dust-${i}`;
      const side = i % 2 === 0 ? -1 : 1;
      return {
        chip: i % 3 === 0,
        x0: (0.04 + S.random(`${key}-x`) * 0.24) * side,
        vx: side * (0.4 + S.random(`${key}-v`) * 1),
        vy: 0.3 + S.random(`${key}-u`) * 0.9,
        size: 0.5 + S.random(`${key}-s`) * 0.9,
        life: 11 + S.random(`${key}-l`) * 9
      };
    });

    const filters = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } },
      S.h('filter', { id: `${NS}-a`, colorInterpolationFilters: 'sRGB' }, S.h('feColorMatrix', { type: 'matrix', values: tintMatrix(SPLIT_A) })),
      S.h('filter', { id: `${NS}-b`, colorInterpolationFilters: 'sRGB' }, S.h('feColorMatrix', { type: 'matrix', values: tintMatrix(SPLIT_B) })));
    const puff = S.h('filter', { id: `${NS}-puff`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, S.h('feGaussianBlur', { stdDeviation: height * 0.007 }));
    const dustSvg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, puff);
    const dustLayer = S.h('g', null);
    dustSvg.appendChild(dustLayer);

    const subject = () => S.h('span', { style: { fontFamily: face, fontSize: height * 0.24, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: fg } }, String(p.text));
    const layer = (filter: string | undefined) => S.fill({ alignItems: 'center', justifyContent: 'center', filter, transformOrigin: `50% ${(floorY / height) * 100}%`, mixBlendMode: filter ? 'screen' : undefined }, subject()) as HTMLElement;
    const layerA = layer(`url(#${NS}-a)`);
    const layerB = layer(`url(#${NS}-b)`);
    const main = layer(undefined);
    const shaker = S.fill({}, dustSvg, layerA, layerB, main) as HTMLElement;
    const flashEl = S.fill({ background: fg, opacity: 0 }) as HTMLElement;
    view.root.style.overflow = 'hidden';
    view.root.replaceChildren(filters, shaker, flashEl);

    return (at) => {
      const t = (at * speed * 30) / view.fps;
      const since = t - impact;
      const fall = S.interpolate(t, [0, impact], [-height * 0.85, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.in(S.Easing.quad) });
      const falling = since < 0;
      const stretch = falling ? S.interpolate(t, [0, impact], [1, 1.18], { extrapolateRight: 'clamp' }) : 1;
      const squash = falling ? 0 : 1 - S.spring({ frame: since, fps: 30, config: { damping: 9, stiffness: 260 } });
      const sx = falling ? 1 / Math.sqrt(stretch) : 1 + 0.16 * squash * Math.min(1, k);
      const sy = falling ? stretch : 1 - 0.2 * squash * Math.min(1, k);
      const decay = since >= 0 ? Math.exp(-since / 3.2) : 0;
      const phase = S.random(`${NS}-${seed}`) * Math.PI * 2;
      const shakeX = decay * Math.sin(since * 2.9 + phase) * 26 * unit * k;
      const shakeY = decay * Math.cos(since * 3.7 + phase) * 34 * unit * k;
      const shakeR = decay * Math.sin(since * 2.3 + phase * 2) * 1.6 * k;
      const split = since >= 0 && since < 2 ? (1 - since / 2) * 18 * unit * k + 6 * unit : 0;
      const flash = S.interpolate(since, [0, 0.5, 2.5], [0, 0.12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

      shaker.style.transform = `translate(${shakeX}px, ${shakeY}px) rotate(${shakeR}deg) scale(${1 + decay * 0.04 * k})`;
      const place = (el: HTMLElement, dx: number) => {
        el.style.transform = `translate(${dx}px, ${fall}px) scale(${sx}, ${sy})`;
      };
      place(main, 0);
      place(layerA, -split);
      place(layerB, split);
      layerA.style.display = split > 0 ? 'flex' : 'none';
      layerB.style.display = split > 0 ? 'flex' : 'none';
      flashEl.style.opacity = String(flash * k);

      const nodes: Element[] = [];
      if (since >= 0) {
        const spread = Math.max(0.4, k);
        dust.forEach((d) => {
          const age = since;
          if (age > d.life) {
            return;
          }
          const life = age / d.life;
          if (d.chip) {
            const x = width / 2 + d.x0 * width + d.vx * age * 10 * unit * spread;
            const y = floorY - d.vy * age * 16 * unit + age * age * 1.6 * unit;
            const size = d.size * 6 * unit;
            nodes.push(S.h('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size, fill: DUST_COLOR, opacity: (1 - life) * 0.9, transform: `rotate(${age * 40 * d.vx} ${x} ${y})` }));
            return;
          }
          const travel = 1 - Math.exp(-age / 3.5);
          const x = width / 2 + d.x0 * width + d.vx * travel * width * 0.16 * spread;
          const y = floorY - d.vy * travel * height * 0.07;
          const r = height * d.size * (0.015 + 0.05 * travel + 0.02 * life);
          nodes.push(S.h('circle', { cx: x, cy: y, r, fill: DUST_COLOR, opacity: (1 - life) ** 1.4 * 0.38, filter: `url(#${NS}-puff)` }));
        });
      }
      dustLayer.replaceChildren(...nodes);
    };
  }
};
