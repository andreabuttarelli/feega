import { describe, expect, it } from 'vitest';
import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps } from '@feega/motion-core/motion/timeline';
import { setAutoLayout } from '$lib/motion/layout/ops';
import { LiveProp, Side, type LivePick } from './live-fields';
import { LIVE_CLIP, liveDocOf, liveEditsOf, livePreviewOf } from './live-doc';

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
