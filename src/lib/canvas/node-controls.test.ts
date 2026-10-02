import { describe, expect, it } from 'vitest';
import { commonPropertiesOf, dynamicParamsOf } from './common-properties';
import type { ModelChoice } from './gen-node';
import { enumKindOf, nodeControlsOf, numberKindOf, patchOf, summaryOf, type NodeControl } from './node-controls';

const videoChoice: ModelChoice = {
  id: 'wan',
  label: 'Wan 3.0',
  provider: 'alibaba',
  providerLabel: 'Alibaba',
  aspectRatios: ['16:9', '9:16', '1:1'],
  durationOptions: [5, 10],
  resolutions: ['480p', '720p', '1080p'],
  generateAudio: true,
  params: [
    { name: 'quality', label: 'Quality', kind: 'enum', values: ['low', 'medium', 'high', 'auto', 'ultra'] },
    { name: 'seed', label: 'Seed', kind: 'number', min: 0, max: 4294967295 },
    { name: 'guidance', label: 'Guidance', kind: 'number', min: 1, max: 20 },
    { name: 'watermark', label: 'Watermark', kind: 'boolean' }
  ]
};

function controlsFor(data: Record<string, unknown>[], choice: ModelChoice = videoChoice): NodeControl[] {
  const nodes = data.map((d) => ({ type: 'video', data: d }));
  const dynamic = dynamicParamsOf(nodes, (choice.params ?? []).map((p) => p.name));
  return nodeControlsOf(commonPropertiesOf(nodes), choice, dynamic);
}

function byId(controls: NodeControl[], id: string): NodeControl {
  const control = controls.find((c) => c.id === id);
  if (!control) {
    throw new Error(`no control ${id}`);
  }
  return control;
}

describe('il tipo di controllo lo decide il dato, non il nome del campo', () => {
  it('un enum corto è un segmented, uno lungo un menu con ricerca', () => {
    expect(enumKindOf(4)).toBe('segmented');
    expect(enumKindOf(5)).toBe('menu');
  });

  it('un numero con un intervallo stretto è uno slider, uno enorme (seed) un campo numerico', () => {
    expect(numberKindOf(1, 20)).toBe('slider');
    expect(numberKindOf(0, 4294967295)).toBe('number');
    expect(numberKindOf(undefined, 10)).toBe('number');
  });

  it('formato come chip di proporzione, risoluzione come chip, audio come switch', () => {
    const controls = controlsFor([{ params: { aspectRatio: '9:16' } }]);

    expect(byId(controls, 'aspectRatio').kind).toBe('ratio');
    expect(byId(controls, 'resolution').kind).toBe('chips');
    expect(byId(controls, 'audio').kind).toBe('switch');
    expect(byId(controls, 'quality').kind).toBe('menu');
    expect(byId(controls, 'seed').kind).toBe('number');
    expect(byId(controls, 'guidance').kind).toBe('slider');
    expect(byId(controls, 'watermark').kind).toBe('switch');
  });
});

describe('le sezioni: Output davanti, Advanced chiuso', () => {
  it('formato, durata, risoluzione, audio e qualità in Output; seed ed enhance in Advanced', () => {
    const controls = controlsFor([{ params: { enhancePrompt: true } }]);
    const output = controls.filter((c) => c.section === 'output').map((c) => c.id);
    const advanced = controls.filter((c) => c.section === 'advanced').map((c) => c.id);

    expect(output).toEqual(['aspectRatio', 'duration', 'resolution', 'audio', 'quality']);
    expect(advanced).toEqual(['enhancePrompt', 'seed', 'guidance', 'watermark']);
  });

  it('il testo non ha formato, durata, risoluzione né audio', () => {
    const nodes = [{ type: 'text', data: {} }];
    const controls = nodeControlsOf(commonPropertiesOf(nodes), { ...videoChoice, params: [] }, {});

    expect(controls.map((c) => c.id)).toEqual([]);
  });
});

