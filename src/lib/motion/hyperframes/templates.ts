import type { z } from 'zod';
import type { COMPONENTS, ComponentId } from '../components';
import { Ease } from '../design';
import { boxOf, type Box } from '../layout';
import { TITLE_LINE_HEIGHT, fitTitleSize, safeBox } from '../fit';
import { css, esc, px } from './html';

export type PropsOf<K extends ComponentId> = z.output<(typeof COMPONENTS)[K]['schema']>;

export type Vars = Record<string, string | number>;

export type Tween = { target: string; from: Vars; to: Vars; at: number; duration: number; ease: Ease };

export type TemplateCtx<K extends ComponentId> = {
  id: string;
  p: PropsOf<K>;
  width: number;
  height: number;
  unit: number;
  start: number;
  length: number;
  fps: number;
  color: (value: string) => string;
  asset: (id: string | null) => string | null;
  logoUrl: string | null;
  brandName: string;
  mediaStart: number;
};

export enum Timing {
  Wrapper = 'wrapper',
  Media = 'media'
}

export type Template<K extends ComponentId> = {
  timing: Timing;
  html: (ctx: TemplateCtx<K>) => string;
  tweens?: (ctx: TemplateCtx<K>) => Tween[];
};

export const SANS = "'DM Sans', system-ui, sans-serif";
export const MONO = "'Fragment Mono', ui-monospace, monospace";
export const FONT_FAMILY = { sans: SANS, mono: MONO } as const;
export const INK = { paper: '#ffffff', paper2: '#f5f5f3', line: '#e4e4e2', ink: '#111111', inkSoft: '#6b6b6b', select: '#a855f7' } as const;

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;
const REVEAL = 16;
const LINE_STAGGER = 5;
const FADE = 18;

type Placed = Pick<PropsOf<'Title'>, 'x' | 'y' | 'width' | 'height' | 'align' | 'opacity' | 'scale' | 'rotation'>;

function boxCss(box: Box): Record<string, string> {
  return { position: 'absolute', left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height) };
}

export function placed(ctx: { id: string; width: number; height: number }, p: Placed, inner: string, clip = false, box: Box = boxOf(p, ctx)): string {
  const style = css({
    ...boxCss(box),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: JUSTIFY[p.align],
    textAlign: p.align,
    opacity: p.opacity,
    transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
    overflow: clip ? 'hidden' : 'visible'
  });
  return `<div class="box" style="${style}"><div class="mv" id="mv-${ctx.id}" style="${css({ width: '100%', height: clip ? '100%' : undefined })}">${inner}</div></div>`;
}

const frames = (ctx: { fps: number }, n: number) => n / ctx.fps;

const missing = (label: string) =>
  `<div style="${css({ width: '100%', height: '100%', background: INK.paper2, color: INK.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '24px' })}">${esc(label)}</div>`;

const cover = (url: string, fit: string) => `<img src="${esc(url)}" alt="" style="${css({ width: '100%', height: '100%', objectFit: fit, display: 'block' })}" />`;

const Title: Template<'Title'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const box = safeBox(boxOf(ctx.p, ctx), ctx);
    const size = fitTitleSize(ctx.p.text, ctx.p.size * ctx.unit, box);
    const lines = ctx.p.text
      .split('\n')
      .map(
        (line, i) =>
          `<div style="${css({ overflow: 'hidden', paddingBottom: px(size * 0.08), marginBottom: px(-size * 0.08) })}"><div class="li" id="li-${ctx.id}-${i}">${esc(line) || '&nbsp;'}</div></div>`
      )
      .join('');
    const style = css({ fontFamily: FONT_FAMILY[ctx.p.font], fontWeight: 500, fontSize: px(size), lineHeight: TITLE_LINE_HEIGHT, letterSpacing: '-0.045em', color: ctx.color(ctx.p.color) });
    return placed(ctx, ctx.p, `<div style="${style}">${lines}</div>`, false, box);
  },
  tweens: (ctx) =>
    ctx.p.text.split('\n').map((_, i) => ({
      target: `#li-${ctx.id}-${i}`,
      from: { yPercent: 105 },
      to: { yPercent: 0 },
      at: ctx.start + frames(ctx, i * LINE_STAGGER),
      duration: frames(ctx, REVEAL),
      ease: ctx.p.easing
    }))
};

