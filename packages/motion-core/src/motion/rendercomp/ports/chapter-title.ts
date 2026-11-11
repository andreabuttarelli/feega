import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'chapter-title',
  title: 'Chapter title',
  about: 'A spaced chapter label scales down into place, a divider line draws across, then the title and subtitle float in.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0d1117',
  fonts: [],
  props: {
    chapterLabel: { type: 'string', title: 'Chapter label', default: 'Chapter 1', group: 'Content', maxLength: 40 },
    title: { type: 'string', title: 'Title', default: 'Chapter One: The Beginning', group: 'Content', maxLength: 100 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Where the journey starts', group: 'Content', maxLength: 120 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0d1117', group: 'Style' },
    chapterColor: { type: 'string', title: 'Chapter colour', format: PropFormat.Color, default: '#d4af37', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = S.Easing.out(S.Easing.cubic);
    const outEase = S.Easing.out(S.Easing.ease);
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const portrait = height > width;
    const chapterFontSize = portrait ? width * 0.08 : height * 0.06;
    const titleFontSize = portrait ? width * 0.085 : height * 0.085;
    const subFontSize = portrait ? width * 0.028 : height * 0.026;
    const titleDelay = 45;
    const subtitle = String(p.subtitle);

    const grid = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px' } });
    const chapter = S.h('div', { style: { fontFamily: face, fontSize: chapterFontSize, fontWeight: 300, color: String(p.chapterColor), letterSpacing: 12, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' } }, String(p.chapterLabel)) as HTMLElement;
    const line = S.h('div', { style: { width: width * 0.4, height: 2, backgroundColor: String(p.chapterColor), transformOrigin: 'left center' } }) as HTMLElement;
    const titleBox = S.h('div', null, S.h('span', { style: { fontSize: titleFontSize, fontWeight: 900, color: String(p.titleColor), lineHeight: 1.2, textAlign: 'center' } }, String(p.title))) as HTMLElement;
    const subBox = S.h('div', null, S.h('span', { style: { fontSize: subFontSize, fontWeight: 400, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, textAlign: 'center' } }, subtitle)) as HTMLElement;
    const titleBlock = S.h('div', { style: { marginTop: 8 } }, S.h('div', { style: { display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', fontFamily: face, lineBreak: 'strict', overflowWrap: 'break-word', wordBreak: 'normal' } }, titleBox, subtitle ? subBox : null));
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.background), alignItems: 'center', justifyContent: 'center', gap: 32 }, grid, chapter, line, titleBlock));

    const floatIn = (box: HTMLElement, frame: number, delay: number) => {
      const progress = S.interpolate(frame, [delay, delay + 9], [0, 1], { ...clamped, easing: outEase });
      box.style.opacity = String(progress);
      box.style.transform = `translateY(${(1 - progress) * 15}px)`;
    };

    return (frame) => {
      chapter.style.transform = `scale(${S.interpolate(frame, [0, 20, 40], [3, 1.05, 1], { ...clamped, easing: outCubic })})`;
      chapter.style.opacity = String(S.interpolate(frame, [0, 18], [0, 1], clamped));
      line.style.transform = `scaleX(${S.interpolate(frame, [28, 48], [0, 1], { ...clamped, easing: outCubic })})`;

      floatIn(titleBox, frame, titleDelay);
      floatIn(subBox, frame, titleDelay + 8);
    };
  }
};
