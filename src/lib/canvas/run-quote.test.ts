import { describe, expect, it } from 'vitest';
import type { GenNode, ModelChoice } from './gen-node';
import { runQuoteOf } from './run-quote';

const image: ModelChoice = { id: 'img', label: 'Img', provider: 'x', providerLabel: 'X', aspectRatios: ['1:1'], unitCredits: 12, maxPromptChars: 10 };

const node = (patch: Partial<GenNode> = {}): GenNode => ({
  id: 'n1',
  medium: 'image',
  model: 'img',
  prompt: 'a cat',
  params: {},
  refId: null,
  runs: [],
  ...patch
});

describe('il preventivo di un giro, lo stesso per il nodo e per la barra', () => {
  it('pronto: Generate, col prezzo del modello', () => {
    expect(runQuoteOf({ node: node(), choices: [image] })).toMatchObject({ label: 'Generate', credits: 12, enabled: true, reason: null });
  });

  it('già prodotto: Redo', () => {
    expect(runQuoteOf({ node: node({ refId: 'm1' }), choices: [image] }).label).toBe('Redo');
  });

  it('senza prompt: spento, con il motivo', () => {
    expect(runQuoteOf({ node: node({ prompt: '' }), choices: [image] })).toMatchObject({ enabled: false, reason: 'Write what you want' });
  });

  it('prompt oltre il limite del modello: spento', () => {
    const quote = runQuoteOf({ node: node({ prompt: 'x'.repeat(11) }), choices: [image] });

    expect(quote.enabled).toBe(false);
    expect(quote.tooLong).toBe(true);
  });

  it('mentre gira: spento', () => {
    expect(runQuoteOf({ node: node({ running: true }), choices: [image] }).enabled).toBe(false);
  });

  it('input di testo variabile: nessun numero, costo variabile', () => {
    const quote = runQuoteOf({ node: node({ medium: 'text' }), choices: [], variableTextInput: true });

    expect(quote.credits).toBeNull();
  });
});

describe('the quote of a 3D run', () => {
  const TRELLIS = 'wiro/microsoft/trellis-2';
  const trellis: ModelChoice = {
    id: TRELLIS,
    label: 'TRELLIS.2',
    provider: 'microsoft',
    providerLabel: 'Microsoft',
    aspectRatios: ['1:1'],
    pricedInputs: [
      { inputs: { pipeline_type: '512' }, credits: 30 },
      { inputs: { pipeline_type: '1024_cascade' }, credits: 36 }
    ]
  };
  const cheapImage: ModelChoice = { ...image, id: 'cheap', unitCredits: 4, inputModalities: ['text'] };
  const model3d = (patch: Partial<GenNode> = {}) => node({ medium: 'model3d', model: TRELLIS, prompt: '', ...patch });

  it('prices a node that never picked a resolution at the 512 default', () => {
    expect(runQuoteOf({ node: model3d(), choices: [trellis], hasUpstreamImage: true }).credits).toBe(30);
  });

  it('prices the chosen resolution', () => {
    expect(runQuoteOf({ node: model3d({ params: { pipeline_type: '1024_cascade' } as never }), choices: [trellis], hasUpstreamImage: true }).credits).toBe(36);
  });

  it('adds the image step when text alone has to become an image first', () => {
    const quote = runQuoteOf({ node: model3d({ prompt: 'a teapot' }), choices: [trellis], imageChoices: [image, cheapImage] });

    expect(quote.credits).toBe(34);
  });

  it('does not add it when an image is connected', () => {
    const quote = runQuoteOf({ node: model3d({ prompt: 'a teapot' }), choices: [trellis], imageChoices: [cheapImage], hasUpstreamImage: true });

    expect(quote.credits).toBe(30);
  });
});
