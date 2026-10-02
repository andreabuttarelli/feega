import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SelectionToolbar from './SelectionToolbar.svelte';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { MODEL3D_MODELS, model3dChoiceParams } from '$lib/model3d-models';

const trellis: ModelChoice = {
  id: MODEL3D_MODELS.trellis2,
  label: 'TRELLIS.2',
  provider: 'microsoft',
  providerLabel: 'Microsoft',
  aspectRatios: ['1:1'],
  inputModalities: ['image'],
  pricedInputs: [{ inputs: { pipeline_type: '512' }, credits: 30 }],
  params: model3dChoiceParams(MODEL3D_MODELS.trellis2)
};

describe('a selected 3D node gets the model picker', () => {
  it('shows the chosen 3D model and its resolution, like an image node', () => {
    const body = render(SelectionToolbar, {
      props: {
        box: { x: 100, y: 100, width: 200 },
        count: 1,
        nodeSummaries: [{ id: 'n', type: 'model3d', data: { model: MODEL3D_MODELS.trellis2 } }],
        choicesFor: (type: string) => (type === 'model3d' ? [trellis] : [])
      }
    }).body;

    expect(body).toContain('aria-label="Node properties"');
    expect(body).toContain('TRELLIS.2');
    expect(body).toContain('512');
  });
});
