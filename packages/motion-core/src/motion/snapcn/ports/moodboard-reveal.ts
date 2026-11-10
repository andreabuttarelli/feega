import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'moodboard-reveal',
  title: 'Moodboard reveal',
  about: 'A headline with a swapping inline image, then a gallery orbits, merges and lands on one hero image as the page lifts to light.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    leadIn: { type: 'string', title: 'Text before the image', default: 'that lets you', group: 'Content', maxLength: 60 },
    emphasis: { type: 'string', title: 'Bold word', default: 'filter', group: 'Content', maxLength: 40 },
    tailIn: { type: 'string', title: 'Text after the bold word', default: 'out AI.', group: 'Content', maxLength: 60 },
    images: { type: 'string', title: 'Image URLs, comma separated (empty = tiles)', default: '', group: 'Content', maxLength: 2000 },
    heroImage: { type: 'string', title: 'Hero image URL (empty = 4th image)', default: '', group: 'Content', maxLength: 500 },
    darkColor: { type: 'string', title: 'Start background (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    lightColor: { type: 'string', title: 'End background (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const SENTENCE_OUT = 50;
    const COLLAGE_START = 46;
    const APPEAR_FRAMES = 12;
    const FLICKER_HOLD = 2;
    const ORBIT_END = 88;
    const ORBIT_DEG = 130;
    const MERGE_START = 88;
    const MERGE_END = 100;
    const BG_START = 88;
    const BG_END = 104;
    const MERGE_W = 300;
    const CARD_RATIO = 1.34;
    const INLINE_START = 8;
    const INLINE_HOLD = 12;
    const INLINE_COUNT = 3;
    const DROP_FRAMES = 9;
    const DROP_SCALE = 1.16;
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const SLOTS = [
      { x: -401, y: -51, w: 188, rot: -5 },
      { x: -186, y: -191, w: 164, rot: 4 },
      { x: 44, y: -168, w: 214, rot: -2 },
      { x: 283, y: -79, w: 173, rot: 6 },
      { x: 377, y: 151, w: 169, rot: -4 },
      { x: -340, y: 179, w: 183, rot: 5 },
      { x: -101, y: 193, w: 214, rot: -3 },
      { x: 138, y: 193, w: 188, rot: 3 }
    ];
    const TILES = ['#c56b4f', '#3d5a80', '#7a9e7e', '#d9a441', '#6d597a', '#b56576', '#457b9d', '#8d6e63'];

    const listed = String(p.images ?? '').split(/,(?=\s*(?:https?:|data:|\/))/).map((s) => s.trim()).filter(Boolean);
    const images = listed.length ? listed : TILES.map((_, i) => `tile:${i}`);
    const hero = String(p.heroImage || '') || images[3] || images[0];
    const dark = S.themeOf('dark');
    const light = S.themeOf('light');
    const darkBg = S.pick(p.darkColor, String(dark.background));
    const lightBg = S.pick(p.lightColor, String(light.background));
    const bare = S.parseColor(darkBg).alpha === 0 && S.parseColor(lightBg).alpha === 0;
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const speed = Number(p.speed);
    const cx = view.width / 2;
    const cy = view.height / 2;

    const orbitAngle = (f: number) => S.interpolate(f, [COLLAGE_START, ORBIT_END], [0, ORBIT_DEG], { ...CLAMP, easing: S.Easing.inOut(S.Easing.cubic) });
    const mergeProgress = (f: number) => S.interpolate(f, [MERGE_START, MERGE_END], [0, 1], { ...CLAMP, easing: EASE });
    const flickerImage = (f: number, slot: number, count: number) => {
      const step = Math.max(0, Math.floor((Math.min(f, MERGE_START) - COLLAGE_START) / FLICKER_HOLD));
      return (step * 3 + slot * 5) % count;
    };
    const slotPose = (f: number, s: (typeof SLOTS)[number], i: number) => {
      const appear = COLLAGE_START + i * 2;
      const opacity = S.interpolate(f, [appear, appear + APPEAR_FRAMES], [0, 1], CLAMP);
      const scIn = S.interpolate(f, [appear, appear + APPEAR_FRAMES], [0.6, 1], { ...CLAMP, easing: EASE });
      const a = (orbitAngle(f) * Math.PI) / 180;
      const ox = s.x * Math.cos(a) - s.y * Math.sin(a);
      const oy = s.x * Math.sin(a) + s.y * Math.cos(a);
      const m = mergeProgress(f);
      return { x: ox * (1 - m), y: oy * (1 - m), scale: scIn * (1 + (MERGE_W / s.w - 1) * m), opacity };
    };
    const mergeBlur = (f: number) => S.interpolate(f, [MERGE_START, (MERGE_START + MERGE_END) / 2, MERGE_END], [0, 6, 0], CLAMP);
    const inlineImage = (f: number, count: number) => {
      const index = Math.min(count - 1, Math.max(0, Math.floor((f - INLINE_START) / INLINE_HOLD)));
      const age = f - (INLINE_START + index * INLINE_HOLD);
      return { index, scale: S.interpolate(age, [0, DROP_FRAMES], [DROP_SCALE, 1], { ...CLAMP, easing: EASE }), opacity: S.interpolate(age, [0, 5], [0, 1], { ...CLAMP, easing: EASE }) };
    };

    const cardOf = (src: string, style: Record<string, string | number> = {}) => {
      const base = { width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: 'block', ...style };
      const tile = /^tile:(\d+)$/.exec(src);
      return (tile ? S.h('div', { style: { ...base, background: TILES[Number(tile[1]) % TILES.length] } }) : S.h('img', { src, style: base })) as HTMLElement;
    };

    const grid = S.fill({ display: 'block', backgroundImage: `radial-gradient(circle, ${S.withAlpha(String(light.background), 0.07)} 1px, transparent 1.5px)`, backgroundSize: '20px 20px' }) as HTMLElement;

    const inlineSrcs = images.slice(0, INLINE_COUNT);
    const inlineCards = inlineSrcs.map((src, i) => cardOf(src, { position: 'absolute', top: 0, left: 0, zIndex: i, transformOrigin: 'center center' }));
    const sentence = S.fill(
      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, color: String(bare ? light.foreground : dark.foreground), fontSize: 28, fontWeight: 400, letterSpacing: '-0.01em' },
      S.h('span', null, String(p.leadIn)),
      S.h('div', { style: { position: 'relative', width: 108, height: 108 * CARD_RATIO, overflow: 'hidden', flexShrink: 0 } }, inlineCards),
      S.h('span', null, S.h('strong', { style: { fontWeight: 700 } }, String(p.emphasis)), ` ${String(p.tailIn)}`)
    ) as HTMLElement;

    const slotEls = SLOTS.map((s) => {
      const cards = new Map<string, HTMLElement>();
      [...images, hero].forEach((src) => {
        if (!cards.has(src)) {
          cards.set(src, cardOf(src));
        }
      });
      const el = S.h('div', { style: { position: 'absolute', width: s.w, height: s.w * CARD_RATIO } }, [...cards.values()]) as HTMLElement;
      return { el, cards };
    });
    const gallery = S.fill({ display: 'block' }, slotEls.map((s) => s.el)) as HTMLElement;

    const marker = (mx: number, my: number, size: number, spin: number, from: number, to: number) => {
      const el = S.h('div', { style: { position: 'absolute', left: mx, width: size, height: size } }) as HTMLElement;
      const place = (f: number, color: string) => {
        const opacity = S.interpolate(f, [from, from + 8, to - 8, to], [0, 1, 1, 0], CLAMP);
        el.style.display = opacity <= 0 ? 'none' : '';
        el.style.top = `${my + Math.sin((f - from) / 22) * 8}px`;
        el.style.border = `1px solid ${color}`;
        el.style.transform = `rotate(${spin + (f - from) * 0.6}deg)`;
        el.style.opacity = String(opacity);
      };
      return { el, place };
    };
    const markers = [marker(cx + 150, cy - 130, 44, 0, 4, SENTENCE_OUT), marker(cx - 240, cy + 40, 54, 45, MERGE_END - 6, 150), marker(cx + 190, cy + 70, 40, 12, MERGE_END + 8, 150)];

    const stage = S.fill({ display: 'block', overflow: 'hidden', fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision' }, grid, sentence, gallery, markers.map((m) => m.el)) as HTMLElement;
    view.root.replaceChildren(stage);

    return (at) => {
      const frame = at * speed;
      const bg = S.interpolate(frame, [BG_START, BG_END], [0, 1], CLAMP);
      stage.style.backgroundColor = S.interpolateColors(bg, [0, 1], [darkBg, lightBg]);
      grid.style.opacity = String(bare ? 0 : 1 - bg);
      const markerColor = bg < 0.5 && !bare ? S.withAlpha(String(light.background), 0.55) : S.withAlpha(String(dark.background), 0.5);

      const sentenceOp = S.interpolate(frame, [0, 8, SENTENCE_OUT - 6, SENTENCE_OUT], [0, 1, 1, 0], CLAMP);
      sentence.style.display = sentenceOp > 0 ? 'flex' : 'none';
      sentence.style.opacity = String(sentenceOp);
      const inline = inlineImage(frame, Math.min(INLINE_COUNT, images.length));
      inlineCards.forEach((el, i) => {
        const active = i === inline.index;
        el.style.display = i > inline.index ? 'none' : 'block';
        el.style.opacity = String(active ? inline.opacity : 1);
        el.style.transform = active ? `scale(${inline.scale})` : '';
      });

      const mBlur = mergeBlur(frame);
      const merge = mergeProgress(frame);
      gallery.style.filter = mBlur > 0.1 ? `blur(${mBlur}px)` : '';
      slotEls.forEach(({ el, cards }, i) => {
        const s = SLOTS[i];
        const pose = slotPose(frame, s, i);
        el.style.display = pose.opacity <= 0 ? 'none' : '';
        const src = i === SLOTS.length - 1 && frame >= MERGE_START ? hero : images[flickerImage(frame, i, images.length)];
        cards.forEach((card, key) => {
          card.style.display = key === src ? 'block' : 'none';
        });
        const hh = s.w * CARD_RATIO;
        el.style.left = `${cx + pose.x - s.w / 2}px`;
        el.style.top = `${cy + pose.y - hh / 2}px`;
        el.style.opacity = String(pose.opacity);
        el.style.transform = `rotate(${s.rot * (1 - merge)}deg) scale(${pose.scale})`;
        el.style.boxShadow = merge > 0.98 ? 'none' : `0 18px 40px ${S.withAlpha(String(dark.background), 0.28 * (1 - merge))}`;
      });

      markers.forEach((m) => m.place(frame, markerColor));
    };
  }
};
