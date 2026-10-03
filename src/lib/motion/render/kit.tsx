import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Html5Audio, Html5Video, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import type { z } from 'zod';
import type { COMPONENTS, ComponentId } from '../components';
import { Ease, ease } from '../design';
import { resolveColor, type BrandTokens } from '../brand';
import { boxOf, moveTransform } from '../layout';
import { FONT_FAMILY, INK, MONO, SANS } from './theme';

export type KitContext = { tokens: BrandTokens; assetUrl: (id: string | null) => string | null; trimStart: number };

export const Kit = createContext<KitContext>({ tokens: { name: '', colors: {} as BrandTokens['colors'], logoUrl: null }, assetUrl: () => null, trimStart: 0 });

export type PropsOf<K extends ComponentId> = z.output<(typeof COMPONENTS)[K]['schema']>;

type Placed = PropsOf<'Title'>;
type LayoutProps = Pick<Placed, 'x' | 'y' | 'width' | 'height' | 'align' | 'opacity' | 'scale' | 'rotation' | 'move' | 'easing'>;

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

function useColor(value: string): string {
  return resolveColor(value, useContext(Kit).tokens);
}

function useUnit(): number {
  const { width, height } = useVideoConfig();
  return Math.min(width, height);
}

const Box: React.FC<{ p: LayoutProps; children: React.ReactNode; clip?: boolean }> = ({ p, children, clip }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const box = boxOf(p, { width, height });
  const motion = moveTransform(p.move, p.easing, frame, durationInFrames);
  return (
    <div
      style={{
        position: 'absolute',
        ...box,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: JUSTIFY[p.align],
        textAlign: p.align,
        opacity: p.opacity,
        transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
        overflow: clip ? 'hidden' : 'visible'
      }}
    >
      <div style={{ width: '100%', height: clip ? '100%' : undefined, transform: motion }}>{children}</div>
    </div>
  );
};

const REVEAL_FRAMES = 16;
const LINE_STAGGER = 5;

const Title: React.FC<{ p: PropsOf<'Title'> }> = ({ p }) => {
  const frame = useCurrentFrame();
  const size = p.size * useUnit();
  const color = useColor(p.color);
  return (
    <Box p={p}>
      <div style={{ fontFamily: FONT_FAMILY[p.font], fontWeight: 500, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.045em', color }}>
        {p.text.split('\n').map((line, i) => {
          const t = ease(p.easing, (frame - i * LINE_STAGGER) / REVEAL_FRAMES);
          return (
            <div key={i} style={{ overflow: 'hidden', paddingBottom: size * 0.08, marginBottom: -size * 0.08 }}>
              <div style={{ transform: `translateY(${(1 - t) * 105}%)` }}>{line || ' '}</div>
            </div>
          );
        })}
      </div>
    </Box>
  );
};

const FADE_FRAMES = 18;

const Text: React.FC<{ p: PropsOf<'Text'> }> = ({ p }) => {
  const frame = useCurrentFrame();
  const t = ease(p.easing, frame / FADE_FRAMES);
  return (
    <Box p={p}>
      <div
        style={{
          fontFamily: FONT_FAMILY[p.font],
          fontSize: p.size * useUnit(),
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
          color: useColor(p.color),
          whiteSpace: 'pre-wrap',
          opacity: t,
          transform: `translateY(${(1 - t) * 16}px)`
        }}
      >
        {p.text}
      </div>
    </Box>
  );
};

const Kicker: React.FC<{ p: PropsOf<'Kicker'> }> = ({ p }) => (
  <Box p={p}>
    <div style={{ fontFamily: p.font === 'sans' ? SANS : MONO, fontSize: p.size * useUnit(), color: useColor(p.color), letterSpacing: '0.02em', textTransform: 'uppercase' }}>
      {p.text}
    </div>
  </Box>
);

const Caption: React.FC<{ p: PropsOf<'Caption'> }> = ({ p }) => {
  const size = p.size * useUnit();
  return (
    <Box p={p}>
      <span
        style={{
          fontFamily: FONT_FAMILY[p.font],
          fontSize: size,
          fontWeight: 500,
          color: useColor(p.color),
          background: useColor(p.background),
          padding: `${size * 0.25}px ${size * 0.5}px`,
          lineHeight: 1.25
        }}
      >
        {p.text}
      </span>
    </Box>
  );
};

const Missing: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ width: '100%', height: '100%', background: INK.paper2, color: INK.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 24 }}>
    {label}
  </div>
);

