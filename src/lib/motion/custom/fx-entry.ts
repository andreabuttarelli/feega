import { FX_GLOBAL } from './fx';

type Timeline = { fromTo: (target: object, from: object, to: object, at: number) => void };
type Clip = { tl: Timeline; length: number; seed: number };
type Timing = { at?: number; duration?: number; cycles?: number; ease?: string };
type Colors = { colors?: string[] };

const VARIABLES = ['--fx-gradient', '--fx-border', '--fx-grid', '--fx-shimmer', '--fx-grain', '--fx-marquee'];
const DEFAULT_COLORS = ['#0b0d10', '#f4f5f7'];
const GRAIN_TILE = 240;
const GRAIN_STEP = [61, 43];

const registered = VARIABLES.map((name) => `@property ${name}{syntax:'<number>';inherits:true;initial-value:0}`).join('');

const stops = (colors: string[]) => [...colors, colors[0]].join(',');

const grainImage = (seed: number, frequency: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN_TILE}" height="${GRAIN_TILE}"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`;
  const encoded = encodeURIComponent(svg).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  return `url("data:image/svg+xml,${encoded}")`;
};

function effects({ tl, length, seed }: Clip) {
  let salt = 0;

  const drive = (el: HTMLElement, variable: string, { at = 0, duration = length - at, cycles = 1, ease = 'none' }: Timing) => {
    el.style.setProperty(variable, '0');
    if (cycles) {
      tl.fromTo(el, { [variable]: 0 }, { [variable]: cycles, duration, ease, immediateRender: false }, at);
    }
    return el;
  };

  const layer = (host: HTMLElement, name: string) => {
    const el = document.createElement('div');
    el.dataset.fx = name;
    Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    host.appendChild(el);
    return el;
  };

  return {
    gradient: (el: HTMLElement, { colors = DEFAULT_COLORS, ...timing }: Colors & Timing = {}) => {
      el.style.background = `conic-gradient(from calc(var(--fx-gradient) * 1turn), ${stops(colors)})`;
      return drive(el, '--fx-gradient', timing);
    },

    border: (el: HTMLElement, { colors = DEFAULT_COLORS, width = 2, fill = '#0b0d10', ...timing }: Colors & Timing & { width?: number; fill?: string } = {}) => {
      el.style.border = `${width}px solid transparent`;
      el.style.background = `linear-gradient(${fill}, ${fill}) padding-box, conic-gradient(from calc(var(--fx-border) * 1turn), ${stops(colors)}) border-box`;
      return drive(el, '--fx-border', timing);
    },

    grid: (el: HTMLElement, { size = 48, line = 1, color = 'rgba(244, 245, 247, 0.12)', pattern = 'lines', ...timing }: Timing & { size?: number; line?: number; color?: string; pattern?: 'lines' | 'dots' } = {}) => {
      el.style.backgroundImage = pattern === 'dots'
        ? `radial-gradient(circle, ${color} ${line}px, transparent ${line + 0.5}px)`
        : `linear-gradient(to right, ${color} ${line}px, transparent ${line}px), linear-gradient(to bottom, ${color} ${line}px, transparent ${line}px)`;
      el.style.backgroundSize = `${size}px ${size}px`;
      el.style.backgroundPosition = `calc(var(--fx-grid) * ${size}px) calc(var(--fx-grid) * ${size}px)`;
      return drive(el, '--fx-grid', { cycles: 0, ...timing });
    },

    shimmer: (el: HTMLElement, { base = '#8a8f98', light = '#f4f5f7', ...timing }: Timing & { base?: string; light?: string } = {}) => {
      el.style.backgroundImage = `linear-gradient(100deg, ${base} 40%, ${light} 50%, ${base} 60%)`;
      el.style.backgroundSize = '300% 100%';
      el.style.backgroundPosition = 'calc(100% - var(--fx-shimmer) * 100%) 0';
      el.style.setProperty('-webkit-background-clip', 'text');
      el.style.backgroundClip = 'text';
      el.style.color = 'transparent';
      return drive(el, '--fx-shimmer', timing);
    },

    grain: (host: HTMLElement, { opacity = 0.14, frequency = 0.8, boil = 0, at = 0, duration = length - at }: { opacity?: number; frequency?: number; boil?: number; at?: number; duration?: number } = {}) => {
      const el = layer(host, 'grain');
      el.style.backgroundImage = grainImage((seed + ++salt) % 1000, frequency);
      el.style.opacity = String(opacity);
      el.style.mixBlendMode = 'overlay';
      el.style.backgroundPosition = `calc(var(--fx-grain) * ${GRAIN_STEP[0]}px) calc(var(--fx-grain) * ${GRAIN_STEP[1]}px)`;
      const steps = Math.ceil(duration * boil);
      return drive(el, '--fx-grain', { at, duration, cycles: steps, ease: `steps(${steps})` });
    },

    marquee: (el: HTMLElement, { gap = 48, cycles = 1, at = 0, duration = length - at }: { gap?: number; cycles?: number; at?: number; duration?: number } = {}) => {
      const copy = () => {
        const part = document.createElement('div');
        Object.assign(part.style, { display: 'flex', flexShrink: '0', gap: `${gap}px`, paddingRight: `${gap}px` });
        return part;
      };
      const first = copy();
      first.append(...el.childNodes);
      const track = document.createElement('div');
      track.dataset.fx = 'marquee';
      Object.assign(track.style, { display: 'flex', width: 'max-content', transform: 'translateX(calc(var(--fx-marquee) * -50%))' });
      const second = first.cloneNode(true) as HTMLElement;
      second.setAttribute('aria-hidden', 'true');
      track.append(first, second);
      el.style.overflow = 'hidden';
      el.appendChild(track);
      track.style.setProperty('--fx-marquee', '0');
      tl.fromTo(track, { '--fx-marquee': 0 }, { '--fx-marquee': 1, duration: duration / cycles, ease: 'none', repeat: cycles - 1, immediateRender: false }, at);
      return track;
    }
  };
}

const style = document.createElement('style');
style.textContent = registered;
document.head.appendChild(style);

(window as unknown as Record<string, unknown>)[FX_GLOBAL] = Object.assign(effects, { notices: ['feega fx: own code, ideas after Magic UI (MIT) and web.dev @property recipes'] });
