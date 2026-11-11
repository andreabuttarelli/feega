import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'phone-frame',
  title: 'Phone frame',
  about: 'A phone rises into frame and floats, its screen drawing a ride route with insight pills, or showing your own screenshot.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    screenSrc: { type: 'string', title: 'Screenshot', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    variant: { type: 'string', title: 'Variant', enum: ['flat', 'tilt', 'showcase'], default: 'flat', group: 'Motion' },
    entrance: { type: 'string', title: 'Entrance', enum: ['rise', 'rotate-in', 'float'], default: 'rise', group: 'Motion' },
    bezelColor: { type: 'string', title: 'Bezel (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    screenColor: { type: 'string', title: 'Screen (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    radius: { type: 'number', title: 'Body radius (px)', default: 53, minimum: 0, maximum: 160, step: 1, group: 'Style' },
    scale: { type: 'number', title: 'Scale', default: 1, minimum: 0.2, maximum: 3, step: 0.05, group: 'Style' },
    showDynamicIsland: { type: 'string', title: 'Dynamic island', enum: ['show', 'hide'], default: 'show', group: 'Style' },
    floatLoop: { type: 'string', title: 'Float loop', enum: ['on', 'off'], default: 'on', group: 'Motion' },
    floatAmplitude: { type: 'number', title: 'Float amplitude (px)', default: 6, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    tiltAngle: { type: 'number', title: 'Tilt angle (deg)', default: -12, minimum: -60, maximum: 60, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const island = S.themeOf('dark');
    const FACE = 'Phone Frame Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE || f.family === `"${FACE}"`)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`);
    const h = S.h;
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeOut = S.Easing.out(S.Easing.cubic);
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 656;
    const BEZEL = 12;
    const ENTRANCE_FRAMES = 30;
    const FLOAT_PERIOD = 4.5;
    const SCREEN_W = DEVICE_WIDTH - BEZEL * 2;
    const SCREEN_H = DEVICE_HEIGHT - BEZEL * 2;
    const SIDE_BUTTONS = [{ side: 'left', top: 118, length: 26 }, { side: 'left', top: 166, length: 46 }, { side: 'left', top: 222, length: 46 }, { side: 'right', top: 176, length: 68 }];
    const ROUTE = [[224, 450], [172, 462], [116, 460], [70, 450], [52, 412], [74, 382], [104, 388], [134, 372], [162, 380], [192, 364], [222, 372], [248, 396], [256, 424], [244, 448]];
    const PILLS = [
      { title: 'BIG CLIMB', sub: '+993 ft', icon: 'climb', tint: '#D2925F', x: 100, y: 196, anchor: [148, 372], appear: 74 },
      { title: 'SETTLED', sub: 'HR steady at 116', icon: 'heart', tint: '#84B27C', x: 80, y: 234, anchor: [132, 374], appear: 60 },
      { title: 'NEW PR', sub: 'Fastest 5 mi', icon: 'trophy', tint: '#ADA69E', x: 44, y: 292, anchor: [64, 398], appear: 40 },
      { title: 'FASTEST SPLIT', sub: '23 mph avg', icon: 'bolt', tint: '#ADA69E', x: 168, y: 300, anchor: [242, 378], appear: 52 },
      { title: 'SPRINT', sub: 'Hit 32 mph', icon: 'flame', tint: '#CC6D5C', x: 158, y: 402, anchor: [232, 448], appear: 22 }
    ];
    const ICONS: Record<string, { paths: string[]; filled: boolean }> = {
      climb: { paths: ['M7 17 17 7', 'M8 7h9v9'], filled: false },
      trophy: { paths: ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4v1a3 3 0 0 0 3 3', 'M17 6h3v1a3 3 0 0 1-3 3', 'M9 20h6M12 14v6'], filled: false },
      heart: { paths: ['M12 21S3.5 15.4 3.5 9.4C3.5 6.4 5.6 4.5 8 4.5c1.8 0 3.2 1.1 4 2.4.8-1.3 2.2-2.4 4-2.4 2.4 0 4.5 1.9 4.5 4.9 0 6-8.5 11.6-8.5 11.6z'], filled: true },
      bolt: { paths: ['M13 2 4 14h6l-1 8 9-12h-6z'], filled: true },
      flame: { paths: ['M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-1.6.7-2.8 1.6-3.7.2 1.7 1.2 2.7 2.6 2.7-1-3 1-4 .8-9z'], filled: true }
    };
    const SHOWCASE_STOPS = [0, 0.1, 0.42, 0.62, 0.9, 1];
    const SHOWCASE = { rotateX: [52, 36, 26, 12, 1.5, 0], rotateY: [28, 20, 10, 6, 1, 0], rotateZ: [30, 14, 2, 0, 0, 0], zoom: [2.6, 1.35, 2.75, 2.3, 1.04, 1], x: [60, 30, 0, -10, 0, 0], y: [-195, -40, 430, 380, 15, 0] };

    const cum = [0];
    let total = 0;
    ROUTE.forEach((a, i) => {
      const b = ROUTE[(i + 1) % ROUTE.length];
      total += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(total);
    });
    const pointAt = (f: number) => {
      const target = Math.max(0, Math.min(1, f)) * total;
      for (let i = 0; i < ROUTE.length; i++) {
        if (cum[i + 1] >= target) {
          const k = (target - cum[i]) / (cum[i + 1] - cum[i] || 1);
          const a = ROUTE[i];
          const b = ROUTE[(i + 1) % ROUTE.length];
          return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
        }
      }
      const last = ROUTE[ROUTE.length - 1];
      return { x: last[0], y: last[1] };
    };
    const routePath = (() => {
      const n = ROUTE.length;
      const q = (i: number) => ROUTE[((i % n) + n) % n];
      let d = `M ${q(0)[0]} ${q(0)[1]}`;
      for (let i = 0; i < n; i++) {
        const [p0, p1, p2, p3] = [q(i - 1), q(i), q(i + 1), q(i + 2)];
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
      }
      return `${d} Z`;
    })();

    const entrancePose = (frame: number) => {
      if (p.entrance === 'rotate-in') {
        return { opacity: S.interpolate(frame, [0, 12], [0, 1], CLAMP), y: S.interpolate(frame, [0, 28], [60, 0], { ...CLAMP, easing: easeOut }), rot: S.interpolate(frame, [0, 28], [-8, 0], { ...CLAMP, easing: easeOut }), scale: S.interpolate(frame, [0, 28], [0.94, 1], { ...CLAMP, easing: easeOut }) };
      }
      if (p.entrance === 'float') {
        return { opacity: S.interpolate(frame, [0, 16], [0, 1], CLAMP), y: 0, rot: 0, scale: S.interpolate(frame, [0, 24], [0.96, 1], { ...CLAMP, easing: easeOut }) };
      }
      return { opacity: S.interpolate(frame, [0, 12], [0, 1], CLAMP), y: S.interpolate(frame, [0, 26], [70, 0], { ...CLAMP, easing: easeOut }), rot: 0, scale: 1 };
    };
    const floatOffset = (frame: number) => {
      const start = p.entrance === 'float' ? 0 : ENTRANCE_FRAMES;
      const v = Math.sin((Math.max(0, frame - start) / (view.fps * FLOAT_PERIOD)) * Math.PI * 2) * Number(p.floatAmplitude);
      return v === 0 ? 0 : -v;
    };
    const showcasePose = (frame: number) => {
      const k = Math.max(0, Math.min(1, frame / Math.max(1, view.frames - 1)));
      const at = (values: number[]) => S.interpolate(k, SHOWCASE_STOPS, values, { easing: S.Easing.inOut(S.Easing.cubic) });
      return { rotateX: at(SHOWCASE.rotateX), rotateY: at(SHOWCASE.rotateY), rotateZ: at(SHOWCASE.rotateZ), zoom: at(SHOWCASE.zoom), x: at(SHOWCASE.x), y: at(SHOWCASE.y) };
    };

    const pillIcon = (kind: string, color: string) => {
      const icon = ICONS[kind];
      const attrs = icon.filled ? { width: 11, height: 11, viewBox: '0 0 24 24', fill: color } : { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
      return h('svg', attrs, icon.paths.map((d) => h('path', { d })));
    };
    const statusIcons = () => h('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
      h('svg', { width: 16, height: 11, viewBox: '0 0 18 12', fill: '#fff' }, h('rect', { x: 0, y: 8, width: 3, height: 4, rx: 1 }), h('rect', { x: 5, y: 5, width: 3, height: 7, rx: 1 }), h('rect', { x: 10, y: 2.5, width: 3, height: 9.5, rx: 1 }), h('rect', { x: 15, y: 0, width: 3, height: 12, rx: 1, opacity: 0.4 })),
      h('svg', { width: 15, height: 11, viewBox: '0 0 16 12', fill: '#fff' }, h('path', { d: 'M8 2.2c2.7 0 5.2 1 7 2.8l-1.5 1.6A7.8 7.8 0 0 0 8 4.4 7.8 7.8 0 0 0 2.5 6.6L1 5C2.8 3.2 5.3 2.2 8 2.2Z' }), h('path', { d: 'M8 6c1.5 0 2.9.6 4 1.6l-1.6 1.6A3.4 3.4 0 0 0 8 8.2c-.9 0-1.7.4-2.4 1L4 7.6A5.7 5.7 0 0 1 8 6Z' }), h('circle', { cx: 8, cy: 10.4, r: 1.4 })),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 1.5 } },
        h('div', { style: { width: 20, height: 10, borderRadius: 3, border: '1px solid rgba(255,255,255,0.5)', padding: 1.5, boxSizing: 'border-box' } }, h('div', { style: { width: '42%', height: '100%', borderRadius: 1, background: '#fff' } })),
        h('div', { style: { width: 1.5, height: 4, borderRadius: 1, background: 'rgba(255,255,255,0.5)' } })));
    const stat = (value: string, unit: string, label: string, accent = false) => {
      const color = accent ? '#F0842E' : '#FFFFFF';
      const dim = accent ? 'rgba(240,132,46,0.85)' : 'rgba(255,255,255,0.42)';
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 2 } }, h('span', { style: { fontSize: 15, fontWeight: 700, color, letterSpacing: '-0.02em' } }, value), h('span', { style: { fontSize: 8, fontWeight: 600, color: dim } }, unit)),
        h('span', { style: { fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', color: dim } }, label));
    };
    const lineIcon = (size: number, width: number, paths: string[], join = false) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: join ? 'round' : undefined }, paths.map((d) => h('path', { d })));

    const chrome = () => [
      h('div', { style: { position: 'absolute', top: 14, left: 18, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } }, h('span', { style: { fontSize: 13, fontWeight: 700 } }, '9:41'), lineIcon(12, 2, ['M6 8a6 6 0 0 1 9-5', 'M18 8v5l2 3H8', 'M10.5 19a2 2 0 0 0 3 0', 'M3 3l18 18'])),
        statusIcons()),
      h('div', { style: { position: 'absolute', top: 40, left: 18, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('span', { style: { fontSize: 10, color: 'rgba(255,255,255,0.5)' } }, 'System voice'), h('span', { style: { fontSize: 11, fontWeight: 600, color: '#fff' } }, 'Save')),
      h('div', { style: { position: 'absolute', top: 60, right: 16, display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600 } }, 'Eddy', lineIcon(9, 3, ['M6 9l6 6 6-6'], true)),
      h('div', { style: { position: 'absolute', top: 86, left: 18, right: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
        h('div', { style: { display: 'flex', gap: 14 } }, stat('16.5', 'mph', 'AVG'), stat('147', 'bpm', 'AVG HR •', true), stat('26.0', 'mph', 'MAX'), stat('606', 'ft', 'ASCENT')),
        h('div', { style: { width: 26, height: 26, borderRadius: 999, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, lineIcon(13, 2, ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'], true)))
    ];

    const demo = (frame: number) => {
      const ease = S.Easing.bezier(0.2, 0.6, 0.35, 1);
      const drawn = S.interpolate(frame, [12, 128], [0, 1], { ...CLAMP, easing: ease });
      const fillIn = S.interpolate(frame, [70, 150], [0, 1], CLAMP);
      const head = pointAt(drawn);
      const hint = S.interpolate(frame, [0, 8, 70, 88], [0, 1, 1, 0], CLAMP);
      const routeSvg = h('svg', { width: SCREEN_W, height: SCREEN_H, viewBox: `0 0 ${SCREEN_W} ${SCREEN_H}`, style: { position: 'absolute', inset: 0 } },
        h('defs', null,
          h('linearGradient', { id: 'pf-elev', x1: 0, y1: 340, x2: 0, y2: 470, gradientUnits: 'userSpaceOnUse' }, h('stop', { offset: 0, stopColor: '#7FA85E', stopOpacity: 0.32 }), h('stop', { offset: 0.55, stopColor: '#BE9150', stopOpacity: 0.28 }), h('stop', { offset: 1, stopColor: '#DE8138', stopOpacity: 0.42 })),
          h('filter', { id: 'pf-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, h('feGaussianBlur', { stdDeviation: 4.5 }))),
        h('path', { d: routePath, fill: 'url(#pf-elev)', opacity: fillIn }),
        PILLS.map((q) => h('line', { x1: q.anchor[0], y1: q.anchor[1], x2: q.x + 22, y2: q.y + 30, stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1, opacity: S.interpolate(frame, [q.appear, q.appear + 10], [0, 1], CLAMP) })),
        h('path', { d: routePath, fill: 'none', stroke: '#FFEBD6', strokeWidth: 7, strokeLinecap: 'round', opacity: 0.55, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawn, filter: 'url(#pf-glow)' }),
        h('path', { d: routePath, fill: 'none', stroke: '#FFFFFF', strokeWidth: 2.4, strokeLinecap: 'round', pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawn }),
        PILLS.map((q) => h('circle', { cx: q.anchor[0], cy: q.anchor[1], r: 2.4, fill: '#EE8348', opacity: S.interpolate(frame, [q.appear, q.appear + 8], [0, 0.95], CLAMP) })),
        drawn > 0 ? [h('circle', { cx: head.x, cy: head.y, r: 7, fill: '#FFFFFF', filter: 'url(#pf-glow)' }), h('circle', { cx: head.x, cy: head.y, r: 3.4, fill: '#FFFFFF' })] : null);
      const pills = PILLS.map((q) => {
        const k = S.interpolate(frame, [q.appear, q.appear + 12], [0, 1], { ...CLAMP, easing: ease });
        return h('div', { style: { position: 'absolute', left: q.x, top: q.y, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px 4px 4px', borderRadius: 999, background: 'rgba(26,24,23,0.82)', border: '1px solid rgba(255,255,255,0.07)', opacity: k, transform: `translateY(${(1 - k) * 6}px)` } },
          h('div', { style: { width: 18, height: 18, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, pillIcon(q.icon, q.tint)),
          h('div', { style: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 } }, h('span', { style: { fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', color: '#F4F1EC' } }, q.title), h('span', { style: { fontSize: 8, color: 'rgba(232,227,220,0.6)' } }, q.sub)));
      });
      return h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#0A0A0B', fontFamily: face, textRendering: 'geometricPrecision', color: '#fff' } },
        h('div', { style: { position: 'absolute', inset: 0, opacity: fillIn, background: 'radial-gradient(120% 55% at 54% 90%, rgba(214,124,54,0.32), transparent 60%), radial-gradient(70% 40% at 46% 62%, rgba(104,158,92,0.24), transparent 62%)' } }),
        routeSvg, pills, chrome(),
        h('div', { style: { position: 'absolute', bottom: 54, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.34)', opacity: hint } }, 'Scrub along the bottom · Drag to explore'));
    };

    const media = (frame: number) => {
      const k = S.interpolate(frame, [4, 22], [0, 1], CLAMP);
      return h('img', { src: String(p.screenSrc), style: { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', opacity: k, filter: `blur(${(1 - k) * 8}px)` } });
    };

    const body = S.pick(p.bezelColor, String(t.foreground));
    const glass = S.pick(p.screenColor, String(t.card));
    const bodyRadius = Number(p.radius);
    const innerRadius = Math.max(4, bodyRadius - BEZEL);
    const dynamicIsland = p.showDynamicIsland === 'hide' ? null : h('div', { style: { position: 'absolute', top: 10, left: '50%', translate: '-50% 0px', width: 90, height: 26, borderRadius: 999, backgroundColor: String(island.background), zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 9 } }, h('div', { style: { width: 9, height: 9, borderRadius: 999, backgroundColor: String(island.card), border: `1px solid ${island.border}` } }));
    const screen = h('div', { style: { position: 'relative', width: '100%', height: '100%', borderRadius: innerRadius, backgroundColor: glass, overflow: 'hidden' } }) as HTMLElement;
    const device = h('div', { style: { position: 'relative', width: DEVICE_WIDTH, height: DEVICE_HEIGHT, borderRadius: bodyRadius, backgroundColor: body, padding: BEZEL, boxSizing: 'border-box', boxShadow: `0 24px 60px ${S.withAlpha(String(t.foreground), 0.18)}` } },
      SIDE_BUTTONS.map((b) => h('div', { style: { position: 'absolute', top: b.top, [b.side]: -3, width: 3, height: b.length, borderRadius: 2, backgroundColor: body } })), screen);
    const orient = h('div', null, device) as HTMLElement;
    const crane = h('div', null, orient) as HTMLElement;
    const rig = h('div', null, crane) as HTMLElement;
    view.root.replaceChildren(h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: face } }, rig));

    return (at) => {
      const frame = at * Number(p.speed);
      const pose = entrancePose(frame);
      const bob = p.floatLoop === 'off' ? 0 : floatOffset(frame);
      rig.style.opacity = String(pose.opacity);
      rig.style.translate = `0px ${pose.y + bob}px`;
      rig.style.rotate = `${pose.rot}deg`;
      rig.style.scale = `${pose.scale * Number(p.scale)}`;
      const cam = p.variant === 'showcase' ? showcasePose(frame) : null;
      crane.style.transform = cam ? `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})` : '';
      orient.style.transform = `perspective(1400px) rotateX(${cam ? cam.rotateX : 0}deg) rotateY(${cam ? cam.rotateY : p.variant === 'tilt' ? Number(p.tiltAngle) : 0}deg) rotateZ(${cam ? cam.rotateZ : 0}deg)`;
      screen.replaceChildren(...[p.screenSrc ? media(frame) : demo(frame), dynamicIsland].filter((e): e is Element => Boolean(e)));
    };
  }
};
