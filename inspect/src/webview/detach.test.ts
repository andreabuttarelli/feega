import { describe, expect, it } from 'vitest';
import { Scope } from '@feega/live-edit/scoped-rule';
import { DETACH_ID, MENU_ITEMS, menuFor } from './structure-menu';
import { detachState, sharedWarning, type DetachPick, type SharedFacts } from './detach';

const pick = (over: Partial<DetachPick> = {}): DetachPick => ({ source: { file: 'src/Button.tsx', line: 1, col: 1 }, component: { file: 'src/Home.tsx', line: 5, col: 5 }, instances: 3, ...over });

const facts = (over: Partial<SharedFacts> = {}): SharedFacts => ({ pick: pick(), scope: Scope.Element, dismissed: new Set(), enabled: true, ...over });

describe('detachState', () => {
  it('is available on an instance of a React component', () => {
    expect(detachState(pick())).toEqual({ show: true });
  });

  it('is hidden on an element that is not inside a component', () => {
    expect(detachState(pick({ component: null }))).toEqual({ show: false });
  });

  it('is hidden without a selection', () => {
    expect(detachState(null)).toEqual({ show: false });
  });

  it('is shown but refused for a file kind it cannot copy', () => {
    expect(detachState(pick({ source: { file: 'src/Button.ts', line: 1, col: 1 } }))).toEqual({ show: true, reason: 'Detach works on React, Svelte, Vue and Astro components' });
  });

  it.each(['a.tsx', 'a.jsx', 'a.svelte', 'a.vue', 'a.astro'])('supports %s', (file) => {
    expect(detachState(pick({ source: { file, line: 1, col: 1 } }))).toEqual({ show: true });
  });
});

describe('menuFor with detach', () => {
  const ids = (items: ReturnType<typeof menuFor>) => items.map((item) => item.id);

  it('lists Detach instance for one selected component instance', () => {
    expect(ids(menuFor(1, { show: true }))).toContain(DETACH_ID);
  });

  it('leaves it out when it does not apply', () => {
    expect(ids(menuFor(1, { show: false }))).not.toContain(DETACH_ID);
  });

  it('leaves it out for several elements', () => {
    expect(ids(menuFor(2, { show: true }))).not.toContain(DETACH_ID);
  });

  it('carries the refusal reason as the disabled hint', () => {
    expect(menuFor(1, { show: true, reason: 'nope' }).find((item) => item.id === DETACH_ID)?.disabled).toBe('nope');
  });

  it('keeps every other entry unchanged', () => {
    expect(ids(menuFor(1, { show: true })).filter((id) => id !== DETACH_ID)).toEqual(ids(MENU_ITEMS.filter((item) => item.id !== DETACH_ID)));
  });
});

describe('sharedWarning', () => {
  it('shows for an edit that reaches several instances', () => {
    expect(sharedWarning(facts())).toEqual({ instances: 3, component: 'src/Button.tsx' });
  });

  it('is silent for a single instance', () => {
    expect(sharedWarning(facts({ pick: pick({ instances: 1 }) }))).toBeNull();
  });

  it('is silent when the scope is not the element', () => {
    expect(sharedWarning(facts({ scope: Scope.Class }))).toBeNull();
  });

  it('is silent for a dismissed component only', () => {
    expect(sharedWarning(facts({ dismissed: new Set(['src/Button.tsx']) }))).toBeNull();
    expect(sharedWarning(facts({ dismissed: new Set(['src/Other.tsx']) }))).not.toBeNull();
  });

  it('is silent once the setting is off', () => {
    expect(sharedWarning(facts({ enabled: false }))).toBeNull();
  });

  it('is silent without a selection', () => {
    expect(sharedWarning(facts({ pick: null }))).toBeNull();
  });
});
