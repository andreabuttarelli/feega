import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'community-chat',
  title: 'Community chat',
  about: 'A team-chat window tilts through 3D while messages spring in one by one and reactions land under them. A desktop window; Phone chat is on a phone.',
  category: RendercompCategory.Social,
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 270,
  background: '#0b0d10',
  fonts: [],
  props: {
    workspaceName: { type: 'string', title: 'Workspace name', default: 'Feega', group: 'Content', maxLength: 40 },
    channelName: { type: 'string', title: 'Channel name', default: 'announcements', group: 'Content', maxLength: 40 },
    messages: {
      type: 'string',
      title: 'Messages: name > letter > colour > time > text > reacts',
      default: 'Feega Bot > F > #2f9e8f > Today 10:24 > New AI video pipeline is live 🎬 > 🎉 24, 👀 12 | Member 1 > M > #5cc89a > Today 10:25 > This looks amazing! | Member 2 > K > #7a5cd6 > Today 10:26 > Love the new UI 💚 > ❤️ 8 | Member 3 > S > #d68a3c > Today 10:28 > Can we share clips straight to social?',
      group: 'Content',
      maxLength: 2000
    },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#2f9e8f', group: 'Style' },
    tiltX: { type: 'number', title: 'Tilt X (deg)', default: 6, minimum: -30, maximum: 30, step: 1, group: 'Motion' },
    tiltStart: { type: 'number', title: 'Tilt Y start (deg)', default: 8, minimum: -30, maximum: 30, step: 1, group: 'Motion' },
    tiltEnd: { type: 'number', title: 'Tilt Y end (deg)', default: -8, minimum: -30, maximum: 30, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const DURATION = 270;
    const SANS = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const accent = String(p.accent);
    const C = {
      appBg: '#0b0d10',
      rail: '#15181d',
      sidebar: '#1b1f26',
      main: '#21262e',
      divider: '#15181d',
      accentSoft: S.withAlpha(accent, 0.15),
      accentBorder: S.withAlpha(accent, 0.4),
      textStrong: '#eef1f4',
      textBody: '#cdd3da',
      textMuted: '#8b929c',
      activeChan: '#343a44',
      composer: '#2a2f38',
      composerText: '#6c727c'
    };
    const workspaceName = String(p.workspaceName);
    const channelName = String(p.channelName);

    const messages = String(p.messages)
      .split('|')
      .map((raw) => raw.split('>').map((s) => s.trim()))
      .filter((f) => f.length >= 5)
      .map((f) => ({
        authorName: f[0],
        avatarLabel: f[1],
        avatarColor: f[2] || accent,
        time: f[3],
        text: f[4],
        reactions: (f[5] || '')
          .split(',')
          .map((r) => r.trim().split(' '))
          .filter((r) => r.length >= 2)
          .map((r) => ({ emoji: r[0], count: r[1] }))
      }));

    const avatar = (size: number, bg: string, fontSize: number, label: string) =>
      S.h('div', { style: { width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize, flexShrink: 0 } }, label);

    const message = (m: (typeof messages)[number]) =>
      S.h(
        'div',
        { style: { display: 'none', padding: '8px 20px', gap: 16, fontFamily: SANS } },
        avatar(42, m.avatarColor, 16, m.avatarLabel),
        S.h(
          'div',
          { style: { flex: 1, minWidth: 0 } },
          S.h(
            'div',
            { style: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 } },
            S.h('span', { style: { color: C.textStrong, fontWeight: 700, fontSize: 16 } }, m.authorName),
            S.h('span', { style: { color: C.textMuted, fontSize: 12 } }, m.time)
          ),
          S.h('div', { style: { color: C.textBody, fontSize: 16, lineHeight: 1.4, marginBottom: 6 } }, m.text),
          m.reactions.length > 0
            ? S.h(
                'div',
                { style: { display: 'flex', gap: 6, marginTop: 8 } },
                m.reactions.map((r) =>
                  S.h(
                    'div',
                    { style: { background: C.accentSoft, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '2px 8px', fontSize: 13, color: C.textBody, display: 'flex', alignItems: 'center', gap: 4 } },
                    S.h('span', { style: { fontSize: 14 } }, r.emoji),
                    S.h('span', null, r.count)
                  )
                )
              )
            : null
        )
      ) as HTMLElement;

    const workspaceIcon = (label: string, color: string, active: boolean) =>
      S.h(
        'div',
        { style: { width: 48, height: 48, borderRadius: active ? 16 : 24, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: SANS, marginBottom: 8, position: 'relative' } },
        label,
        active ? S.h('div', { style: { position: 'absolute', left: -16, top: 12, width: 4, height: 24, background: '#fff', borderRadius: 2 } }) : null
      );

    const channelRow = (text: string, style: Record<string, unknown>) => S.h('div', { style: { padding: '6px 10px', fontFamily: SANS, fontSize: 15, ...style } }, text);

    const messageEls = messages.map(message);

    const win = S.h(
      'div',
      { style: { width: '100%', height: '100%', background: C.rail, borderRadius: 12, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex' } },
      S.h(
        'div',
        { style: { width: 76, background: C.rail, paddingTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        workspaceIcon(workspaceName[0] || 'W', accent, true),
        S.h('div', { style: { width: 32, height: 2, background: C.sidebar, marginBottom: 8 } }),
        workspaceIcon('A', '#7a5cd6', false),
        workspaceIcon('B', '#d68a3c', false),
        workspaceIcon('C', '#3c9dd6', false)
      ),
      S.h(
        'div',
        { style: { width: 240, background: C.sidebar, display: 'flex', flexDirection: 'column' } },
        S.h('div', { style: { padding: '16px 18px', fontFamily: SANS, fontSize: 16, color: C.textStrong, fontWeight: 700, borderBottom: `1px solid ${C.divider}`, boxShadow: '0 1px 0 rgba(0,0,0,0.2)' } }, workspaceName),
        S.h(
          'div',
          { style: { padding: '16px 8px' } },
          S.h('div', { style: { fontFamily: SANS, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', padding: '0 8px 6px', fontWeight: 700, letterSpacing: 0.5 } }, 'Text Channels'),
          channelRow(`# ${channelName}`, { borderRadius: 4, background: C.activeChan, color: '#fff', marginBottom: 4 }),
          channelRow('# general', { color: C.textMuted, marginBottom: 4 }),
          channelRow('# random', { color: C.textMuted })
        )
      ),
      S.h(
        'div',
        { style: { flex: 1, background: C.main, display: 'flex', flexDirection: 'column' } },
        S.h(
          'div',
          { style: { padding: '14px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, color: C.textStrong, fontSize: 17, fontWeight: 700 } },
          S.h('span', { style: { color: C.textMuted } }, '#'),
          channelName
        ),
        S.h('div', { style: { flex: 1, padding: '16px 0', overflow: 'hidden' } }, messageEls),
        S.h(
          'div',
          { style: { padding: '12px 20px', borderTop: `1px solid ${C.divider}` } },
          S.h('div', { style: { background: C.composer, borderRadius: 8, padding: '10px 14px', fontFamily: SANS, fontSize: 14, color: C.composerText } }, `Message #${channelName}`)
        )
      )
    );

    const tilt = S.fill({ padding: 50 }, win) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: C.appBg, perspective: 1500 }, tilt));

    const tiltX = Number(p.tiltX);
    const tiltStart = Number(p.tiltStart);
    const tiltEnd = Number(p.tiltEnd);
    const STAGGER = Math.floor(FPS * 0.8);
    const SPRING = { damping: 18, stiffness: 110 };

    return (frame) => {
      const rotateY = S.interpolate(frame, [0, DURATION], [tiltStart, tiltEnd]);
      tilt.style.transform = `rotateX(${tiltX}deg) rotateY(${rotateY}deg)`;

      messageEls.forEach((el, i) => {
        const start = i * STAGGER;
        if (frame < start) {
          el.style.display = 'none';
          return;
        }

        const spr = S.spring({ frame: frame - start, fps: FPS, config: SPRING });
        el.style.display = 'flex';
        el.style.opacity = String(spr);
        el.style.transform = `translateY(${10 * (1 - spr)}px)`;
      });
    };
  }
};
