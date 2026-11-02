import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name: string) => readFileSync(new URL(`../components/motion/${name}`, import.meta.url), 'utf8');

describe('decimal point in inspector fields', () => {
  it('the number field resets the inherited negative tracking that swallows the point', () => {
    expect(source('NumberField.svelte')).toMatch(/\.num\s*\{[^}]*letter-spacing:\s*normal/);
  });

  it('the corner and plain inspector inputs reset it too', () => {
    const inspector = source('MotionInspector.svelte');

    expect(inspector).toMatch(/\.corner input\s*\{[^}]*letter-spacing:\s*normal/);
    expect(inspector).toMatch(/input\[type='text'\],\s*textarea,\s*select\s*\{[^}]*letter-spacing:\s*normal/);
  });
});
