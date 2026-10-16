import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import InfluencerPicker from './InfluencerPicker.svelte';
import { castingVerdict, MODEL_VERDICT_TEXT, ModelVerdict } from '$lib/studio/casting';

const models = [
  { id: 'ava', name: 'Ava', cover: 'https://cdn.test/ava.jpg', allowed: true, why: MODEL_VERDICT_TEXT[ModelVerdict.Allowed] },
  { id: 'teen', name: 'Teen', cover: 'https://cdn.test/teen.jpg', allowed: false, why: MODEL_VERDICT_TEXT[ModelVerdict.UnderAge] },
  { id: 'nocover', name: 'Noa', cover: null, allowed: true, why: '' }
];

function body(selected: string[] = []) {
  return render(InfluencerPicker, { props: { models, selected, createHref: '/p/p1/influencers', onchange: () => {} } }).body;
}

describe('scelta dell’influencer', () => {
  it('mostra ogni influencer con la sua foto e il suo nome', () => {
    const html = body();

    expect(html).toContain('src="https://cdn.test/ava.jpg"');
    expect(html).toContain('Ava');
    expect(html).toContain('Noa');
  });

  it('chi non si può usare resta visibile, disabilitato, col motivo', () => {
    const html = body();
    const teen = html.slice(html.indexOf('data-testid="studio-influencer-teen"'));

    expect(teen.slice(0, teen.indexOf('</button>'))).toMatch(/disabled/);
    expect(html).toContain(MODEL_VERDICT_TEXT[ModelVerdict.UnderAge]);
  });

  it('un influencer del catalogo si può scegliere', () => {
    const verdict = castingVerdict({ source: 'catalogue', age: 30 });
    const catalogue = { id: 'mia', name: 'Mia', cover: null, allowed: verdict === ModelVerdict.Allowed, why: MODEL_VERDICT_TEXT[verdict] };
    const html = render(InfluencerPicker, { props: { models: [catalogue], selected: [], createHref: '/p/p1/influencers', onchange: () => {} } }).body;
    const mia = html.slice(html.indexOf('data-testid="studio-influencer-mia"'));

    expect(mia.slice(0, mia.indexOf('</button>'))).not.toMatch(/disabled/);
  });

  it('segna chi è scelto e offre di crearne uno', () => {
    const html = body(['ava']);

    expect(html).toMatch(/data-testid="studio-influencer-ava"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-testid="studio-influencer-ava"/);
    expect(html).toContain('href="/p/p1/influencers"');
  });
});
