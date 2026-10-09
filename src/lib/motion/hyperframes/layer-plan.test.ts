import { describe, expect, it } from 'vitest';
import { PassKind, planLayers, type LayerFacts } from './layer-plan';

const dom = (blend = 'normal', backdrop = false): LayerFacts => ({ kind: PassKind.Dom, blend, backdrop });
const canvas = (blend = 'normal'): LayerFacts => ({ kind: PassKind.Canvas, blend, backdrop: false });
const grained = (blend = 'normal'): LayerFacts => ({ kind: PassKind.Grain, blend, backdrop: false });

describe('planLayers', () => {
  it('senza canvas resta un solo passaggio DOM, come prima', () => {
    expect(planLayers([dom(), dom('screen'), dom()])).toEqual([{ kind: PassKind.Dom, layers: [0, 1, 2], blend: 'normal' }]);
  });

  it('un canvas spezza il DOM sotto e sopra e si disegna da solo', () => {
    expect(planLayers([dom(), canvas(), dom(), dom()])).toEqual([
      { kind: PassKind.Dom, layers: [0], blend: 'normal' },
      { kind: PassKind.Canvas, layers: [1], blend: 'normal' },
      { kind: PassKind.Dom, layers: [2, 3], blend: 'normal' }
    ]);
  });

  it('un layer in fusione sopra un canvas diventa un passaggio a sé con la sua fusione', () => {
    expect(planLayers([canvas(), dom('screen'), dom()])).toEqual([
      { kind: PassKind.Canvas, layers: [0], blend: 'normal' },
      { kind: PassKind.Dom, layers: [1], blend: 'screen' },
      { kind: PassKind.Dom, layers: [2], blend: 'normal' }
    ]);
  });

  it('più di due passaggi DOM costano più del canvas risparmiato: resta un passaggio solo', () => {
    expect(planLayers([dom(), canvas(), dom('screen'), dom(), dom('screen')])).toEqual([{ kind: PassKind.Dom, layers: [0, 1, 2, 3, 4], blend: 'normal' }]);
  });

  it('quando i passaggi sarebbero troppi, tiene diretti solo i canvas in cima e in fondo', () => {
    expect(planLayers([dom(), canvas(), dom('screen'), dom(), dom('screen'), canvas(), canvas()])).toEqual([
      { kind: PassKind.Dom, layers: [0, 1, 2, 3, 4], blend: 'normal' },
      { kind: PassKind.Canvas, layers: [5], blend: 'normal' },
      { kind: PassKind.Canvas, layers: [6], blend: 'normal' }
    ]);
  });

  it('un layer con grana va in un passaggio a sé, come un canvas', () => {
    expect(planLayers([dom(), dom('screen'), grained(), grained('screen')])).toEqual([
      { kind: PassKind.Dom, layers: [0, 1], blend: 'normal' },
      { kind: PassKind.Grain, layers: [2], blend: 'normal' },
      { kind: PassKind.Grain, layers: [3], blend: 'screen' }
    ]);
  });

  it('i layer con grana nel mezzo tornano DOM quando i passaggi sarebbero troppi', () => {
    expect(planLayers([dom(), grained(), dom('screen'), dom(), dom('screen'), grained()])).toEqual([
      { kind: PassKind.Dom, layers: [0, 1, 2, 3, 4], blend: 'normal' },
      { kind: PassKind.Grain, layers: [5], blend: 'normal' }
    ]);
  });

  it('i layer in fusione sotto il primo canvas restano nel primo passaggio', () => {
    expect(planLayers([dom(), dom('multiply'), canvas()])).toEqual([
      { kind: PassKind.Dom, layers: [0, 1], blend: 'normal' },
      { kind: PassKind.Canvas, layers: [2], blend: 'normal' }
    ]);
  });

  it('un backdrop-filter sopra un canvas riporta tutto a un passaggio solo', () => {
    expect(planLayers([canvas(), dom('normal', true)])).toEqual([{ kind: PassKind.Dom, layers: [0, 1], blend: 'normal' }]);
  });

  it('una fusione che il canvas 2D non conosce riporta tutto a un passaggio solo', () => {
    expect(planLayers([canvas(), dom('plus-darker')])).toEqual([{ kind: PassKind.Dom, layers: [0, 1], blend: 'normal' }]);
  });
});