const Image: React.FC<{ p: PropsOf<'Image'> }> = ({ p }) => {
  const url = useContext(Kit).assetUrl(p.assetId);
  return <Box p={p} clip>{url ? <Img src={url} style={{ width: '100%', height: '100%', objectFit: p.fit, display: 'block' }} /> : <Missing label="Pick an image" />}</Box>;
};

const Video: React.FC<{ p: PropsOf<'Video'> }> = ({ p }) => {
  const { assetUrl, trimStart } = useContext(Kit);
  const url = assetUrl(p.assetId);
  return (
    <Box p={p} clip>
      {url ? <Html5Video src={url} trimBefore={trimStart} volume={p.volume} style={{ width: '100%', height: '100%', objectFit: p.fit }} /> : <Missing label="Pick a video" />}
    </Box>
  );
};

const Audio: React.FC<{ p: PropsOf<'Audio'> }> = ({ p }) => {
  const { assetUrl, trimStart } = useContext(Kit);
  const url = assetUrl(p.assetId);
  return url ? <Html5Audio src={url} trimBefore={trimStart} volume={p.volume} /> : null;
};

const SHAPE_RADIUS = { rect: '0', circle: '50%', line: '0' } as const;

const Shape: React.FC<{ p: PropsOf<'Shape'> }> = ({ p }) => {
  const frame = useCurrentFrame();
  const grow = p.shape === 'line' ? ease(p.easing, frame / REVEAL_FRAMES) : 1;
  return (
    <Box p={p} clip>
      <div style={{ width: `${grow * 100}%`, height: '100%', background: useColor(p.fill), borderRadius: SHAPE_RADIUS[p.shape] }} />
    </Box>
  );
};

const Logo: React.FC<{ p: PropsOf<'Logo'> }> = ({ p }) => {
  const { assetUrl, tokens } = useContext(Kit);
  const url = assetUrl(p.assetId) ?? tokens.logoUrl;
  return (
    <Box p={p}>
      {url ? (
        <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: p.height * useUnit() * 0.5, color: tokens.colors['brand.text'], letterSpacing: '-0.04em' }}>{tokens.name}</div>
      )}
    </Box>
  );
};

const PATTERNS: Record<PropsOf<'BrandBackground'>['pattern'], (accent: string) => React.CSSProperties> = {
  solid: () => ({}),
  dots: (accent) => ({ backgroundImage: `radial-gradient(${accent}55 1.4px, transparent 1.4px)`, backgroundSize: '26px 26px' }),
  grid: (accent) => ({ backgroundImage: `linear-gradient(${accent}33 1px, transparent 1px), linear-gradient(90deg, ${accent}33 1px, transparent 1px)`, backgroundSize: '64px 64px' }),
  gradient: (accent) => ({ backgroundImage: `radial-gradient(ellipse at 70% 20%, ${accent}66, transparent 60%)` })
};

const BrandBackground: React.FC<{ p: PropsOf<'BrandBackground'> }> = ({ p }) => {
  const accent = useColor(p.accent);
  return <AbsoluteFill style={{ background: useColor(p.fill), opacity: p.opacity, ...PATTERNS[p.pattern](accent) }} />;
};

const ProductCard: React.FC<{ p: PropsOf<'ProductCard'> }> = ({ p }) => {
  const url = useContext(Kit).assetUrl(p.assetId);
  const size = p.size * useUnit();
  const color = useColor(p.color);
  return (
    <Box p={p} clip>
      <div style={{ width: '100%', height: '100%', background: useColor(p.card), border: `1px solid ${INK.line}`, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY[p.font] }}>
        <div style={{ flex: 1, position: 'relative', background: INK.paper2 }}>{url ? <Img src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: size * 0.6, fontSize: size, color }}>
          <span style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>{p.title}</span>
          <span style={{ fontFamily: MONO }}>{p.price}</span>
        </div>
      </div>
    </Box>
  );
};

