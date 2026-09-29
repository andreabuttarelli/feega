import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AI_MARKUP,
  billedCreditsFor,
  CREDIT_LADDER,
  MARGIN_FLOOR,
  marginForRung,
  rungFor
} from './credit-ladder';
import { DISPLAY_UNITS_PER_CREDIT } from './components/credit-amount-format';
import { estimateLoopCredits } from './server/canvas/loop-cost';
import { IMAGE_CREDITS, videoCredits } from './server/content-cost';

describe('credit ladder never falls below the margin floor', () => {
  for (const rung of CREDIT_LADDER) {
    it(`$${rung.price} clears the floor when every credit is spent`, () => {
      expect(marginForRung(rung.price, rung.credits)).toBeGreaterThanOrEqual(MARGIN_FLOOR);
    });
  }

  it('every rung is a flat 50% margin', () => {
    for (const rung of CREDIT_LADDER) {
      expect(marginForRung(rung.price, rung.credits)).toBeCloseTo(0.5, 5);
    }
  });
});

describe('the plans feega.app sells', () => {
  it('are the six monthly tiers of the site, in order', () => {
    expect(CREDIT_LADDER.map((r) => r.price)).toEqual([8, 16, 32, 64, 128, 256]);
  });

  it('grant one displayed credit per dollar', () => {
    for (const rung of CREDIT_LADDER) {
      expect(rung.credits / DISPLAY_UNITS_PER_CREDIT).toBe(rung.price);
    }
  });

  it('name the Stripe price by lookup key, never by id', () => {
    expect(CREDIT_LADDER.map((r) => r.lookupKey)).toEqual([
      'feega_monthly_8',
      'feega_monthly_16',
      'feega_monthly_32',
      'feega_monthly_64',
      'feega_monthly_128',
      'feega_monthly_256'
    ]);
  });

  it('find a rung by its price and refuse any other', () => {
    expect(rungFor(32)?.credits).toBe(3_200);
    expect(rungFor(30)).toBeUndefined();
  });
});

describe('billedCreditsFor', () => {
  it('matches the anchor: $1 of provider cost bills 200 credits at 100% markup', () => {
    expect(AI_MARKUP).toBe(1.0);
    expect(billedCreditsFor(1)).toBe(200);
  });

  it('$8 of credits cost us $4 of provider spend', () => {
    expect(rungFor(8)!.credits / 200).toBeCloseTo(4, 5);
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
    // dal cambio di FATTURAZIONE (billedCreditsFor, 200 crediti = $1 di costo provider). Le due
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
