import { describe, expect, it } from 'vitest';
import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps } from '@feega/motion-core/motion/timeline';
import { mapClips } from './code-look';
import { setAutoLayout } from '$lib/motion/layout/ops';
import { ClassFamily, LiveProp, Side, arbitraryFamily, type LivePick } from '@feega/live-edit/live-fields';
import { LIVE_CLIP, liveDocOf, liveEditsOf, livePreviewOf, unwrittenOf } from './live-doc';

const RECT = { x: 10, y: 20, width: 400, height: 48 };

const TITLE: LivePick = {
  source: 'src/routes/+page.svelte:12:3',
  rect: RECT,
  classes: 'text-4xl font-semibold text-primary',
  text: 'Chi Siamo',
  rem: 16,
  viewport: null,
  styles: { color: 'rgb(29, 53, 87)', 'font-size': '36px', 'font-weight': '600', display: 'block' }
};

const CARD: LivePick = {
  source: 'src/lib/Card.svelte:4:1',
  rect: { x: 0, y: 0, width: 320, height: 200 },
  classes: 'flex flex-col gap-4 p-6 rounded-xl bg-white',
  text: null,
  rem: 16,
  viewport: null,
  styles: {
    display: 'flex', 'flex-direction': 'column', gap: '16px', 'background-color': 'rgb(255, 255, 255)', 'border-radius': '12px',
    'padding-top': '24px', 'padding-right': '24px', 'padding-bottom': '24px', 'padding-left': '24px'
  }
};

const clipOf = (doc: MotionDoc) => findClip(doc, LIVE_CLIP)!.clip;

const edited = (doc: MotionDoc, props: Record<string, unknown>) => {
  const out = setProps(doc, LIVE_CLIP, props);
  if (!out.ok) {
    throw new Error(out.error);
  }
  return out.doc;
};

describe('liveDocOf', () => {
  it('un testo della pagina diventa un elemento Text con il suo colore, corpo e peso', () => {
    const doc = liveDocOf(TITLE);
    const clip = clipOf(doc);

    expect(clip.component).toBe('Text');
    expect(clip.props).toMatchObject({ text: 'Chi Siamo', color: '#1d3557', weight: 600 });
    expect(Math.round(Number(clip.props.size) * doc.width)).toBe(36);
  });

  it('un contenitore flex diventa uno stack con gap, padding, riempimento e raggio', () => {
    const clip = clipOf(liveDocOf(CARD));

    expect(clip.autoLayout).toMatchObject({ gap: 16, padding: { top: 24, right: 24, bottom: 24, left: 24 } });
    expect(clip.props.fills).toMatchObject([{ color: '#ffffff' }]);
  });
});

describe('liveEditsOf', () => {
  it('senza modifiche non scrive nulla', () => {
    const doc = liveDocOf(TITLE);

    expect(liveEditsOf(doc, doc, TITLE)).toEqual([]);
  });

  it('un colore cambiato nell inspector è una sola scrittura sul file', () => {
    const doc = liveDocOf(TITLE);

    expect(liveEditsOf(doc, edited(doc, { color: '#2563eb' }), TITLE)).toEqual([{ at: TITLE.source, prop: LiveProp.Color, value: '#2563eb', was: '#1d3557', rem: 16 }]);
  });

  it('il testo porta con sé quello di prima, per trovarlo nel file', () => {
    const doc = liveDocOf(TITLE);

    expect(liveEditsOf(doc, edited(doc, { text: 'La nostra storia' }), TITLE)).toMatchObject([{ prop: LiveProp.Text, value: 'La nostra storia', was: 'Chi Siamo' }]);
  });

  it('il padding uguale su tutti i lati è una classe sola', () => {
    const doc = liveDocOf(CARD);
    const next = setAutoLayout(doc, LIVE_CLIP, { padding: { top: 32, right: 32, bottom: 32, left: 32 } });

    expect(next.ok && liveEditsOf(doc, next.doc, CARD)).toMatchObject([{ prop: LiveProp.Padding, value: '32px' }]);
    expect(next.ok && liveEditsOf(doc, next.doc, CARD)[0].side).toBeUndefined();
  });

  it('il padding cambiato solo sopra e sotto scrive l asse Y', () => {
    const doc = liveDocOf(CARD);
    const next = setAutoLayout(doc, LIVE_CLIP, { padding: { top: 8, right: 24, bottom: 8, left: 24 } });

    expect(next.ok && liveEditsOf(doc, next.doc, CARD)).toMatchObject([{ prop: LiveProp.Padding, side: Side.Y, value: '8px' }]);
  });

  it('gap e riempimento di un contenitore', () => {
    const doc = liveDocOf(CARD);
    const gapped = setAutoLayout(doc, LIVE_CLIP, { gap: 8 });
    const filled = edited(doc, { fills: [{ type: 'solid', color: '#f5f5f7' }] });

    expect(gapped.ok && liveEditsOf(doc, gapped.doc, CARD)).toMatchObject([{ prop: LiveProp.Gap, value: '8px' }]);
    expect(liveEditsOf(doc, filled, CARD)).toMatchObject([{ prop: LiveProp.Fill, value: '#f5f5f7' }]);
  });
});

