import { describe, expect, it } from 'vitest';
import { ENVIRONMENTS, Environment } from './environments';
import { SHOTS, Shot, Casting } from './shots';
import { castingVerdict, isKidsProduct, ModelVerdict, STUDIO_MIN_AGE } from './casting';
import { BATCH_MAX, cellKey, lockedPrompt, planBatch, SkipReason, styleRefBudget, type PlanProduct } from './plan';
import { afterFailure, canMove, creditCheck, failureKind, failureText, FailureKind, ItemStatus, MAX_RETRIES, pickRunnable } from './batch-state';

const shirt: PlanProduct = { index: 1, title: 'Linen shirt', productType: 'Shirts', tags: [], imageCount: 2 };
const onesie: PlanProduct = { index: 2, title: 'Cotton onesie', productType: 'Baby', tags: ['kids'], imageCount: 1 };

describe('rule tables', () => {
  it('ogni ambiente ha una scena e un nome', () => {
    expect(Object.keys(ENVIRONMENTS)).toHaveLength(8);
    for (const preset of Object.values(ENVIRONMENTS)) {
      expect(preset.scene.length).toBeGreaterThan(20);
      expect(preset.label).toBeTruthy();
    }
  });

  it('solo packshot e dettaglio sono senza persona e adatti ai bambini', () => {
    const safe = Object.entries(SHOTS).filter(([, r]) => r.safeForKids).map(([k]) => k);
    expect(safe.sort()).toEqual([Shot.Detail, Shot.Packshot].sort());
    for (const rule of Object.values(SHOTS)) {
      expect(rule.safeForKids).toBe(rule.casting === Casting.NoPerson);
    }
  });
});

describe('casting', () => {
  it.each([
    [{ orgId: null, source: 'catalogue', age: 30 }, ModelVerdict.RealPerson],
    [{ orgId: 'o', source: 'upload', age: 30 }, ModelVerdict.UploadedPhotos],
    [{ orgId: 'o', source: 'generated', age: null }, ModelVerdict.UnknownAge],
    [{ orgId: 'o', source: 'generated', age: STUDIO_MIN_AGE - 1 }, ModelVerdict.UnderAge],
    [{ orgId: 'o', source: 'generated', age: STUDIO_MIN_AGE }, ModelVerdict.Allowed]
  ])('%o → %s', (facts, verdict) => {
    expect(castingVerdict(facts)).toBe(verdict);
  });

  it('riconosce un prodotto per bambini da titolo, tipo o tag', () => {
    expect(isKidsProduct(onesie)).toBe(true);
    expect(isKidsProduct({ title: 'T-shirt bambino', productType: null, tags: [] })).toBe(true);
    expect(isKidsProduct(shirt)).toBe(false);
    expect(isKidsProduct({ title: 'Kidney bean bowl', productType: null, tags: [] })).toBe(false);
  });
});

describe('planBatch', () => {
  it('prodotto × modello × ambiente × inquadratura × variazioni', () => {
    const plan = planBatch({
      products: [shirt],
      models: [{ id: 'm1', viewCount: 2 }, { id: 'm2', viewCount: 2 }],
      environments: [Environment.WhiteEcom, Environment.Marble],
      shots: [Shot.Packshot, Shot.OnModelFront],
      variations: 2
    });
    expect(plan.items).toHaveLength(2 * 2 + 2 * 2 * 2);
    expect(plan.items.filter((i) => i.shot === Shot.Packshot).every((i) => i.influencerId === null)).toBe(true);
  });

  it('un prodotto per bambini non va mai su un modello', () => {
    const plan = planBatch({ products: [onesie], models: [{ id: 'm1', viewCount: 1 }], environments: [Environment.WhiteEcom], shots: [Shot.Packshot, Shot.Lifestyle], variations: 1 });
    expect(plan.items.map((i) => i.shot)).toEqual([Shot.Packshot]);
    expect(plan.skipped).toEqual([{ productTitle: onesie.title, shot: Shot.Lifestyle, reason: SkipReason.KidsProduct }]);
  });

  it('senza modelli scelti le inquadrature on-model sono saltate, non inventate', () => {
    const plan = planBatch({ products: [shirt], models: [], environments: [Environment.WhiteEcom], shots: [Shot.ThreeQuarter], variations: 1 });
    expect(plan.items).toEqual([]);
    expect(plan.skipped[0].reason).toBe(SkipReason.NoModelPicked);
  });

  it('oltre il tetto il piano si dichiara fuori limite', () => {
    const products = Array.from({ length: 30 }, (_, i) => ({ ...shirt, index: i + 1 }));
    const plan = planBatch({ products, models: [], environments: Object.values(Environment), shots: [Shot.Packshot], variations: 1 });
    expect(plan.items.length).toBe(240);
    expect(plan.overLimit).toBe(true);
    expect(BATCH_MAX).toBe(200);
  });

  it('«genera altre» parte dalla variazione successiva', () => {
    const plan = planBatch({ products: [shirt], models: [], environments: [Environment.WhiteEcom], shots: [Shot.Packshot], variations: 2, firstVariation: 3 });
    expect(plan.items.map((i) => i.variation)).toEqual([3, 4]);
  });

  it('una cella è ambiente + inquadratura + modello', () => {
    expect(cellKey({ environment: Environment.Beach, shot: Shot.Detail, influencerId: null })).toBe('beach|detail|-');
  });
});

