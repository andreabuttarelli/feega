import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CoreEvent } from '$lib/core-usage';
import { ProductEvent } from '$lib/server/product-events/track';

const CATALOG = readFileSync('docs/analytics.md', 'utf8');

describe('il catalogo degli eventi', () => {
  it('ogni evento del codice ha una riga in docs/analytics.md', () => {
    const missing = [...Object.values(CoreEvent), ...Object.values(ProductEvent)].filter((event) => !CATALOG.includes(`\`${event}\``));

    expect(missing).toEqual([]);
  });

  it('un nome solo per evento, fra core e product', () => {
    const core = new Set<string>(Object.values(CoreEvent));

    expect(Object.values(ProductEvent).filter((event) => core.has(event))).toEqual([]);
  });
});
