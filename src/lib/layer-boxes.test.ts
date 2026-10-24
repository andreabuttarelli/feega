import { describe, expect, it } from 'vitest';
import { MAX_LAYERS, layerPrompt, parseLayerBoxes } from './layer-boxes';

describe('parseLayerBoxes', () => {
  it('reads boxes on the 0-1000 grid into fractions of the image', () => {
    const reply = '[{"label":"title","bbox":[100,50,900,200]},{"label":"parrot","bbox":[330,274,641,991]}]';

    expect(parseLayerBoxes(reply)).toEqual([
      { label: 'title', box: { left: 0.1, top: 0.05, width: 0.8, height: 0.15 } },
      { label: 'parrot', box: { left: 0.33, top: 0.274, width: 0.311, height: 0.717 } }
    ]);
  });

  it('finds the list inside a fenced or chatty reply', () => {
    expect(parseLayerBoxes('Here you go:\n```json\n[{"label":"cup","bbox":[0,0,500,500]}]\n```')).toHaveLength(1);
  });

  it('drops boxes that are empty, inverted or off the grid, and clamps the rest', () => {
    const reply = '[{"label":"a","bbox":[10,10,10,300]},{"label":"b","bbox":[500,500,400,900]},{"label":"c","bbox":[-50,0,1200,500]},{"label":"d","bbox":"nope"}]';

    expect(parseLayerBoxes(reply)).toEqual([{ label: 'c', box: { left: 0, top: 0, width: 1, height: 0.5 } }]);
  });

  it('keeps at most the layers the model can separate', () => {
    const many = JSON.stringify(Array.from({ length: MAX_LAYERS + 3 }, (_, i) => ({ label: `e${i}`, bbox: [0, 0, 100 + i, 100] })));

    expect(parseLayerBoxes(many)).toHaveLength(MAX_LAYERS);
  });

  it('gives nothing for text that is not a list', () => {
    expect(parseLayerBoxes('I cannot see an image')).toEqual([]);
    expect(parseLayerBoxes('[not json')).toEqual([]);
  });
});

describe('layerPrompt', () => {
  it('names every element with its box, in order, on the same grid', () => {
    const boxes = parseLayerBoxes('[{"label":"title","bbox":[100,50,900,200]},{"label":"parrot","bbox":[330,274,641,991]}]');

    expect(layerPrompt(boxes)).toBe('Separate the title <bbox>100 50 900 200</bbox> and the parrot <bbox>330 274 641 991</bbox> into independent layers');
  });
});