const SocialMockup: React.FC<{ p: PropsOf<'SocialMockup'> }> = ({ p }) => {
  const url = useContext(Kit).assetUrl(p.assetId);
  const unit = useUnit() * 0.028;
  const dark = p.platform === 'tiktok';
  return (
    <Box p={p} clip>
      <div style={{ width: '100%', height: '100%', background: dark ? '#000' : INK.paper, color: dark ? '#fff' : INK.ink, border: `1px solid ${INK.line}`, display: 'flex', flexDirection: 'column', fontFamily: SANS, fontSize: unit }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: unit * 0.6, padding: unit * 0.7, fontWeight: 600 }}>
          <span style={{ width: unit * 1.6, height: unit * 1.6, background: INK.select, display: 'inline-block' }} />
          {p.handle}
        </div>
        <div style={{ flex: 1, position: 'relative', background: INK.paper2 }}>{url ? <Img src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
        <div style={{ padding: unit * 0.7, lineHeight: 1.35 }}>
          <b>{p.handle}</b> {p.caption}
        </div>
      </div>
    </Box>
  );
};

const CanvasMock: React.FC<{ p: PropsOf<'CanvasMock'> }> = ({ p }) => {
  const frame = useCurrentFrame();
  const url = useContext(Kit).assetUrl(p.assetId);
  const typed = p.prompt.slice(0, Math.floor(Math.min(1, frame / 45) * p.prompt.length));
  const wire = ease(Ease.Standard, (frame - 45) / 20);
  const reveal = ease(Ease.Standard, (frame - 70) / 20);
  return (
    <Box p={p} clip>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: INK.paper, backgroundImage: 'radial-gradient(#d4d4d0 1.2px, transparent 1.2px)', backgroundSize: '22px 22px', outline: '1px solid #2a2a2a', fontFamily: SANS, color: INK.ink, containerType: 'size' }}>
        <div style={{ position: 'absolute', left: '1.5%', top: '2%', background: INK.paper, border: `1px solid ${INK.line}`, padding: '1cqh 1.5cqw', fontSize: '2.4cqh', fontWeight: 500 }}>{p.title} / Canvas</div>
        <div style={{ position: 'absolute', left: '6%', top: '30%', width: '30%', height: '36%', background: INK.paper, border: `1px solid ${INK.line}`, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', padding: '2cqh', fontSize: '2.6cqh', lineHeight: 1.35 }}>
          {typed}
        </div>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M36,48 C46,48 46,40 56,40" fill="none" stroke="#2563eb" strokeWidth={0.4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - wire} />
        </svg>
        <div style={{ position: 'absolute', left: '56%', top: '14%', width: '34%', height: '70%', background: INK.paper2, border: `1px solid ${INK.line}`, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {url ? <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)` }} /> : null}
          <div style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(17,17,17,0.78)', color: '#fff', fontSize: '1.8cqh', padding: '3px 6px' }}>AI-generated</div>
        </div>
      </div>
    </Box>
  );
};

const LazyThree = React.lazy(() => import('./three-kit'));

const ThreeFallback: React.FC = () => <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK.inkSoft, fontFamily: MONO, fontSize: 24 }}>Loading 3D…</AbsoluteFill>;

const Model3D: React.FC<{ p: PropsOf<'Model3D'> }> = ({ p }) => (
  <React.Suspense fallback={<ThreeFallback />}>
    <LazyThree kind="model" p={p} />
  </React.Suspense>
);

const Shape3D: React.FC<{ p: PropsOf<'Shape3D'> }> = ({ p }) => (
  <React.Suspense fallback={<ThreeFallback />}>
    <LazyThree kind="shape" p={p} />
  </React.Suspense>
);

export const KIT: { [K in ComponentId]: React.FC<{ p: PropsOf<K> }> } = {
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
