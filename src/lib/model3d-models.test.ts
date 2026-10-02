import { describe, expect, it } from 'vitest';
import { MODEL3D_MODELS, model3dChoiceParams, model3dParamsOf } from './model3d-models';

describe('the settings a 3D model offers', () => {
  it('Trellis picks a resolution of 512, 1024 or 1536, labelled as numbers', () => {
    expect(model3dChoiceParams(MODEL3D_MODELS.trellis2)).toEqual([
      {
        name: 'pipeline_type',
        label: 'Resolution',
        kind: 'enum',
        values: ['512', '1024_cascade', '1536_cascade'],
        optionLabels: { '512': '512', '1024_cascade': '1024', '1536_cascade': '1536' }
      }
    ]);
  });

  it('Hunyuan3D turns texturing on or off', () => {
    expect(model3dChoiceParams(MODEL3D_MODELS.hunyuan3d)).toEqual([
      { name: 'generate_texture', label: 'Textured', kind: 'enum', values: ['true', 'false'], optionLabels: { true: 'On', false: 'Off' } }
    ]);
  });

  it('a model nobody reviewed offers no settings', () => {
    expect(model3dChoiceParams('wiro/someone/else')).toEqual([]);
  });
});

describe('validating the settings a run carries', () => {
  it('fills a missing setting with the cheapest default: Trellis at 512', () => {
    expect(model3dParamsOf(MODEL3D_MODELS.trellis2, {})).toEqual({ ok: true, params: { pipeline_type: '512' } });
  });

  it('keeps an offered value and drops every key the model does not take', () => {
    expect(model3dParamsOf(MODEL3D_MODELS.hunyuan3d, { generate_texture: 'false', texture_size: '8192', repeat: 2 })).toEqual({
      ok: true,
      params: { generate_texture: 'false' }
    });
  });

  it('refuses a value the model does not offer, naming it', () => {
    const out = model3dParamsOf(MODEL3D_MODELS.pixal3d, { pipeline_type: '512' });
    expect(out).toEqual({ ok: false, error: 'Resolution "512" is not offered by this 3D model.' });
  });
});
