import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button.svelte';

describe('buttonVariants', () => {
  it('keeps the type role and the text colour together', () => {
    const classes = buttonVariants({ variant: 'primary', size: 'sm' }).split(' ');

    expect(classes).toContain('text-ui-label');
    expect(classes).toContain('text-ui-on-accent');
  });
});
