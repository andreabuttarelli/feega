import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'terminal-simulator',
  title: 'Terminal simulator',
  about: 'A camera whips from an intro line to an install command typing, then punches into a terminal printing output.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 200,
  background: '#0a0a0b',
  fonts: [],
  props: {
    intro: { type: 'string', title: 'Intro (*word* = accent)', default: '*work* one step at a *time.*', group: 'Content', maxLength: 160 },
    command: { type: 'string', title: 'Command', default: 'npm install One Tool', group: 'Content', maxLength: 160 },
    managers: { type: 'string', title: 'Package manager tabs (comma separated)', default: 'npm,pnpm,yarn,bun', group: 'Content', maxLength: 200 },
    lines: { type: 'string', title: 'Terminal lines (JSON: text, type, delay, pause)', default: '[{"text":"{labels: [\'bug\']})","type":"log","delay":0},{"text":"→   label added","type":"success","delay":6},{"text":"$","type":"log","delay":10},{"text":"One task","type":"command","delay":4}]', group: 'Content', maxLength: 2000 },
    panel: { type: 'string', title: 'Panel colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    borderColor: { type: 'string', title: 'Border colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    fontFamily: { type: 'string', title: 'Intro font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    fontSize: { type: 'number', title: 'Font scale base (px)', default: 18, minimum: 8, maximum: 48, step: 1, group: 'Style' },
    charsPerFrame: { type: 'number', title: 'Characters per frame', default: 2, minimum: 0.1, maximum: 20, step: 0.1, group: 'Motion' },
    chunkSize: { type: 'number', title: 'Typing chunk size', default: 3, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    zoom: { type: 'boolean', title: 'Custom landing zoom', default: false, group: 'Motion' },
    zoomScale: { type: 'number', title: 'Landing zoom scale', default: 2.4, minimum: 0.5, maximum: 6, step: 0.05, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const mode = String(p.mode);
    const t = S.themeOf(mode);
    const light = mode === 'light';
    const INTRO_POS = { x: 640, y: 360 };
    const CMD_POS = { x: 2140, y: 520 };
    const TERM_POS = { x: 2140, y: 1660 };
    const DRIFT_START = 22;
    const WHIP_START = 40;
    const CMD_ARRIVE = 70;
    const CMD_TYPE_START = 74;
    const PUSH_END = 112;
    const PULL_END = 138;
    const PUNCH_END = 158;
    const TERM_TYPE_START = 146;
    const CMD_W = 760;
    const CMD_H = 170;
    const TERM_BAR_OFFSET = 137;
    const TERM_TEXT_OFFSET = 90;
    const TERM_BLOCK_TOP = 215;
    const TERM_LINE_H = 83;
    const TERM_FONT = 44;
    const ACCENT_GRADIENT = 'linear-gradient(90deg, #7C96FF 0%, #A78BFA 100%)';
    const CMD_MANAGER_COLOR = '#A0673F';
    const CMD_SUBCOMMAND_COLOR = '#64789B';
    const CMD_ARG_COLOR = '#D7E4F8';
    const TERM_ACCENT = '#2EA043';
    const TERM_CURSOR = '#1D5B36';
    const TERM_COLORS: Record<string, string> = { command: '#F2F5F3', log: '#6E7873', success: '#1F8039', error: '#F04438' };
    const LIGHT_TERM_COLORS: Record<string, string> = { ...TERM_COLORS, command: '#141414' };
    const LIGHT_ARG_COLOR = '#1B2533';
    const MONO_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    const GHOSTS = [{ back: 2, alpha: 0.3, blur: 3 }, { back: 4, alpha: 0.18, blur: 6 }, { back: 6, alpha: 0.1, blur: 10 }];

    const parseLines = () => {
      try {
        const v = JSON.parse(String(p.lines));
        return Array.isArray(v) ? (v as { text: string; type: string; delay?: number; pause?: number }[]) : [];
      } catch {
        return [];
      }
    };
    const lines = parseLines();
    const intro = String(p.intro);
    const commandText = String(p.command);
    const managers = String(p.managers).split(',').map((s) => s.trim()).filter(Boolean);
    const face = S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif');
    const panel = S.pick(p.panel, String(t.card));
    const hairline = S.pick(p.borderColor, String(t.border));
    const ink = String(t.foreground);
    const inkMuted = String(t.mutedForeground);
    const fontScale = Number(p.fontSize) / 18;
    const cpf = Number(p.charsPerFrame);
    const chunk = Number(p.chunkSize);
    const speed = Number(p.speed);
    const stage = S.parseColor(String(t.background)).alpha === 0 ? 'transparent' : S.mixOklch(String(t.background), '#000', 0.35);
    const hasIntro = intro.trim().length > 0;
    const hasCommand = commandText.trim().length > 0;
    const landingZoom = p.zoom ? Number(p.zoomScale) : 1.5;

    const whip = S.Easing.bezier(0.7, 0, 0.25, 1);
    const punch = S.Easing.bezier(0.75, 0, 0.3, 1);
    const glide = S.Easing.bezier(0.35, 0, 0.55, 1);
    type Stop = { frame: number; x: number; y: number; z: number; easing?: (v: number) => number };
    const stops: Stop[] = [];
    if (hasIntro) {
      stops.push({ frame: 0, x: INTRO_POS.x, y: INTRO_POS.y, z: 1 }, { frame: DRIFT_START, x: INTRO_POS.x, y: INTRO_POS.y, z: 1 }, { frame: WHIP_START, x: INTRO_POS.x + 52, y: INTRO_POS.y, z: 1.02, easing: S.Easing.in(S.Easing.quad) });
    }
    if (hasCommand) {
      stops.push({ frame: hasIntro ? CMD_ARRIVE : 0, x: CMD_POS.x, y: CMD_POS.y, z: 1.55, easing: whip }, { frame: PUSH_END, x: CMD_POS.x, y: CMD_POS.y + 28, z: 1.9, easing: S.Easing.inOut(S.Easing.quad) }, { frame: PULL_END, x: CMD_POS.x, y: CMD_POS.y + 630, z: 0.95, easing: glide });
    }
    stops.push({ frame: hasCommand ? PUNCH_END : hasIntro ? CMD_ARRIVE : 0, x: TERM_POS.x, y: TERM_POS.y, z: landingZoom, easing: punch });

    const cameraAt = (frame: number) => {
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (frame <= first.frame) {
        return { x: first.x, y: first.y, z: first.z };
      }
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if (frame >= a.frame && frame < b.frame) {
          const k = (frame - a.frame) / (b.frame - a.frame);
          const e = b.easing ? b.easing(k) : k;
          return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e };
        }
      }
      return { x: last.x, y: last.y, z: last.z };
    };
    const cameraSpeed = (frame: number) => {
      const a = cameraAt(frame - 1);
      const b = cameraAt(frame);
      return Math.hypot(b.x - a.x, b.y - a.y) * b.z + Math.abs(b.z - a.z) * 360;
    };
    const worldTransform = (c: { x: number; y: number; z: number }) => `translate(${view.width / 2 - c.x * c.z}px, ${view.height / 2 - c.y * c.z}px) scale(${c.z})`;

    const chunkedReveal = (local: number, total: number) => {
      if (total <= 0) {
        return 0;
      }
      const linear = Math.floor(S.interpolate(local, [0, total / cpf], [0, total], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
      return Math.min(total, Math.ceil(linear / chunk) * chunk);
    };
    const autoPause = (line: { text: string; pause?: number }) => (line.pause !== undefined ? line.pause : line.text.replace(/\s+$/, '').endsWith('...') ? 18 : 0);
    const lineStarts = (leadIn: number) => {
      const starts: number[] = [];
      let acc = leadIn;
      for (const line of lines) {
        acc += line.delay ?? 8;
        starts.push(acc);
        acc += Math.ceil(line.text.length / (chunk * cpf)) + autoPause(line);
      }
      return starts;
    };
    const parseIntro = (text: string) => {
      const out: { text: string; accent: boolean }[] = [];
      const re = /\*([^*]+)\*/g;
      let last = 0;
      let m = re.exec(text);
      while (m !== null) {
        if (m.index > last) {
          out.push({ text: text.slice(last, m.index), accent: false });
        }
        out.push({ text: m[1], accent: true });
        last = m.index + m[0].length;
        m = re.exec(text);
      }
      if (last < text.length) {
        out.push({ text: text.slice(last), accent: false });
      }
      return out;
    };
    const commandSpans = (text: string, argColor: string) => {
      const out: { text: string; color: string }[] = [];
      let wordIndex = -1;
      for (const part of text.split(/(\s+)/)) {
        if (part.length === 0) {
          continue;
        }
        if (/^\s+$/.test(part)) {
          out.push({ text: part, color: argColor });
          continue;
        }
        wordIndex++;
        out.push({ text: part, color: wordIndex === 0 ? CMD_MANAGER_COLOR : wordIndex === 1 ? CMD_SUBCOMMAND_COLOR : argColor });
      }
      return out;
    };

    const introStation = (frame: number) => S.h('div', { style: { position: 'absolute', left: INTRO_POS.x, top: INTRO_POS.y, transform: 'translate(-50%, -50%)', whiteSpace: 'pre', fontFamily: face, fontSize: Math.round(58 * fontScale), fontWeight: 600, letterSpacing: '-0.01em' } }, parseIntro(intro).map((tok, i) => {
      const k = S.interpolate(frame, [2 + i * 4, 14 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.out(S.Easing.cubic) });
      const look = tok.accent ? { backgroundImage: ACCENT_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: ink };
      return S.h('span', { style: { ...look, opacity: k, filter: `blur(${(1 - k) * 3}px)` } }, tok.text);
    }));

    const commandStation = (frame: number, typeStart: number) => {
      const argColor = light ? LIGHT_ARG_COLOR : CMD_ARG_COLOR;
      const tabs = managers.length ? managers : ['npm'];
      const revealed = chunkedReveal(Math.max(0, frame - typeStart), commandText.length);
      const typingDone = revealed >= commandText.length;
      const blink = Math.floor((frame / view.fps) * 2) % 2 === 0;
      const tabFont = Math.round(20 * fontScale);
      const rowFont = Math.round(33 * fontScale);
      let acc = 0;
      const spans = commandSpans(commandText, argColor).map((sp) => {
        const start = acc;
        acc += sp.text.length;
        return S.h('span', { style: { color: sp.color } }, sp.text.slice(0, Math.max(0, Math.min(sp.text.length, revealed - start))));
      });
      const caret = !typingDone && frame >= typeStart && blink ? S.h('span', { style: { display: 'inline-block', width: rowFont * 0.55, height: rowFont, background: argColor, marginLeft: 2 } }) : null;
      const tabRow = S.h('div', { style: { height: 54, display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderBottom: `1px solid ${hairline}` } }, tabs.map((m, i) => S.h('div', { style: { fontSize: tabFont, fontWeight: i === 0 ? 600 : 500, padding: '7px 14px', borderRadius: 8, color: i === 0 ? ink : inkMuted, background: i === 0 ? S.withAlpha(ink, 0.1) : 'transparent' } }, m)));
      const row = S.h('div', { style: { display: 'flex', alignItems: 'center', height: CMD_H - 54, padding: '0 24px', fontSize: rowFont, letterSpacing: '0.01em', whiteSpace: 'pre' } }, spans, caret);
      return S.h('div', { style: { position: 'absolute', left: CMD_POS.x - CMD_W / 2, top: CMD_POS.y - CMD_H / 2, width: CMD_W, height: CMD_H, background: panel, borderRadius: 14, overflow: 'hidden', boxShadow: `0 0 0 1px ${hairline}, 0 30px 60px ${S.withAlpha(S.mixOklch(panel, '#000', 0.8), 0.55)}`, fontFamily: MONO_FAMILY } }, tabRow, row);
    };

    const terminalStation = (frame: number, typeStart: number) => {
      const starts = lineStarts(typeStart);
      const font = Math.round(TERM_FONT * fontScale);
      const blink = Math.floor((frame / view.fps) * 2) % 2 === 0;
      const bar = S.h('div', { style: { position: 'absolute', left: TERM_POS.x - TERM_BAR_OFFSET, top: TERM_POS.y - 520, width: 5, height: 1040, background: TERM_ACCENT, boxShadow: `0 0 22px ${S.withAlpha(TERM_ACCENT, 0.75)}` } });
      const rows = lines.map((line, index) => {
        const revealed = chunkedReveal(Math.max(0, frame - starts[index]), line.text.length);
        const typingDone = revealed >= line.text.length;
        const isLast = index === lines.length - 1;
        const showCursor = line.type === 'command' && frame >= starts[index] && (!typingDone || (isLast && blink));
        const cursor = showCursor ? S.h('span', { style: { display: 'inline-block', width: font * 0.6, height: font * 0.95, background: TERM_CURSOR, marginLeft: 6 } }) : null;
        return S.h('div', { style: { height: TERM_LINE_H, display: 'flex', alignItems: 'center', color: (light ? LIGHT_TERM_COLORS : TERM_COLORS)[line.type], fontSize: font, whiteSpace: 'pre' } }, S.h('span', null, line.text.substring(0, revealed)), cursor);
      });
      return [bar, S.h('div', { style: { position: 'absolute', left: TERM_POS.x - TERM_TEXT_OFFSET, top: TERM_POS.y - TERM_BLOCK_TOP, fontFamily: MONO_FAMILY } }, rows)];
    };

    const world = (frame: number) => S.h('div', { style: { position: 'absolute', left: 0, top: 0 } }, hasIntro ? introStation(frame) : null, hasCommand ? commandStation(frame, hasIntro ? CMD_TYPE_START : 8) : null, terminalStation(frame, hasCommand ? TERM_TYPE_START : hasIntro ? CMD_ARRIVE - 6 : 6));

    const root = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: stage, textRendering: 'geometricPrecision' } }) as HTMLElement;
    view.root.replaceChildren(root);

    return (at) => {
      const frame = at * speed;
      const trail = Math.min(1, Math.max(0, (cameraSpeed(frame) - 2) / 30));
      const ghosts = trail > 0.01 ? GHOSTS.map((g) => S.h('div', { style: { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: worldTransform(cameraAt(frame - g.back)), opacity: g.alpha * trail, filter: `blur(${g.blur * trail}px)`, pointerEvents: 'none' } }, world(frame))) : [];
      const camera = S.h('div', { style: { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: worldTransform(cameraAt(frame)) } }, world(frame));
      root.replaceChildren(...ghosts, camera);
    };
  }
};