const Text: Template<'Text'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const style = css({ fontFamily: FONT_FAMILY[ctx.p.font], fontSize: px(ctx.p.size * ctx.unit), lineHeight: 1.3, letterSpacing: '-0.01em', color: ctx.color(ctx.p.color), whiteSpace: 'pre-wrap' });
    return placed(ctx, ctx.p, `<div id="tx-${ctx.id}" style="${style}">${esc(ctx.p.text)}</div>`);
  },
  tweens: (ctx) => [{ target: `#tx-${ctx.id}`, from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, at: ctx.start, duration: frames(ctx, FADE), ease: ctx.p.easing }]
};

const Kicker: Template<'Kicker'> = {
  timing: Timing.Wrapper,
  html: (ctx) =>
    placed(
      ctx,
      ctx.p,
      `<div style="${css({ fontFamily: FONT_FAMILY[ctx.p.font === 'sans' ? 'sans' : 'mono'], fontSize: px(ctx.p.size * ctx.unit), color: ctx.color(ctx.p.color), letterSpacing: '0.02em', textTransform: 'uppercase' })}">${esc(ctx.p.text)}</div>`
    )
};

const Caption: Template<'Caption'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const size = ctx.p.size * ctx.unit;
    const style = css({
      fontFamily: FONT_FAMILY[ctx.p.font],
      fontSize: px(size),
      fontWeight: 500,
      color: ctx.color(ctx.p.color),
      background: ctx.color(ctx.p.background),
      padding: `${px(size * 0.25)} ${px(size * 0.5)}`,
      lineHeight: 1.25
    });
    return placed(ctx, ctx.p, `<span style="${style}">${esc(ctx.p.text)}</span>`);
  }
};

const Image: Template<'Image'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId);
    return placed(ctx, ctx.p, url ? cover(url, ctx.p.fit) : missing('Pick an image'), true);
  }
};

const Video: Template<'Video'> = {
  timing: Timing.Media,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId);
    if (!url) {
      return placed(ctx, ctx.p, missing('Pick a video'), true);
    }
    const media = ctx.p.volume > 0 ? `data-has-audio="true" data-volume="${ctx.p.volume}"` : 'muted';
    const video = `<video id="c-${ctx.id}" src="${esc(url)}" crossorigin="anonymous" preload="auto" ${media} playsinline data-start="${ctx.start}" data-duration="${ctx.length}" data-media-start="${ctx.mediaStart}" style="${css({ width: '100%', height: '100%', objectFit: ctx.p.fit, display: 'block' })}"></video>`;
    return placed(ctx, ctx.p, video, true);
  }
};

const Audio: Template<'Audio'> = {
  timing: Timing.Media,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId);
    return url ? `<audio id="c-${ctx.id}" src="${esc(url)}" crossorigin="anonymous" data-start="${ctx.start}" data-duration="${ctx.length}" data-media-start="${ctx.mediaStart}" data-volume="${ctx.p.volume}"></audio>` : '';
  }
};

const Shape: Template<'Shape'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const style = css({ width: '100%', height: '100%', background: ctx.color(ctx.p.fill), clipPath: ctx.p.shape === 'circle' ? 'circle(50%)' : undefined, transformOrigin: 'left center' });
    return placed(ctx, ctx.p, `<div id="sh-${ctx.id}" style="${style}"></div>`, true);
  },
  tweens: (ctx) => (ctx.p.shape === 'line' ? [{ target: `#sh-${ctx.id}`, from: { scaleX: 0 }, to: { scaleX: 1 }, at: ctx.start, duration: frames(ctx, REVEAL), ease: ctx.p.easing }] : [])
};

const Logo: Template<'Logo'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId) ?? ctx.logoUrl;
    const inner = url
      ? `<img src="${esc(url)}" alt="" style="${css({ width: '100%', height: '100%', objectFit: 'contain' })}" />`
      : `<div style="${css({ fontFamily: SANS, fontWeight: 600, fontSize: px(ctx.p.height * ctx.height * 0.5), color: ctx.color('brand.text'), letterSpacing: '-0.04em' })}">${esc(ctx.brandName)}</div>`;
    return placed(ctx, ctx.p, inner);
  }
};

