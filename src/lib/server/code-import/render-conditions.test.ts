import { describe, expect, it } from 'vitest';
import { AxisSupport, BASE_CONDITIONS, CONDITION_AXES, conditionKey, conditionsOf, labelOf, parseKey, Scheme, variantsOf } from './render-conditions';

describe('render conditions', () => {
  it('la condizione di base non lascia traccia sulla sorgente', () => {
    expect(conditionKey(BASE_CONDITIONS)).toBeUndefined();
  });

  it('una condizione diversa dalla base ha una chiave che si rilegge uguale', () => {
    const dark = { scheme: Scheme.Dark, width: 390 };
    expect(parseKey(conditionKey(dark))).toEqual(dark);
    expect(parseKey(undefined)).toEqual(BASE_CONDITIONS);
  });

  it('le condizioni chieste vengono validate, e una chiesta male cade sulla base', () => {
    expect(conditionsOf([{ scheme: 'dark', width: 768 }, { scheme: 'sepia', width: 1 }, 'x'])).toEqual([{ scheme: Scheme.Dark, width: 768 }]);
    expect(conditionsOf(undefined)).toEqual([BASE_CONDITIONS]);
    expect(conditionsOf([])).toEqual([BASE_CONDITIONS]);
  });

  it('una rotta per ogni condizione, affiancate, con il nome che dice sotto quale condizione sono', () => {
    const pages = variantsOf(['/a', '/b'], [BASE_CONDITIONS, { scheme: Scheme.Dark, width: 1280 }]);
    expect(pages.map((p) => p.label)).toEqual(['/a', '/a · dark', '/b', '/b · dark']);
    expect(labelOf('/a', { scheme: Scheme.Light, width: 390 })).toBe('/a · 390px');
  });

  it('ogni asse ha una riga con lo stato, e ciò che non è supportato dice perché', () => {
    for (const axis of CONDITION_AXES) {
      expect(axis.reason.length).toBeGreaterThan(0);
    }
    expect(CONDITION_AXES.find((a) => a.id === 'theme')?.support).toBe(AxisSupport.Switchable);
    expect(CONDITION_AXES.filter((a) => a.support === AxisSupport.Unsupported).length).toBeGreaterThan(0);
  });
});
