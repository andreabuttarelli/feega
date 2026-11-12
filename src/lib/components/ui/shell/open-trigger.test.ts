// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { openTrigger } from './open-trigger';

describe('open trigger', () => {
  it('is the expanded menu button outside the menu, not a submenu button inside it', () => {
    document.body.innerHTML = `
      <button id="closed" aria-haspopup="menu" aria-expanded="false"></button>
      <button id="view" aria-haspopup="menu" aria-expanded="true"></button>
      <div id="menu" role="menu"><button id="sub" aria-haspopup="menu" aria-expanded="true"></button></div>`;

    expect(openTrigger(document.getElementById('menu')!)?.id).toBe('view');
  });

  it('is nothing when no menu button is expanded', () => {
    document.body.innerHTML = `<div id="menu" role="menu"></div>`;

    expect(openTrigger(document.getElementById('menu')!)).toBeNull();
  });
});
