// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resetForm } from './reset-form';

describe('resetForm', () => {
  it('resets a form that has a field named reset', () => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="cap" value="a"><select name="reset"><option value="none">n</option><option value="monthly">m</option></select>';
    Object.defineProperty(form, 'reset', { value: form.elements.namedItem('reset') });
    const cap = form.elements.namedItem('cap') as HTMLInputElement;
    cap.value = 'changed';

    resetForm(form);

    expect(cap.value).toBe('a');
  });
});