const PATTERNS: Record<PropsOf<'BrandBackground'>['pattern'], (accent: string) => Record<string, string>> = {
  solid: () => ({}),
  dots: (a) => ({ backgroundImage: `radial-gradient(${a}55 1.4px, transparent 1.4px)`, backgroundSize: '26px 26px' }),
  grid: (a) => ({ backgroundImage: `linear-gradient(${a}33 1px, transparent 1px), linear-gradient(90deg, ${a}33 1px, transparent 1px)`, backgroundSize: '64px 64px' }),
  gradient: (a) => ({ backgroundImage: `radial-gradient(ellipse at 70% 20%, ${a}66, transparent 60%)` })
};

const BrandBackground: Template<'BrandBackground'> = {
  timing: Timing.Wrapper,
  html: (ctx) => `<div style="${css({ position: 'absolute', inset: '0', background: ctx.color(ctx.p.fill), opacity: ctx.p.opacity, ...PATTERNS[ctx.p.pattern](ctx.color(ctx.p.accent)) })}"></div>`
};

const ProductCard: Template<'ProductCard'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId);
    const size = ctx.p.size * ctx.unit;
    const card = css({ width: '100%', height: '100%', background: ctx.color(ctx.p.card), border: `1px solid ${INK.line}`, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY[ctx.p.font] });
    const row = css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: px(size * 0.6), fontSize: px(size), color: ctx.color(ctx.p.color) });
    return placed(
      ctx,
      ctx.p,
      `<div style="${card}"><div style="${css({ flex: 1, position: 'relative', background: INK.paper2, overflow: 'hidden' })}">${url ? cover(url, 'cover') : ''}</div><div style="${row}"><span style="font-weight:500;letter-spacing:-0.02em">${esc(ctx.p.title)}</span><span style="font-family:${MONO}">${esc(ctx.p.price)}</span></div></div>`,
      true
    );
  }
};

const SocialMockup: Template<'SocialMockup'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const url = ctx.asset(ctx.p.assetId);
    const unit = ctx.unit * 0.028;
    const dark = ctx.p.platform === 'tiktok';
    const frame = css({ width: '100%', height: '100%', background: dark ? '#000' : INK.paper, color: dark ? '#fff' : INK.ink, border: `1px solid ${INK.line}`, display: 'flex', flexDirection: 'column', fontFamily: SANS, fontSize: px(unit) });
    const head = `<div style="${css({ display: 'flex', alignItems: 'center', gap: px(unit * 0.6), padding: px(unit * 0.7), fontWeight: 600 })}"><span style="${css({ width: px(unit * 1.6), height: px(unit * 1.6), background: INK.select, display: 'inline-block' })}"></span>${esc(ctx.p.handle)}</div>`;
    const body = `<div style="${css({ flex: 1, position: 'relative', background: INK.paper2, overflow: 'hidden' })}">${url ? cover(url, 'cover') : ''}</div>`;
    const foot = `<div style="${css({ padding: px(unit * 0.7), lineHeight: 1.35 })}"><b>${esc(ctx.p.handle)}</b> ${esc(ctx.p.caption)}</div>`;
    return placed(ctx, ctx.p, `<div style="${frame}">${head}${body}${foot}</div>`, true);
  }
};

