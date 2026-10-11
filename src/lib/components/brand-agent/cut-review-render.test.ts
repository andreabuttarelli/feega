import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import CutReview from './CutReview.svelte';

describe('cut review card', () => {
  it('shows the contact sheet, the score and every fix, with the three answers', () => {
    const body = render(CutReview, { props: { review: { score: 5, fixes: ['2s: the frame is empty'], sheet: 'o/p/web-views/critic-sheet-1/sheet.jpg' }, sheetHref: '/p/p/c/c/web-views/critic-sheet-1/sheet.jpg', onanswer: () => {} } }).body;

    expect(body).toContain('data-testid="cut-review"');
    expect(body).toContain('5/10');
    expect(body).toContain('2s: the frame is empty');
    expect(body).toContain('src="/p/p/c/c/web-views/critic-sheet-1/sheet.jpg"');
    expect(body).toContain('data-testid="cut-apply"');
    expect(body).toContain('data-testid="cut-always"');
    expect(body).toContain('data-testid="cut-ship"');
  });
});
