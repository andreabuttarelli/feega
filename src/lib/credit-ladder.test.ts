import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AI_MARKUP,
  billedCreditsFor,
  MARGIN_FLOOR,
  marginForRung,
  PLAN,
  planForLookupKey,
  TOP_UPS,
  topUpFor
} from './credit-ladder';
import { estimateLoopCredits } from './server/canvas/loop-cost';
import { IMAGE_CREDITS, videoCredits } from './server/content-cost';

describe('nothing feega sells falls below the margin floor', () => {
  for (const offer of [PLAN, ...TOP_UPS]) {
    it(`€${offer.price} for ${offer.credits} credits clears the floor when every credit is spent`, () => {
      expect(marginForRung(offer.price, offer.credits)).toBeGreaterThanOrEqual(MARGIN_FLOOR);
    });
  }
});

describe('what feega.app sells', () => {
  it('is one monthly plan: €9 for 500 credits, on the feega_monthly_9 Stripe price', () => {
    expect(PLAN).toEqual({ price: 9, credits: 500, lookupKey: 'feega_monthly_9' });
  });

  it('and three top-ups at 100 credits per euro', () => {
    expect(TOP_UPS).toEqual([
      { price: 10, credits: 1_000 },
      { price: 20, credits: 2_000 },
      { price: 50, credits: 5_000 }
    ]);
  });

  it('finds a top-up by its credits and refuses any other amount', () => {
    expect(topUpFor(2_000)?.price).toBe(20);
    expect(topUpFor(20)).toBeUndefined();
    expect(topUpFor(500)).toBeUndefined();
  });

  it('still recognises a subscriber on a retired monthly price', () => {
    expect(planForLookupKey('feega_monthly_9')).toEqual(PLAN);
    expect(planForLookupKey('feega_monthly_32')).toEqual({ price: 32, credits: 3_200, lookupKey: 'feega_monthly_32' });
    expect(planForLookupKey('feega_monthly_7')).toBeUndefined();
    expect(planForLookupKey(null)).toBeUndefined();
  });
});

describe('billedCreditsFor', () => {
  it('matches the anchor: $1 of provider cost bills 120 credits at 20% markup', () => {
    expect(AI_MARKUP).toBe(0.2);
    expect(billedCreditsFor(1)).toBe(120);
  });
});

// Il loop preventiva PRIMA di girare (CLAUDE.md, il nodo mostra il costo prima del clic) e il
// numero mostrato deve essere quello che ai-log.ts addebita davvero — mai un secondo cambio.
describe('il preventivo del loop usa lo stesso cambio della fattura reale', () => {
  it('image: perRun = billedCreditsFor del costo provider misurato', () => {
    const out = estimateLoopCredits({ medium: 'image', model: null, count: 1 });
    expect(out.perRun).toBe(IMAGE_CREDITS);
    expect(out.perRun).toBe(billedCreditsFor(0.069));
  });

  it('video: perRun = billedCreditsFor del costo provider del modello scelto', () => {
    const model = 'bytedance/seedance-2-5';
    const out = estimateLoopCredits({ medium: 'video', model, count: 1 });
    expect(out.perRun).toBe(videoCredits(model));
    expect(out.perRun).toBe(billedCreditsFor(2.1));
  });
});

// Un secondo cambio credito↔dollaro fuori da credit-ladder.ts è esattamente il difetto che ha
// fatto stimare 7 crediti/run un run che ne costava davvero ~14: un file che riscrive
// `CREDITS_PER_USD` diverge dal listino reale al primo prezzo cambiato, in silenzio.
describe('nessun secondo cambio credito/dollaro fuori da credit-ladder.ts', () => {
  const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
  const FORBIDDEN = /\bCREDITS_PER_USD\b\s*=/;
  const ALLOWED_FILES = new Set([
    'credit-ladder.ts',
    'credit-ladder.test.ts',
    // Tasso di ACQUISTO (100 crediti = $1 di listino, PLANS[].credits) — un concetto diverso
    // dal cambio di FATTURAZIONE (billedCreditsFor, 120 crediti = $1 di costo provider). Le due
    // costanti coesistono per costruzione (vedi il commento in testa a credit-ladder.ts); qui
    // ereditano il nome canonico invece di un numero riscritto.
    'server/plan-budget.ts',
    'server/plans.test.ts'
  ]);

  function listTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (statSync(full).isDirectory()) {
        out.push(...listTsFiles(full));
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const files = listTsFiles(SRC_DIR).filter((f) => /\.tsx?$/.test(f));

  it('ha trovato file .ts da controllare', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [f.slice(SRC_DIR.length), f] as const))('%s', (label, file) => {
    if (ALLOWED_FILES.has(label)) return;
    const content = readFileSync(file, 'utf-8');
    expect(
      FORBIDDEN.test(content),
      `${label} dichiara un CREDITS_PER_USD proprio — deriva da billedCreditsFor o CREDITS_PER_USD_SUBSCRIPTION_LIST in credit-ladder.ts`
    ).toBe(false);
  });
});

describe('multipliers on our cost', () => {
	it('a render never bills under the floor of four', async () => {
		const { RENDER_MULTIPLIER } = await import('$lib/motion/render-quote');
		const { MULTIPLIER_FLOOR } = await import('./credit-ladder');

		expect(MULTIPLIER_FLOOR).toBe(4);
		expect(RENDER_MULTIPLIER).toBeGreaterThanOrEqual(MULTIPLIER_FLOOR);
	});

	it('a chat turn bills 1.2 times its cost, a decision outside the render floor', async () => {
		const { CHAT_MULTIPLIER } = await import('./credit-ladder');

		expect(CHAT_MULTIPLIER).toBe(1.2);
	});
});
