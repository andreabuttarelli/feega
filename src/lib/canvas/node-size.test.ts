import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from './node-data';
import { minNodeSize, nodeSize } from './node-size';
import { MotionFormat } from '@feega/motion-core/motion/doc';

describe('ogni tipo di nodo ha una misura: la tela non si rompe su un tipo nuovo', () => {
  it.each(NODE_TYPES)('%s ha larghezza e altezza', (type) => {
    const { w, h } = nodeSize(type);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('un tipo che il modello non conosce riceve la misura di ripiego, non undefined', () => {
    const { w, h } = nodeSize('document');
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });
});

describe('quanto si può stringere una tile', () => {
  it('un frame disegnato piccolo resta piccolo: il minimo non è la misura di partenza', () => {
    const frame = { format: MotionFormat.Landscape, docHeadRevision: 0 };
    const min = minNodeSize('motion', frame);

    expect(min.w).toBeLessThan(120);
    expect(min.h).toBeLessThan(80);
  });

  it('un nodo che non è un frame tiene la sua misura come minimo', () => {
    expect(minNodeSize('image')).toEqual(nodeSize('image'));
  });
});
