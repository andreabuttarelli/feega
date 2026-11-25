import { describe, expect, it } from 'vitest';
import { ImpactKind, type Impact } from '../messages';
import { withImpact } from './ai-context';

const CONTEXT = ['Feega selection', 'source: src/Hero.svelte:12:3', 'selector: h1.title', 'page: /'].join('\n');

describe('the impact in the context', () => {
  it('adds how widely the element is shared', () => {
    const impact: Impact = { kind: ImpactKind.Component, name: 'Hero', files: [{ file: 'a.svelte', line: 1 }, { file: 'b.svelte', line: 2 }] };

    expect(withImpact(CONTEXT, impact)).toContain('impact: component Hero used in 2 places');
  });

  it('says a local element only affects itself', () => {
    expect(withImpact(CONTEXT, { kind: ImpactKind.Local })).toContain('impact: this element only');
  });

  it('adds nothing when the impact is not known yet', () => {
    expect(withImpact(CONTEXT, null)).toBe(CONTEXT);
  });
});