describe('prompt e riferimenti', () => {
  it('il prompt bloccato chiede fedeltà al prodotto e niente testo', () => {
    const prompt = lockedPrompt({ environment: Environment.Marble, shot: Shot.Packshot, withModel: false, styleRefs: 0 });
    expect(prompt).toContain(ENVIRONMENTS[Environment.Marble].scene);
    expect(prompt).toMatch(/label text/);
    expect(prompt).toMatch(/Do not add any text/);
    expect(prompt).not.toMatch(/style references/);
  });

  it('i riferimenti di stile vietano di copiare persone', () => {
    expect(lockedPrompt({ environment: Environment.Marble, shot: Shot.Lifestyle, withModel: true, styleRefs: 2 })).toMatch(/never copy any person/);
  });

  it('il primo riferimento è il soggetto; quelli di stile non diventano il soggetto', () => {
    const prompt = lockedPrompt({ environment: Environment.WhiteEcom, shot: Shot.Packshot, withModel: false, styleRefs: 1 });
    expect(prompt).toMatch(/first reference image is the product/i);
    expect(prompt).toMatch(/never show the objects or subjects of the style references/i);
  });

  it('i riferimenti di stile cedono il posto a prodotto e modello', () => {
    expect(styleRefBudget({ maxRefs: 10, productImages: 3, modelViews: 4, styleRefs: 5 })).toEqual({ kept: 3, dropped: 2 });
    expect(styleRefBudget({ maxRefs: 3, productImages: 3, modelViews: 2, styleRefs: 1 })).toEqual({ kept: 0, dropped: 1 });
  });
});

describe('macchina a stati', () => {
  it('un item bloccato dalla moderazione non si muove più', () => {
    expect(canMove(ItemStatus.Blocked, ItemStatus.Queued)).toBe(false);
    expect(canMove(ItemStatus.Failed, ItemStatus.Queued)).toBe(true);
    expect(canMove(ItemStatus.Done, ItemStatus.Queued)).toBe(true);
    expect(canMove(ItemStatus.Queued, ItemStatus.Done)).toBe(false);
  });

  it('classifica gli errori', () => {
    expect(failureKind('Refused: too specific — could depict a real person.')).toBe(FailureKind.Moderation);
    expect(failureKind('provider 503 unavailable')).toBe(FailureKind.Transient);
    expect(failureKind('conflict')).toBe(FailureKind.Transient);
    expect(failureKind('prompt_required')).toBe(FailureKind.Permanent);
  });

  it('un errore transitorio si ritenta al massimo due volte, con attesa crescente', () => {
    expect(afterFailure('timeout', 1)).toEqual({ status: ItemStatus.Queued, delayMs: 30_000 });
    expect(afterFailure('timeout', 2)).toEqual({ status: ItemStatus.Queued, delayMs: 60_000 });
    expect(afterFailure('timeout', MAX_RETRIES + 1)).toEqual({ status: ItemStatus.Failed });
  });

  it('un blocco di moderazione non si ritenta mai', () => {
    expect(afterFailure('Refused: unsafe', 1)).toEqual({ status: ItemStatus.Blocked });
  });

  it.each([
    ['Refused: could depict a real person.', /blocked/i],
    ['provider 503 unavailable', /busy/i],
    ['store_failed', /could not be made/i]
  ])('%s: spiega il motivo e cosa fare', (error, problem) => {
    const text = failureText(error);
    expect(text.problem).toMatch(problem);
    expect(text.fix.length).toBeGreaterThan(10);
  });
});

describe('drenaggio parallelo', () => {
  const q = (id: string, orgId: string, genNodeId: string) => ({ id, orgId, genNodeId });

  it('al massimo K per org, e mai due item sullo stesso nodo insieme', () => {
    const queued = [q('a', 'o1', 'n1'), q('b', 'o1', 'n1'), q('c', 'o1', 'n2'), q('d', 'o1', 'n3'), q('e', 'o1', 'n4'), q('f', 'o2', 'n9')];
    const picked = pickRunnable(queued, [q('r', 'o1', 'n5')], 3);
    expect(picked.map((p) => p.id)).toEqual(['a', 'c', 'f']);
  });

  it('un nodo già in corso non riceve un secondo item', () => {
    expect(pickRunnable([q('a', 'o1', 'n1')], [q('r', 'o1', 'n1')], 4)).toEqual([]);
  });
});

describe('crediti', () => {
  it('blocca quando il saldo non copre il totale', () => {
    expect(creditCheck(7, 10, 69)).toEqual({ total: 70, balance: 69, enough: false });
    expect(creditCheck(7, 10, 70).enough).toBe(true);
  });
});
