import { describe, expect, it } from 'vitest';
import { addOutput, outputValues, portOfHandle, removeOutput, renameOutput, selectOutputs, unavailableOutput } from './select-outputs';
import type { PostRow } from './select-sources';

const POST: PostRow = {
  caption: 'Hello',
  media: { items: [{ type: 'image', url: 'https://cdn/a.jpg' }, { type: 'image', url: 'https://cdn/b.jpg' }] },
  metrics: { likes: 7 },
  permalink: null,
  postedAt: null,
  handle: 'nike'
};

describe('selectOutputs — le porte di un select', () => {
  it('un feed dà Images e Text di default', () => {
    expect(selectOutputs('social_account_feed', []).map((o) => [o.handle, o.port, o.label])).toEqual([
      ['out:images', 'images', 'Images'],
      ['out:text', 'text', 'Text']
    ]);
  });

  it('un catalogo dà Images e Text di default', () => {
    expect(selectOutputs('products', []).map((o) => o.handle)).toEqual(['out:images', 'out:text']);
  });

  it("una lista resta com'era: nessuna porta nominata", () => {
    expect(selectOutputs('list', [])).toEqual([]);
  });

  it('un output personalizzato si aggiunge dopo i default, con la porta del suo campo', () => {
    const outputs = selectOutputs('products', [{ id: 'o1', field: 'price', label: 'Prezzo' }]);
    expect(outputs[2]).toMatchObject({ handle: 'out:field:price', port: 'text', label: 'Prezzo', incompatible: false });
  });

  it("senza etichetta prende quella del campo", () => {
    expect(selectOutputs('products', [{ id: 'o1', field: 'first_image' }])[2]).toMatchObject({ port: 'images', label: 'First image' });
  });

  it('un campo che la sorgente non ha è segnalato, non tolto', () => {
    const outputs = selectOutputs('social_account_feed', [{ id: 'o1', field: 'price' }]);
    expect(outputs).toHaveLength(3);
    expect(outputs[2]).toMatchObject({ handle: 'out:field:price', incompatible: true });
  });

  it('senza sorgente i personalizzati sono segnalati', () => {
    expect(selectOutputs(null, [{ id: 'o1', field: 'price' }])[0].incompatible).toBe(true);
  });
});

describe('outputValues — il valore di ogni porta sulla riga scelta', () => {
  it('ogni porta compatibile porta il suo valore, le segnalate niente', () => {
    const values = outputValues('social_account_feed', POST, [
      { id: 'o1', field: 'likes' },
      { id: 'o2', field: 'price' }
    ]);
    expect(values['out:images']).toEqual({ port: 'images', text: null, mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] });
    expect(values['out:text']).toEqual({ port: 'text', text: 'Hello', mediaUrls: [] });
    expect(values['out:field:likes']).toEqual({ port: 'text', text: '7', mediaUrls: [] });
    expect(values['out:field:price']).toBeUndefined();
  });
});

describe('modifica della lista di output', () => {
  it('aggiunge, rinomina, toglie; un campo già presente non si duplica', () => {
    const one = addOutput([], 'price', () => 'o1');
    expect(one).toEqual([{ id: 'o1', field: 'price' }]);
    expect(addOutput(one, 'price', () => 'o2')).toBe(one);
    expect(renameOutput(one, 'o1', 'Prezzo')).toEqual([{ id: 'o1', field: 'price', label: 'Prezzo' }]);
    expect(renameOutput(one, 'o1', '  ')).toEqual([{ id: 'o1', field: 'price' }]);
    expect(removeOutput(one, 'o1')).toEqual([]);
  });
});

describe('porta di una maniglia', () => {
  const tile = { output: null, outputs: selectOutputs('products', [{ id: 'o1', field: 'first_image' }, { id: 'o2', field: 'likes' }]) };

  it('la porta viene dalla maniglia tirata, non dal nodo', () => {
    expect(portOfHandle(tile, 'out:text')).toBe('text');
    expect(portOfHandle(tile, 'out:field:first_image')).toBe('images');
  });

  it('senza porte nominate resta quella del nodo', () => {
    expect(portOfHandle({ output: 'images' }, null)).toBe('images');
  });

  it('una porta segnalata non si collega', () => {
    expect(unavailableOutput(tile, 'out:field:likes')).toBe(true);
    expect(unavailableOutput(tile, 'out:text')).toBe(false);
  });
});
