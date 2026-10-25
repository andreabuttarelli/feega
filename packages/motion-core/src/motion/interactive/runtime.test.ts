// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { paintVars } from './runtime';
import { BindPaint } from './var-model';

describe('variables painted into the composition', () => {
  it('writes text and colours where they are bound, and skips what is not text', () => {
    document.body.innerHTML = '<div data-clip="t1"><div data-fit><span>Old</span></div></div><div data-clip="c1"><span data-fit>x</span></div>';
    const bindings = [
      { var: 'label', selector: '[data-clip="t1"] [data-fit]', paint: BindPaint.Text },
      { var: 'tint', selector: '[data-clip="t1"] [data-fit]', paint: BindPaint.Color },
      { var: 'box', selector: '[data-clip="c1"] [data-fit]', paint: BindPaint.Background },
      { var: 'speed', selector: '[data-clip="c1"] [data-fit]', paint: BindPaint.Text }
    ];

    paintVars(document, bindings, { label: 'New', tint: '#ff0000', box: '#00ff00', speed: 2 });

    const title = document.querySelector<HTMLElement>('[data-clip="t1"] [data-fit]')!;
    const caption = document.querySelector<HTMLElement>('[data-clip="c1"] [data-fit]')!;
    expect(title.textContent).toBe('New');
    expect(title.style.color).toBe('rgb(255, 0, 0)');
    expect(caption.style.background).toContain('rgb(0, 255, 0)');
    expect(caption.textContent).toBe('x');
  });
});
