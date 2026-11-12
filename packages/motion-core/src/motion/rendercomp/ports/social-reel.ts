import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'social-reel',
  title: 'Social reel',
  about: 'A vertical short-video player on a landscape stage cycles through a headline, a second line, an info card and a pulsing call to action.',
  category: RendercompCategory.Social,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#14151c',
  fonts: [],
  props: {
    brandName: { type: 'string', title: 'Brand name', default: 'Feega', group: 'Content', maxLength: 30 },
    handle: { type: 'string', title: 'Handle', default: '@feega', group: 'Content', maxLength: 30 },
    headline: { type: 'string', title: 'Headline', default: 'Make it', group: 'Content', maxLength: 40 },
    headlineAccent: { type: 'string', title: 'Headline accent', default: 'unmissable', group: 'Content', maxLength: 40 },
    secondCopy: { type: 'string', title: 'Second line (use \\n for a break)', default: 'Stories that\nscroll-stop', group: 'Content', maxLength: 80 },
    infoLines: { type: 'string', title: 'Info lines, separated by |', default: 'New drop / Studio Feega | Open daily 10:00 — 20:00 | Link in profile', group: 'Content', maxLength: 300 },
    ctaText: { type: 'string', title: 'Button text', default: 'Watch the full reel', group: 'Content', maxLength: 40 },
    caption: { type: 'string', title: 'Caption', default: 'behind the scenes ✦ no.07', group: 'Content', maxLength: 80 },
    likeCount: { type: 'string', title: 'Like count', default: '12.4k', group: 'Content', maxLength: 10 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#4f8cff', group: 'Style' },
    bgFrom: { type: 'string', title: 'Gradient start', format: PropFormat.Color, default: '#1b1d2a', group: 'Style' },
    bgVia: { type: 'string', title: 'Gradient middle', format: PropFormat.Color, default: '#222540', group: 'Style' },
    bgTo: { type: 'string', title: 'Gradient end', format: PropFormat.Color, default: '#10243f', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const DURATION = 150;
    const SANS = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE_OUT = S.Easing.out(S.Easing.ease);
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const accent = String(p.accentColor);
    const brandName = String(p.brandName);
    const sec = (s: number) => Math.round((s / 5) * 30);
    const PLAYER_W = 608;
    const PLAYER_H = 1080;
    const abs = { position: 'absolute' } as const;
    const centred = { alignItems: 'center', justifyContent: 'center' } as const;

    const infoLines = String(p.infoLines)
      .split('|')
      .map((l) => l.trim())
      .filter(Boolean);

    const glyph = (size: number, color: string, d: string) =>
      S.h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }, S.h('path', { d, stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round' }));

    const railItem = (icon: Element, label: string) => {
      const disc = S.h('div', { style: { width: 64, height: 64, borderRadius: 32, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, icon) as HTMLElement;
      const item = S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } }, disc, S.h('span', { style: { fontSize: 18, color: 'rgba(255,255,255,0.85)', fontFamily: SANS, fontWeight: 600 } }, label));
      return { item, disc };
    };
    const heart = railItem(glyph(30, accent, 'M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20z'), String(p.likeCount));
    const comment = railItem(glyph(28, '#ffffff', 'M4 5h16v11H9l-5 4V5z'), '318');
    const share = railItem(glyph(28, '#ffffff', 'M4 12l16-7-5 16-4-6-7-3z'), 'Share');
    const rail = S.h('div', { style: { ...abs, right: 28, bottom: 130, display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' } }, heart.item, comment.item, share.item);

    const topBar = S.h(
      'div',
      { style: { ...abs, top: 28, left: 28, right: 28, display: 'flex', alignItems: 'center', gap: 14, zIndex: 5 } },
      S.h('div', { style: { width: 56, height: 56, borderRadius: 28, background: `linear-gradient(135deg, ${accent}, ${S.withAlpha('#ffffff', 0x22 / 255)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 24, color: '#fff', border: '2px solid rgba(255,255,255,0.4)' } }, brandName.charAt(0).toUpperCase()),
      S.h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
        S.h('span', { style: { fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: SANS } }, brandName),
        S.h('span', { style: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontFamily: SANS } }, String(p.handle))
      ),
      S.h('div', { style: { marginLeft: 6, padding: '8px 20px', borderRadius: 22, border: '1.5px solid rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: SANS } }, 'Follow')
    );

    const progressBar = S.h('div', { style: { height: '100%', background: accent, borderRadius: 3 } }) as HTMLElement;
    const caption = S.h('div', { style: { ...abs, left: 28, bottom: 70, right: 130, display: 'flex', alignItems: 'center', gap: 10 } }, S.h('span', { style: { fontSize: 19, color: 'rgba(255,255,255,0.9)', fontFamily: SANS, fontWeight: 500 } }, String(p.caption)));
    const track = S.h('div', { style: { ...abs, left: 28, right: 28, bottom: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' } }, progressBar);

    const backdrop = S.fill({ background: `linear-gradient(150deg, ${String(p.bgFrom)} 0%, ${String(p.bgVia)} 50%, ${String(p.bgTo)} 100%)`, transformOrigin: 'center' }) as HTMLElement;
    const vignette = S.fill({ background: 'radial-gradient(120% 80% at 50% 35%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)' });

    const fadeBox = (child: Element) => S.h('div', null, child) as HTMLElement;
    const line = S.h('div', { style: { width: 120, height: 5, backgroundColor: accent, borderRadius: 3, transformOrigin: 'center' } }) as HTMLElement;
    const headlineText = S.h('div', { style: { fontSize: 78, fontWeight: 800, color: '#fff', fontFamily: SANS, textAlign: 'center', lineHeight: 1.08, letterSpacing: '-0.01em' } }, String(p.headline), S.h('br'), S.h('span', { style: { color: accent } }, String(p.headlineAccent)));
    const catchFade = fadeBox(S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 } }, line, headlineText));
    const secondFade = fadeBox(S.h('div', { style: { fontSize: 70, fontWeight: 800, color: '#fff', fontFamily: SANS, textAlign: 'center', lineHeight: 1.1, whiteSpace: 'pre-line' } }, String(p.secondCopy)));
    const infoFade = fadeBox(
      S.h(
        'div',
        { style: { padding: '28px 44px', background: 'rgba(0,0,0,0.55)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 } },
        infoLines.map((l) => S.h('div', { style: { fontSize: 30, fontWeight: 400, color: '#fff', fontFamily: SANS, lineHeight: 1.5, letterSpacing: '0.02em', textAlign: 'center' } }, l))
      )
    );
    const button = S.h('div', { style: { backgroundColor: accent, borderRadius: 50, padding: '18px 56px', boxShadow: `0 10px 32px ${S.withAlpha(accent, 0x55 / 255)}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS } }, S.h('span', { style: { fontSize: 34, fontWeight: 700, color: '#ffffff', letterSpacing: '0.01em' } }, String(p.ctaText))) as HTMLElement;

    const scene = (child: Element) => S.fill({ ...centred, display: 'none' }, child) as HTMLElement;
    const sceneCatch = scene(catchFade);
    const sceneSecond = scene(secondFade);
    const sceneInfo = scene(infoFade);
    const sceneCta = scene(button);

    const player = S.h(
      'div',
      { style: { width: PLAYER_W, height: PLAYER_H, borderRadius: 36, overflow: 'hidden', position: 'relative', boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.06)' } },
      S.fill({ background: String(p.bgFrom), overflow: 'hidden' }, backdrop, vignette, topBar, rail, caption, track, sceneCatch, sceneSecond, sceneInfo, sceneCta)
    );

    view.root.replaceChildren(S.fill({ background: 'radial-gradient(120% 120% at 50% 0%, #2a2d3a 0%, #14151c 55%, #0b0c11 100%)', ...centred, fontFamily: SANS }, player));

    const SCENES = [
      { el: sceneCatch, from: 0, duration: sec(8) },
      { el: sceneSecond, from: sec(8), duration: sec(7) },
      { el: sceneInfo, from: sec(8) + sec(7), duration: sec(13) + sec(10) - (sec(8) + sec(7)) },
      { el: sceneCta, from: sec(17), duration: sec(8) }
    ];

    const fadeIn = (box: HTMLElement, local: number, delay: number, duration: number) => {
      const progress = S.interpolate(local, [delay, delay + duration], [0, 1], { ...clamped, easing: EASE_OUT });
      box.style.opacity = String(progress);
      box.style.transform = `translateY(${(1 - progress) * 30}px)`;
    };

    return (frame) => {
      backdrop.style.transform = `scale(${S.interpolate(frame, [0, DURATION], [1, 1.08], { extrapolateRight: 'clamp' })})`;
      progressBar.style.width = `${S.interpolate(frame, [0, DURATION], [0, 1], { extrapolateRight: 'clamp' }) * 100}%`;
      heart.disc.style.transform = `scale(${1 + Math.max(0, Math.sin(((frame % 90) / 90) * Math.PI * 2)) * 0.12})`;

      SCENES.forEach((s) => {
        s.el.style.display = frame >= s.from && frame < s.from + s.duration ? 'flex' : 'none';
      });

      fadeIn(catchFade, frame - SCENES[0].from, 4, 16);
      line.style.transform = `scaleX(${S.interpolate(frame - SCENES[0].from, [6, 26], [0, 1], { ...clamped, easing: CUBIC_OUT })})`;
      fadeIn(secondFade, frame - SCENES[1].from, 2, 16);
      fadeIn(infoFade, frame - SCENES[2].from, 0, 18);

      const local = frame - SCENES[3].from;
      const entrance = S.spring({ frame: local, fps: FPS, config: { damping: 20, stiffness: 300 } });
      const pulse = S.interpolate(Math.sin(local * 0.08), [-1, 1], [0.97, 1.03]);
      button.style.opacity = String(entrance);
      button.style.transform = `scale(${entrance < 0.95 ? entrance : entrance * pulse})`;
    };
  }
};
