import { describe, expect, it } from 'vitest';
import { AI_PANEL_NODES } from './ai-panel';
import { CANVAS_ADD_BAR } from './addable';

describe('AI_PANEL_NODES', () => {
  it('offers the products and social feed nodes next to the generators', () => {
    expect(AI_PANEL_NODES).toContain('products');
    expect(AI_PANEL_NODES).toContain('social_account_feed');
    expect(AI_PANEL_NODES).toEqual(expect.arrayContaining(['text', 'image', 'video']));
  });

  it('keeps them out of the add menu', () => {
    expect(CANVAS_ADD_BAR).not.toContain('products');
    expect(CANVAS_ADD_BAR).not.toContain('social_account_feed');
  });
});
