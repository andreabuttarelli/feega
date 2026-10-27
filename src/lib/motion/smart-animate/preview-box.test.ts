import { describe, expect, it } from 'vitest';
import { LayerRole, type AnimatedLayer } from '@feega/motion-core/motion/smart-animate/smart-animate';
import { previewBox } from './preview-box';

const layer: AnimatedLayer = { key: 'Card', clipId: 'c', component: 'Shape', role: LayerRole.Matched, x: 0.5, y: 0.5, width: 0.5, height: 0.25, rotation: 30, opacity: 0.8, fill: '#ff0000', radius: 0.2 };

describe('previewBox', () => {
  it('places the layer centred on x and y in pixels of the preview', () => {
    expect(previewBox(layer, { width: 400, height: 200 })).toEqual({ left: 100, top: 75, width: 200, height: 50, rotation: 30, opacity: 0.8, fill: '#ff0000', radius: 10 });
  });
});
