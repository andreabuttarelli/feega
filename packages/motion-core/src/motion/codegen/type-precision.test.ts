import { describe, expect, it } from 'vitest';
import { Direction, Sizing } from '../layout/auto-layout';
import { CodeTarget, exportCode } from './index';
import { box, DocKit } from './fixtures/kit';

function tracked() {
  const kit = new DocKit(1280, 720);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1280, 720), layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.text('h', 'Headline', { parent: 'page', name: 'Headline', size: 64, tracking: -0.045, font: 'Inter' });
  return kit.doc();
}

describe('type values keep their precision', () => {
  it('letter-spacing is not rounded to two decimals', () => {
    const css = exportCode(tracked(), { target: CodeTarget.Html }).files.find((f) => f.path.endsWith('page.css'))!.content;

    expect(css).toContain('letter-spacing: -0.045em;');
  });
});

describe('titles outside the safe area', () => {
  function title(left: number) {
    const kit = new DocKit(1280, 720);
    kit.frame('page', { name: 'Page', box: box(0, 0, 1280, 720) });
    kit.text('t', 'Big title', { parent: 'page', name: 'Hero title', size: 64, font: 'Inter', component: 'Title', box: box(left, 100, 400, 100) });
    return exportCode(kit.doc(), { target: CodeTarget.Html }).notes;
  }

  it('are listed as clipped on the canvas and not in the export', () => {
    expect(title(0).join('\n')).toContain('Hero title: the canvas clips a title to a 5% safe area, the export does not');
  });

  it('say nothing for a title inside it', () => {
    expect(title(200).join('\n')).not.toContain('safe area');
  });
});