describe('il valore corrente, sempre visibile e mai inventato', () => {
  it('un formato mai scelto resta "default", non il primo dell\'elenco', () => {
    const control = byId(controlsFor([{}]), 'aspectRatio');

    expect(control.value).toBeNull();
    expect(control.mixed).toBe(false);
  });

  it('durata e risoluzione non scritte mostrano il default del modello, come prima', () => {
    const controls = controlsFor([{}]);

    expect(byId(controls, 'duration').value).toBe(5);
    expect(byId(controls, 'resolution').value).toBe('480p');
    expect(byId(controls, 'audio').value).toBe(true);
    expect(byId(controls, 'quality').value).toBe('low');
  });

  it('due nodi con valori diversi: mixed', () => {
    const control = byId(controlsFor([{ params: { aspectRatio: '1:1' } }, { params: { aspectRatio: '16:9' } }]), 'aspectRatio');

    expect(control.mixed).toBe(true);
  });

  it('il riassunto del trigger elenca i valori di Output', () => {
    const controls = controlsFor([{ params: { aspectRatio: '9:16', duration: 10, resolution: '720p', audio: false } }]);

    expect(summaryOf(controls)).toBe('9:16 · 10s · 720p · Audio off · Quality low');
  });

  it('un formato mai scelto nel riassunto dice Auto, non un valore', () => {
    expect(summaryOf(controlsFor([{}]))).toMatch(/^Auto · /);
  });

  it('un valore misto nel riassunto dice Mixed', () => {
    const controls = controlsFor([{ params: { duration: 5 } }, { params: { duration: 10 } }]);

    expect(summaryOf(controls)).toContain('Mixed');
  });
});

describe('ogni valore torna indietro nella stessa forma che il salvataggio già conosce', () => {
  const controls = controlsFor([{}]);

  it.each([
    ['aspectRatio', '1:1', { aspectRatio: '1:1' }],
    ['duration', '10', { duration: 10 }],
    ['resolution', '1080p', { resolution: '1080p' }],
    ['audio', false, { audio: false }],
    ['enhancePrompt', true, { enhancePrompt: true }],
    ['quality', 'high', { dynamicParams: { quality: 'high' } }],
    ['seed', '42', { dynamicParams: { seed: 42 } }],
    ['guidance', 7, { dynamicParams: { guidance: 7 } }],
    ['watermark', true, { dynamicParams: { watermark: true } }]
  ])('%s ← %s', (id, value, patch) => {
    expect(patchOf(byId(controls, id), value)).toEqual(patch);
  });

  it('le opzioni della durata portano il valore come stringa e l\'etichetta in secondi', () => {
    expect(byId(controls, 'duration').options).toEqual([
      { value: '5', label: '5s' },
      { value: '10', label: '10s' }
    ]);
  });
});

describe('a 3D node shows its settings in the same toolbar', () => {
  const trellis: ModelChoice = {
    id: 'wiro/microsoft/trellis-2',
    label: 'TRELLIS.2',
    provider: 'microsoft',
    providerLabel: 'Microsoft',
    aspectRatios: ['1:1'],
    params: [
      { name: 'pipeline_type', label: 'Resolution', kind: 'enum', values: ['512', '1024_cascade'], optionLabels: { '512': '512', '1024_cascade': '1024' } }
    ]
  };

  it('in Output, with readable option labels and the cheapest value by default', () => {
    const nodes = [{ type: 'model3d', data: {} }];
    const control = byId(nodeControlsOf(commonPropertiesOf(nodes), trellis, dynamicParamsOf(nodes, ['pipeline_type'])), 'pipeline_type');

    expect(control.section).toBe('output');
    expect(control.options).toEqual([
      { value: '512', label: '512' },
      { value: '1024_cascade', label: '1024' }
    ]);
    expect(control.value).toBe('512');
  });

  it('a 3D selection reads its model like any generating node', () => {
    expect(commonPropertiesOf([{ type: 'model3d', data: { model: 'wiro/microsoft/trellis-2' } }])).toMatchObject({
      type: 'model3d',
      model: { kind: 'same', value: 'wiro/microsoft/trellis-2' }
    });
  });
});
