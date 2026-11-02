// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldKeys } from './field-keys';

function mount(value = '24.0') {
  const input = document.createElement('input');
  input.value = value;
  document.body.append(input);
  const detach = fieldKeys(input);
  input.focus();
  return { input, detach };
}

const press = (input: HTMLInputElement, key: string) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(e);
  return e;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('field keys', () => {
  it('Enter leaves the field so app undo owns the next shortcut', () => {
    const { input } = mount();
    input.value = '30';
    press(input, 'Enter');

    expect(document.activeElement).not.toBe(input);
  });

  it('Escape reverts the typed text and leaves the field', () => {
    const { input } = mount();

    input.value = '999';
    press(input, 'Escape');

    expect(input.value).toBe('24.0');
    expect(document.activeElement).not.toBe(input);
  });

  it('Escape never reaches the selection shortcuts', () => {
    const { input } = mount();
    const reached = vi.fn();
    document.body.addEventListener('keydown', reached);

    press(input, 'Escape');

    expect(reached).not.toHaveBeenCalled();
  });

  it('stops listening after detach', () => {
    const { input, detach } = mount();
    detach();

    input.value = '5';
    press(input, 'Escape');

    expect(input.value).toBe('5');
  });
});