describe('livePreviewOf', () => {
  it('mostra nella pagina ciò che l inspector ha cambiato, prima che il file sia salvato', () => {
    const doc = liveDocOf(TITLE);

    expect(livePreviewOf(doc, edited(doc, { color: '#2563eb', text: 'Ciao' }))).toEqual({ text: 'Ciao', style: { color: '#2563eb' } });
  });
});

const tweaked = (doc: MotionDoc, patch: Record<string, unknown>) => mapClips(doc, (c) => (c.id === LIVE_CLIP ? ({ ...c, ...patch } as typeof c) : c));

const classOf = (doc: MotionDoc, next: MotionDoc, pick = TITLE) => liveEditsOf(doc, next, pick).map((e) => ({ family: e.family, token: e.value }));

describe('ogni controllo della barra scrive nel codice', () => {
  it('opacità e rotazione', () => {
    const doc = liveDocOf(TITLE);

    expect(classOf(doc, edited(doc, { opacity: 0.5 }))).toEqual([{ family: ClassFamily.Opacity, token: 'opacity-[0.5]' }]);
    expect(classOf(doc, edited(doc, { rotation: 12 }))).toEqual([{ family: ClassFamily.Rotate, token: 'rotate-[12deg]' }]);
  });

  it('tornare al valore di partenza toglie la classe invece di scriverne una nuova', () => {
    const doc = liveDocOf(TITLE);
    const faded = edited(doc, { opacity: 0.5 });

    expect(classOf(faded, doc)).toEqual([{ family: ClassFamily.Opacity, token: '' }]);
  });

  it('spostare e ridimensionare scrivono traslazione e misure in px', () => {
    const doc = liveDocOf(TITLE);
    const clip = findClip(doc, LIVE_CLIP)!.clip;
    const moved = edited(doc, { x: Number(clip.props.x) + 20 / doc.width, y: Number(clip.props.y) - 8 / doc.height });
    const sized = edited(doc, { width: 300 / doc.width });

    expect(classOf(doc, moved)).toEqual([
      { family: ClassFamily.TranslateX, token: 'translate-x-[20px]' },
      { family: ClassFamily.TranslateY, token: '-translate-y-[8px]' }
    ]);
    expect(classOf(doc, sized)).toContainEqual({ family: ClassFamily.Width, token: 'w-[300px]' });
  });

  it('tipografia: interlinea, spaziatura, allineamento, maiuscolo, corsivo, famiglia', () => {
    const doc = liveDocOf(TITLE);

    expect(classOf(doc, edited(doc, { leading: 1.5 }))).toEqual([{ family: ClassFamily.Leading, token: 'leading-[1.5]' }]);
    expect(classOf(doc, edited(doc, { tracking: 0.05 }))).toEqual([{ family: ClassFamily.Tracking, token: 'tracking-[0.05em]' }]);
    expect(classOf(doc, edited(doc, { align: 'right' }))).toEqual([{ family: ClassFamily.TextAlign, token: 'text-right' }]);
    expect(classOf(doc, edited(doc, { textCase: 'upper' }))).toEqual([{ family: ClassFamily.Case, token: 'uppercase' }]);
    expect(classOf(doc, edited(doc, { italic: true }))).toEqual([{ family: ClassFamily.Italic, token: 'italic' }]);
    expect(classOf(doc, edited(doc, { font: 'mono' })).map((c) => c.family)).toEqual([ClassFamily.FontFamily]);
  });

  it('sottolineato, troncato, capovolto, nascosto, fusione', () => {
    const doc = liveDocOf(TITLE);

    expect(classOf(doc, edited(doc, { decoration: 'underline' }))).toEqual([{ family: ClassFamily.Decoration, token: 'underline' }]);
    expect(classOf(doc, edited(doc, { truncate: true, maxLines: 2 }))).toEqual([{ family: ClassFamily.Clamp, token: 'line-clamp-2' }]);
    expect(classOf(doc, tweaked(doc, { transform: { scaleX: -1 } }))).toEqual([{ family: ClassFamily.FlipX, token: '-scale-x-100' }]);
    expect(classOf(doc, tweaked(doc, { hidden: true }))).toEqual([{ family: ClassFamily.Hidden, token: 'hidden' }]);
    expect(classOf(doc, tweaked(doc, { blend: 'multiply' }))).toEqual([{ family: ClassFamily.Blend, token: 'mix-blend-multiply' }]);
  });

  it('direzione e allineamento di uno stack', () => {
    const doc = liveDocOf(CARD);
    const row = setAutoLayout(doc, LIVE_CLIP, { direction: 'horizontal' as never });

    expect(row.ok && classOf(doc, row.doc, CARD)).toContainEqual({ family: ClassFamily.Direction, token: 'flex-row' });
  });

  it('una proprietà CSS senza una classe dedicata diventa una classe arbitraria', () => {
    const doc = liveDocOf(TITLE);

    expect(liveEditsOf(doc, tweaked(doc, { blend: 'plus-lighter' }), TITLE)).toMatchObject([{ family: ClassFamily.Blend, value: 'mix-blend-plus-lighter' }]);
    expect(arbitraryFamily('outline-color')).toBe('arbitrary:outline-color');
  });

  it('un controllo che non ha CSS lo dice, invece di non fare niente', () => {
    const doc = liveDocOf(TITLE);
    const pinned = tweaked(doc, { constraints: { horizontal: 'right', vertical: 'bottom' } });

    expect(liveEditsOf(doc, pinned, TITLE)).toEqual([]);
    expect(unwrittenOf(doc, pinned)).toBe(true);
    expect(unwrittenOf(doc, edited(doc, { opacity: 0.5 }))).toBe(false);
  });
});

