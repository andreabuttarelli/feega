import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from './node-data';
import { CANVAS_NODE_SPECS, canConnect, type NodeKind } from './graph';
import { NODE_PORTS, portsOf, type PortContext } from './node-ports';
import { anyPortAccepts } from './connectors';

const ctx: PortContext = {
  modelPorts: () => ['text', 'images'],
  listPorts: () => ['images'],
  itemPort: () => 'images',
  mediaKind: () => 'image'
};

const EXPECTED: Record<(typeof NODE_TYPES)[number], { inputs: boolean; output: boolean }> = {
  text: { inputs: true, output: true },
  image: { inputs: true, output: true },
  video: { inputs: true, output: true },
  doc: { inputs: false, output: true },
  iframe: { inputs: false, output: false },
  social_account_feed: { inputs: false, output: true },
  social_post_mockup: { inputs: false, output: false },
  products: { inputs: false, output: true },
  ads: { inputs: false, output: false },
  influencer: { inputs: false, output: true },
  list: { inputs: true, output: true },
  select: { inputs: true, output: true },
  effects: { inputs: true, output: true },
  composition: { inputs: true, output: true },
  calendar: { inputs: true, output: false },
  audio: { inputs: true, output: true }
};

describe('ogni tipo di nodo disegna le porte che la sua riga dichiara', () => {
  it('la tabella copre ogni tipo', () => {
    expect(Object.keys(NODE_PORTS).sort()).toEqual([...NODE_TYPES].sort());
  });

  for (const type of NODE_TYPES) {
    it(`${type}: ingressi ${EXPECTED[type].inputs ? 'sì' : 'no'}, uscita ${EXPECTED[type].output ? 'sì' : 'no'}`, () => {
      const ports = portsOf(type, ctx);
      expect(ports.inputs.length > 0).toBe(EXPECTED[type].inputs);
      expect(ports.output !== null).toBe(EXPECTED[type].output);
    });
  }

  it('un tipo che il grafo dice generato ha ingressi, uno che non lo è non ne ha', () => {
    for (const type of NODE_TYPES) {
      const spec = CANVAS_NODE_SPECS[type as NodeKind];
      if (!spec) continue;
      expect(portsOf(type, ctx).inputs.length > 0).toBe(spec.generated && spec.accepts.length > 0);
    }
  });

  it('a calendar accepts media and text, so connecting material plans it', () => {
    expect(portsOf('calendar', ctx).inputs).toEqual(['images', 'videos', 'audios', 'text']);
  });

  it('un nodo audio senza operazione salvata prende testo (text to speech), ed esce audio', () => {
    expect(portsOf('audio', ctx)).toEqual({ inputs: ['text'], output: 'audios' });
  });

  it('un nodo audio segue la sua operazione: voice changer prende audio o video', () => {
    const audioCtx = { ...ctx, audioOperation: () => 'voice_changer' as const };
    expect(portsOf('audio', audioCtx)).toEqual({ inputs: ['audios', 'videos'], output: 'audios' });
  });

  it('un nodo audio in dubbing prende video o audio, ed esce audio', () => {
    const audioCtx = { ...ctx, audioOperation: () => 'dubbing' as const };
    expect(portsOf('audio', audioCtx)).toEqual({ inputs: ['videos', 'audios'], output: 'audios' });
  });

  it('prodotti e feed escono come una lista di immagini', () => {
    expect(portsOf('products', ctx).output).toBe('images');
    expect(portsOf('social_account_feed', ctx).output).toBe('images');
  });

  it("l'uscita di un nodo ha il tipo di ciò che produce", () => {
    expect(portsOf('text', ctx).output).toBe('text');
    expect(portsOf('image', ctx).output).toBe('images');
    expect(portsOf('video', ctx).output).toBe('videos');
    expect(portsOf('effects', ctx).output).toBe('images');
    expect(portsOf('effects', { ...ctx, mediaKind: () => 'video' }).output).toBe('videos');
  });

  it('un feed entra come asse solo in un nodo che legge immagini', () => {
    const feed = portsOf('social_account_feed', ctx).output!;
    expect(anyPortAccepts(['text'], feed)).toBe(false);
    expect(anyPortAccepts(['text', 'images'], feed)).toBe(true);
  });

  it('un select prende testo o immagini ed esce col tipo del suo item', () => {
    expect(portsOf('select', ctx).inputs).toEqual(['text', 'images']);
    expect(portsOf('select', { ...ctx, itemPort: () => 'text' }).output).toBe('text');
  });

  it('un select accetta solo sorgenti che sono liste', () => {
    const pick = { id: 's', kind: 'select' as const };
    expect(canConnect({ id: 'f', kind: 'social_account_feed' }, pick).ok).toBe(true);
    expect(canConnect({ id: 'p', kind: 'products' }, pick).ok).toBe(true);
    expect(canConnect({ id: 'l', kind: 'list' }, pick).ok).toBe(true);
    expect(canConnect({ id: 't', kind: 'text' }, pick).ok).toBe(false);
  });
});
