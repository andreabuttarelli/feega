import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'channel-thread',
  title: 'Channel thread',
  about: 'A work chat filling itself in: avatars, bold names, typing dots, and a transcript that scrolls once per arrival.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Barlow'],
  props: {
    messages: { type: 'string', title: 'Messages: avatar > name time > text | ...', default: '> rhea 9:41 AM > Launch video by Thursday? | We have nothing shot. | > sam 9:42 AM > Already done. | Built it out of snapcn.', group: 'Content', maxLength: 2000 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 638;
    const REF_H = 354;
    const NAME_GAP = 37.59;
    const MSG_GAP = 46.01;
    const GROUP_GAP = 69;
    const START_Y = 158.9;
    const ANCHOR = 219.48;
    const AVATAR = 70;
    const AVATAR_X = 119.5;
    const AVATAR_RISE = 28;
    const TEXT_X = 202;
    const SIZE = 31.2;
    const TIME_SIZE = 24.9;
    const ASC = 28.95;
    const DOT = 5;
    const DOT_GAP = 8.4;
    const DOT_RISE = 5.7;
    const DOT_BEAT = 0.1;
    const LEAD = 3;
    const SCROLL = [[0, 0], [0.0167, 0.004], [0.05, 0.016], [0.0833, 0.044], [0.1167, 0.093], [0.15, 0.178], [0.1833, 0.289], [0.2167, 0.398], [0.25, 0.486], [0.2833, 0.557], [0.3167, 0.616], [0.35, 0.663], [0.3833, 0.702], [0.4167, 0.737], [0.45, 0.767], [0.4833, 0.791], [0.5167, 0.814], [0.55, 0.834], [0.5833, 0.852], [0.6167, 0.867], [0.65, 0.881], [0.6917, 0.893], [0.7167, 0.903], [0.75, 0.912], [0.7833, 0.919], [1.1, 1]];
    const FADE = [[10, 0.098], [25, 0.125], [40, 0.149], [55, 0.216], [70, 0.357], [85, 0.518], [100, 0.651], [115, 0.843], [140, 0.98], [175, 1]];
    const BEATS = [0, 12, 60, 84];
    const OPENS = [0, 12, 37, 72];
    const FACES: Record<string, string> = { '400': '7cHpv4kjgoGqM7E_DMs5', '500': '7cHqv4kjgoGqM7E3_-gs51os', '600': '7cHqv4kjgoGqM7E30-8s51os', '700': '7cHqv4kjgoGqM7E3t-4s51os' };
    const FACE = 'Channel Thread Barlow';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      Object.entries(FACES).forEach(([weight, file]) => {
        const loaded = new FontFace(FACE, `url(https://fonts.gstatic.com/s/barlow/v13/${file}.woff2) format("woff2")`, { weight });
        document.fonts.add(loaded);
        loaded.load().catch(() => undefined);
      });
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Barlow`);

    const read = (table: number[][], x: number) => {
      const first = table[0];
      const last = table[table.length - 1];
      if (x <= first[0]) {
        return first[1];
      }
      if (x >= last[0]) {
        return last[1];
      }
      for (let i = 1; i < table.length; i++) {
        const hi = table[i];
        const lo = table[i - 1];
        if (x <= hi[0]) {
          return lo[1] + ((hi[1] - lo[1]) * (x - lo[0])) / (hi[0] - lo[0]);
        }
      }
      return last[1];
    };

    const toMessages = (input: string) => {
      let head = { author: '', time: '', avatar: '' };
      return input.split('|').filter((m) => m.trim()).map((m) => {
        const parts = m.split('>').map((v) => v.trim());
        const text = parts.pop() ?? '';
        const who = parts.pop();
        if (who !== undefined) {
          const cut = who.indexOf(' ');
          head = { author: cut < 0 ? who : who.slice(0, cut), time: cut < 0 ? '' : who.slice(cut + 1), avatar: parts.pop() ?? '' };
        }
        return { ...head, text };
      });
    };

    const said = toMessages(String(p.messages)).filter((m) => m.text.trim());
    const groups: { person: string; time: string; avatar: string; lines: string[] }[] = [];
    for (const m of said) {
      const g = groups[groups.length - 1];
      if (g && g.person === m.author && g.time === m.time && g.avatar === m.avatar) {
        g.lines.push(m.text.trim());
        continue;
      }
      groups.push({ person: m.author, time: m.time, avatar: m.avatar, lines: [m.text.trim()] });
    }

    const lines: { y: number; group: number; head: boolean; text: string; at: number; opens: number }[] = [];
    let last = START_Y - NAME_GAP;
    groups.forEach((group, g) => {
      group.lines.forEach((text, m) => {
        const head = m === 0;
        const nameY = head ? (lines.length === 0 ? last : last + GROUP_GAP) : 0;
        const y = head ? nameY + NAME_GAP : last + MSG_GAP;
        const i = lines.length;
        lines.push({ y, group: g, head, text, at: BEATS[i] ?? 84 + 24 * (i - 3), opens: i === 0 ? Number.NEGATIVE_INFINITY : (OPENS[i] ?? 72 + 24 * (i - 3)) });
        last = y;
      });
    });

    const u = view.height / REF_H;
    const ox = (view.width - REF_W * u) / 2;
    const ink = String(t.foreground);
    const dim = String(t.mutedForeground);
    const dotColour = S.mixOklch(dim, ink, 0.3);
    const abs = (style: Record<string, string | number>) => ({ position: 'absolute', ...style });

    const avatarEl = (g: { person: string; avatar: string }) => {
      const box = { left: AVATAR_X * u, width: AVATAR * u, height: AVATAR * u, borderRadius: 8 * u, overflow: 'hidden' };
      if (g.avatar) {
        return S.h('img', { src: g.avatar, alt: '', style: abs({ ...box, objectFit: 'cover', maxWidth: 'none' }) }) as HTMLElement;
      }
      return S.h('div', { style: abs({ ...box, background: S.withAlpha(String(t.primary), 0.16), color: String(t.primary), fontSize: AVATAR * 0.45 * u, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }) }, g.person.slice(0, 1).toUpperCase()) as HTMLElement;
    };

    const rows = lines.map((l) => {
      const g = groups[l.group];
      const avatar = l.head ? avatarEl(g) : null;
      const name = l.head ? (S.h('div', { style: abs({ left: TEXT_X * u, fontSize: SIZE * u, lineHeight: 1, fontWeight: 700, color: ink }) }, g.person, S.h('span', { style: { fontSize: TIME_SIZE * u, fontWeight: 500, color: dim, marginLeft: 13.4 * u } }, g.time)) as HTMLElement) : null;
      const body = S.h('div', { style: abs({ left: TEXT_X * u, fontSize: SIZE * u, lineHeight: 1, color: ink }) }, l.text) as HTMLElement;
      const dots = [0, 1, 2].map((i) => S.h('div', { style: abs({ left: (TEXT_X + 3.3 + i * DOT_GAP) * u, width: DOT * u, height: DOT * u, borderRadius: '50%', background: dotColour }) }) as HTMLElement);
      return { avatar, name, body, dots };
    });

    const stage = S.h('div', { style: abs({ left: ox, top: 0, width: REF_W * u, height: REF_H * u, fontFamily: face, textRendering: 'geometricPrecision', whiteSpace: 'nowrap', overflow: 'hidden' }) }) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent' }, stage));

    const scrollAt = (now: number) => {
      let scroll = 0;
      let target = 0;
      for (const l of lines) {
        const want = Math.max(0, l.y - ANCHOR);
        const step = want - target;
        target = want;
        if (step <= 0) {
          continue;
        }
        scroll += step * read(SCROLL, (now - l.opens / view.fps) * (step / MSG_GAP) ** 0.68);
      }
      return scroll;
    };

    return (frame) => {
      const now = frame / view.fps;
      const scroll = scrollAt(now);
      const shownEls: HTMLElement[] = [];
      lines.forEach((l, i) => {
        const y = l.y - scroll;
        if (y < -MSG_GAP || y > REF_H + MSG_GAP || frame < l.opens) {
          return;
        }
        const r = rows[i];
        const arrived = frame >= l.opens + LEAD;
        const bodyA = read(FADE, y);
        if (l.head && arrived && r.avatar && r.name) {
          r.avatar.style.top = `${(y - NAME_GAP - AVATAR_RISE) * u}px`;
          r.avatar.style.opacity = String(read(FADE, y - NAME_GAP - AVATAR_RISE + AVATAR / 2));
          r.name.style.top = `${(y - NAME_GAP - ASC) * u}px`;
          r.name.style.opacity = String(read(FADE, y - NAME_GAP));
          shownEls.push(r.avatar, r.name);
        }
        if (frame >= l.at) {
          r.body.style.top = `${(y - ASC) * u}px`;
          r.body.style.opacity = String(bodyA);
          shownEls.push(r.body);
          return;
        }
        if (!l.head || !arrived) {
          return;
        }
        const step = Math.floor(((now - (l.opens + LEAD) / view.fps) % (DOT_BEAT * 4)) / DOT_BEAT);
        r.dots.forEach((d, k) => {
          d.style.top = `${(y - DOT_RISE) * u - (DOT / 2) * u}px`;
          d.style.opacity = String(k < step ? bodyA : 0);
          shownEls.push(d);
        });
      });
      stage.replaceChildren(...shownEls);
    };
  }
};