describe('anteprima di ogni controllo', () => {
  it('mostra nella pagina il CSS vero, prima che il file sia salvato', () => {
    const doc = liveDocOf(TITLE);

    expect(livePreviewOf(doc, edited(doc, { opacity: 0.5, rotation: 12 })).style).toMatchObject({ opacity: '0.5', rotate: '12deg' });
  });
});

describe('i controlli che l inspector salva come trasformazioni', () => {
  const transformed = (doc: MotionDoc, patch: Record<string, number>) => tweaked(doc, { transform: { ...findClip(doc, LIVE_CLIP)!.clip.transform, ...patch } });

  it('opacità, rotazione, scala e sfocatura dal pannello arrivano al file', () => {
    const doc = liveDocOf(TITLE);

    expect(classOf(doc, transformed(doc, { opacity: 0.6 }))).toEqual([{ family: ClassFamily.Opacity, token: 'opacity-[0.6]' }]);
    expect(classOf(doc, transformed(doc, { rotateZ: 15 }))).toEqual([{ family: ClassFamily.Rotate, token: 'rotate-[15deg]' }]);
    expect(classOf(doc, transformed(doc, { scale: 1.2 })).map((c) => c.token)).toEqual(['scale-[1.2]']);
    expect(classOf(doc, transformed(doc, { blur: 4 })).map((c) => c.token)).toEqual(['blur-[4px]']);
  });

  it('l anteprima mostra subito l opacità del pannello', () => {
    const doc = liveDocOf(TITLE);

    expect(livePreviewOf(doc, transformed(doc, { opacity: 0.6 })).style).toMatchObject({ opacity: '0.6' });
  });
});