const CanvasMock: Template<'CanvasMock'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const box = boxOf(ctx.p, ctx);
    const u = box.height / 100;
    const url = ctx.asset(ctx.p.assetId);
    const board = css({ position: 'relative', width: '100%', height: '100%', background: INK.paper, backgroundImage: 'radial-gradient(#d4d4d0 1.2px, transparent 1.2px)', backgroundSize: '22px 22px', outline: '1px solid #2a2a2a', fontFamily: SANS, color: INK.ink, overflow: 'hidden' });
    const chip = css({ position: 'absolute', left: '1.5%', top: '2%', background: INK.paper, border: `1px solid ${INK.line}`, padding: `${px(u)} ${px(u * 1.5)}`, fontSize: px(u * 2.4), fontWeight: 500 });
    const node = (left: string, top: string, w: string, h: string, background: string = INK.paper) =>
      css({ position: 'absolute', left, top, width: w, height: h, background, border: `1px solid ${INK.line}`, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', overflow: 'hidden' });
    const label = (left: string, top: string, text: string) => `<div style="${css({ position: 'absolute', left, top, fontSize: px(u * 1.8), color: INK.inkSoft })}">${text}</div>`;
    const prompt = `<div id="pr-${ctx.id}" style="${css({ padding: px(u * 2), fontSize: px(u * 2.6), lineHeight: 1.35 })}">${esc(ctx.p.prompt)}</div>`;
    const wire = `<svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" viewBox="0 0 100 100" preserveAspectRatio="none"><path id="wr-${ctx.id}" d="M36,48 C46,48 46,40 56,40" fill="none" stroke="#2563eb" stroke-width="0.4" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"></path></svg>`;
    const result = `<div id="rs-${ctx.id}" style="${css({ position: 'absolute', inset: '0' })}">${url ? cover(url, 'cover') : ''}</div><div style="${css({ position: 'absolute', left: '8px', bottom: '8px', background: 'rgba(17,17,17,0.78)', color: '#fff', fontSize: px(u * 1.8), padding: '3px 6px' })}">AI-generated</div>`;
    return placed(
      ctx,
      ctx.p,
      `<div style="${board}"><div style="${chip}">${esc(ctx.p.title)} / Canvas</div>${label('6%', '26%', 'Text')}<div style="${node('6%', '30%', '30%', '36%')}">${prompt}</div>${wire}${label('56%', '10%', 'Image')}<div style="${node('56%', '14%', '34%', '70%', INK.paper2)}">${result}</div></div>`,
      true
    );
  },
  tweens: (ctx): Tween[] => [
    { target: `#pr-${ctx.id}`, from: { clipPath: 'inset(0 100% 0 0)' }, to: { clipPath: 'inset(0 0% 0 0)' }, at: ctx.start, duration: frames(ctx, 45), ease: Ease.Linear },
    { target: `#wr-${ctx.id}`, from: { strokeDashoffset: 1 }, to: { strokeDashoffset: 0 }, at: ctx.start + frames(ctx, 45), duration: frames(ctx, 20), ease: Ease.Standard },
    { target: `#rs-${ctx.id}`, from: { clipPath: 'inset(0 0 100% 0)' }, to: { clipPath: 'inset(0 0 0% 0)' }, at: ctx.start + frames(ctx, 70), duration: frames(ctx, 20), ease: Ease.Standard }
  ]
};

const threeStage = (ctx: { id: string; width: number; height: number }, p: { x: number; y: number; width: number; height: number }, backdrop: string | null) => {
  const box = boxOf(p, ctx);
  const back = backdrop ? `<div style="${css({ position: 'absolute', inset: '0', background: backdrop })}"></div>` : '';
  return `${back}<canvas id="three-${ctx.id}" width="${Math.round(box.width)}" height="${Math.round(box.height)}" style="${css(boxCss(box))}"></canvas>`;
};

const BACKDROP: Record<PropsOf<'Model3D'>['backdrop'], string | null> = {
  transparent: null,
  brand: 'brand.background',
  dark: '#0a0a0a',
  light: '#f5f5f3'
};

const Model3D: Template<'Model3D'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const backdrop = BACKDROP[ctx.p.backdrop];
    const stage = threeStage(ctx, ctx.p, backdrop ? ctx.color(backdrop) : null);
    return ctx.asset(ctx.p.assetId) ? stage : missing('Pick a 3D model');
  }
};

const Shape3D: Template<'Shape3D'> = {
  timing: Timing.Wrapper,
  html: (ctx) => {
    const backdrop = BACKDROP[ctx.p.backdrop];
    return threeStage(ctx, ctx.p, backdrop ? ctx.color(backdrop) : null);
  }
};

export const TEMPLATES: { [K in ComponentId]: Template<K> } = {
  Title,
  Text,
  Kicker,
  Caption,
  Image,
  Video,
  Audio,
  Shape,
  Logo,
  BrandBackground,
  ProductCard,
  SocialMockup,
  CanvasMock,
  Model3D,
  Shape3D
};
