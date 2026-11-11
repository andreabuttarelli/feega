import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'punch-lines',
  title: 'Punch lines',
  about: 'A script of short beats: lines slide in with motion blur or punch up word by word, ending on an accent card.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 144,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    script: { type: 'string', title: 'Script (| beats, / lines)', default: 'Videos from a prompt. / Edited on a canvas. | One frame. Every format. | feega.', group: 'Content', maxLength: 400 },
    styles: { type: 'string', title: 'Beat styles (slide,punch)', default: 'slide,punch', group: 'Content', maxLength: 120 },
    sizes: { type: 'string', title: 'Beat sizes', default: '1,0.945,2.7', group: 'Content', maxLength: 120 },
    holds: { type: 'string', title: 'Beat holds (frames)', default: '48', group: 'Motion', maxLength: 120 },
    accentBeat: { type: 'number', title: 'Accent beat (1-based)', default: 3, minimum: 0, maximum: 20, step: 1, group: 'Content' },
    lead: { type: 'number', title: 'Beat lead-in (frames)', default: 4, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 93, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    lineHeight: { type: 'number', title: 'Line height', default: 0.89, minimum: 0.5, maximum: 2, step: 0.01, group: 'Style' },
    letterSpacing: { type: 'string', title: 'Letter spacing', default: '-0.022em', group: 'Style', maxLength: 20 },
    wordSpacing: { type: 'string', title: 'Word spacing', default: '-0.02em', group: 'Style', maxLength: 20 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    ink: { type: 'string', title: 'Ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#ff1c8e', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    slideFrom: { type: 'number', title: 'Slide start (em)', default: -0.737, minimum: -5, maximum: 5, step: 0.001, group: 'Motion' },
    slideKick: { type: 'number', title: 'Slide kick', default: 7.34, minimum: 0, maximum: 30, step: 0.01, group: 'Motion' },
    slideSettle: { type: 'number', title: 'Slide settle', default: 2.846, minimum: 0.1, maximum: 20, step: 0.001, group: 'Motion' },
    lineStagger: { type: 'number', title: 'Line stagger (frames)', default: 3.5, minimum: 0, maximum: 30, step: 0.1, group: 'Motion' },
    slideDrop: { type: 'number', title: 'Slide drop (em)', default: 0.313, minimum: -2, maximum: 2, step: 0.001, group: 'Motion' },
    motionBlur: { type: 'number', title: 'Motion blur', default: 1, minimum: 0, maximum: 4, step: 0.05, group: 'Motion' },
    punchFrom: { type: 'number', title: 'Punch start scale', default: 0.32, minimum: 0, maximum: 1, step: 0.01, group: 'Motion' },
    punchFrames: { type: 'number', title: 'Punch length (frames)', default: 15, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (frames)', default: 2.8, minimum: 0, maximum: 30, step: 0.1, group: 'Motion' },
    pushFrom: { type: 'number', title: 'Push start scale', default: 0.778, minimum: 0.1, maximum: 2, step: 0.001, group: 'Motion' },
    pushRate: { type: 'number', title: 'Push rate (per s)', default: 0.205, minimum: 0, maximum: 2, step: 0.001, group: 'Motion' },
    rushLead: { type: 'number', title: 'Rush lead (frames)', default: 12.2, minimum: 0, maximum: 60, step: 0.1, group: 'Motion' },
    rushFrames: { type: 'number', title: 'Rush length (frames)', default: 18, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    rushTravel: { type: 'number', title: 'Rush travel', default: 0.85, minimum: 0, maximum: 0.99, step: 0.01, group: 'Motion' },
    fit: { type: 'number', title: 'Max width (fraction)', default: 0.92, minimum: 0.1, maximum: 1, step: 0.01, group: 'Layout' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Punch Lines Inter';
    let redraw = () => {};
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2) format("woff2")', { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().then(() => redraw()).catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Inter`);
    const n = (k: string) => Number(p[k]);
    const fps = view.fps;
    const width = view.width;
    const fontSize = n('fontSize');
    const fontWeight = n('fontWeight');
    const lineHeight = n('lineHeight');
    const letterSpacing = String(p.letterSpacing);
    const wordSpacing = String(p.wordSpacing);
    const slideFrom = n('slideFrom');
    const slideKick = n('slideKick');
    const slideSettle = n('slideSettle');
    const PUNCH_EASE = S.Easing.bezier(0.65, 0, 0.35, 1);
    const RUSH_EASE = S.Easing.bezier(1, 0, 0.48, 1);
    const type = S.pick(p.ink, String(t.foreground));
    const accent = S.pick(p.accentColor, '#ff1c8e');

    const list = (s: unknown) => String(s ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    const at = <T>(values: T[], i: number, fallback: T): T => (values.length === 0 ? fallback : values[Math.min(i, values.length - 1)]);
    const texts = String(p.script).split('|').map((s) => s.trim()).filter(Boolean);
    const styleList = list(p.styles);
    const sizeList = list(p.sizes).map(Number).filter(Number.isFinite);
    const holdList = list(p.holds).map(Number).filter(Number.isFinite);
    let revealAt = 0;
    const beats = texts.map((text, i) => {
      const hold = Math.max(1, at(holdList, i, 48));
      const beat = { lines: text.split('/').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/)), style: at(styleList, i, 'punch') === 'slide' ? 'slide' : 'punch', size: at(sizeList, i, 1), accent: i + 1 === n('accentBeat'), start: i === 0 ? 0 : revealAt - n('lead'), revealAt, end: revealAt + hold };
      revealAt += hold;
      return beat;
    });

    const swingOf = () => {
      const peakAt = slideKick > 0 ? Math.max(0, 1 / slideSettle - slideFrom / slideKick) : 0;
      const peak = (slideFrom + slideKick * peakAt) * Math.exp(-slideSettle * peakAt);
      return Math.max(Math.abs(slideFrom), Math.abs(peak));
    };

    const hidden = { position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap' };
    const baseRuler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('div', { style: hidden }, S.h('span', { style: { fontSize: 100, lineHeight: `${lineHeight * 100}px` } }, 'Hxg', baseRuler));
    const lineProbes = beats.map((beat) => beat.lines.map((words) => S.h('span', { style: { display: 'inline-block', fontSize: fontSize * beat.size, lineHeight: `${lineHeight}em`, letterSpacing, wordSpacing } }, words.join(' ')) as HTMLElement));
    const probes = S.h('div', { style: hidden }, lineProbes);
    const layer = S.h('div', { style: { position: 'absolute', inset: 0 } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent', fontFamily: face, fontWeight, textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' }, probe, probes, layer));
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

    const metricsOf = (beat: (typeof beats)[number]) => {
      ctx.font = `${fontWeight} 100px ${face}`;
      const a = ctx.measureText((beat.lines[0] ?? []).join(' ')).actualBoundingBoxAscent;
      const d = ctx.measureText((beat.lines[beat.lines.length - 1] ?? []).join(' ')).actualBoundingBoxDescent;
      return { rise: a > 0 ? a : 70, fall: Math.max(0, d) };
    };

    const card = (beat: (typeof beats)[number], bi: number, frame: number) => {
      const tt = (frame - beat.start) / fps;
      const widths = lineProbes[bi].map((el) => el.offsetWidth);
      const natural = widths.length ? Math.max(...widths) : 0;
      const maxPush = beat.style === 'punch' ? n('pushFrom') + n('pushRate') * ((beat.end - beat.start) / fps) : 1;
      const swing = beat.style === 'slide' ? swingOf() * fontSize * beat.size : 0;
      const need = natural * maxPush + 2 * swing;
      const fitW = width * n('fit');
      const shrink = need > fitW && need > 0 ? fitW / need : 1;
      const em = fontSize * beat.size * shrink;
      const L = lineHeight * em;
      const m = metricsOf(beat);
      const baseline = ((baseRuler.offsetTop || 88) / 100) * em;
      const dy = L / 2 - baseline + ((m.rise / 100) * em - (m.fall / 100) * em) / 2 + (beat.style === 'slide' ? n('slideDrop') * em : 0);
      const push = beat.style === 'punch' ? n('pushFrom') + n('pushRate') * Math.max(0, tt) : 1;
      const rushT = (frame - (beat.end - n('rushLead'))) / fps;
      const rush = beat.style === 'slide' && rushT > 0 ? 1 / (1 - n('rushTravel') * RUSH_EASE(Math.min(1, rushT / (n('rushFrames') / fps)))) : 1;
      let wordIndex = 0;
      const slide = (u: number) => (beat.style !== 'slide' ? 0 : u <= 0 ? slideFrom * em : (slideFrom * em + slideKick * em * u) * Math.exp(-slideSettle * u));
      const lines = beat.lines.map((words, li) => {
        const lt = tt - (li * n('lineStagger')) / fps;
        const x = slide(lt);
        const sigma = (n('motionBlur') * Math.abs(x - slide(lt - 1 / fps))) / Math.sqrt(12);
        const blurId = `punch-lines-${bi}-${li}`;
        const blur = sigma > 0.2 ? S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } }, S.h('filter', { id: blurId, x: '-25%', y: '-25%', width: '150%', height: '150%', colorInterpolationFilters: 'sRGB' }, S.h('feGaussianBlur', { stdDeviation: `${sigma} 0` }))) : null;
        const spans = words.map((word, wi) => {
          const w = wordIndex++;
          const wt = tt - (w * n('wordStagger')) / fps;
          const pr = beat.style === 'punch' ? PUNCH_EASE(Math.max(0, Math.min(1, wt / (n('punchFrames') / fps)))) : 1;
          const s = beat.style === 'punch' ? n('punchFrom') + (1 - n('punchFrom')) * pr : 1;
          return [wi > 0 ? ' ' : null, S.h('span', { style: { display: 'inline-block', transform: `scale(${s})`, transformOrigin: `50% ${L / 2}px` } }, word)];
        });
        return S.h('div', { style: { whiteSpace: 'nowrap', fontSize: em, lineHeight: `${L}px`, letterSpacing, wordSpacing, transform: `translateX(${x}px)`, filter: sigma > 0.2 ? `url(#${blurId})` : undefined } }, blur, spans);
      });
      const block = S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${dy}px)` } }, lines);
      return S.fill({ alignItems: 'center', justifyContent: 'center', color: beat.accent ? accent : type, transform: `scale(${push * rush})`, transformOrigin: '50% 50%' }, block);
    };

    const render = (at0: number) => {
      redraw = () => render(at0);
      const frame = at0 * n('speed');
      layer.replaceChildren(...beats.map((beat, i) => (frame < beat.revealAt || frame >= beat.end ? null : card(beat, i, frame))).filter((x): x is Element => x !== null));
    };
    return render;
  }
};
