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
