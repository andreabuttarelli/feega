import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { currentIcon, iconNameOf } from './icon-current';

describe('iconNameOf', () => {
  it.each([
    ['ArrowRight', 'arrow-right'],
    ['IconArrowRight', 'arrow-right'],
    ['ArrowRightIcon', 'arrow-right'],
    ['Heart', 'heart'],
    ['Disc3', 'disc3']
  ])('turns the component %s into the icon name %s', (component, name) => {
    expect(iconNameOf(component)).toBe(name);
  });

  it('has no name for a plain element', () => {
    expect(iconNameOf('svg')).toBeNull();
    expect(iconNameOf('')).toBeNull();
  });
});

describe('currentIcon', () => {
  const root = mkdtempSync(join(tmpdir(), 'icon-current-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/App.jsx'), 'export const A = () => (\n  <div>\n    <ArrowRight id="a" />\n  </div>\n);\n');

  it('names the icon component at the element position', async () => {
    expect(await currentIcon(root, 'src/App.jsx:3:5')).toBe('arrow-right');
  });

  it('has no icon when the position is not a component', async () => {
    expect(await currentIcon(root, 'src/App.jsx:2:3')).toBeNull();
  });

  it('has no icon for a file that is missing or outside the workspace', async () => {
    expect(await currentIcon(root, 'src/Nope.jsx:1:1')).toBeNull();
    expect(await currentIcon(root, '../outside.jsx:1:1')).toBeNull();
    expect(await currentIcon(root, 'garbage')).toBeNull();
  });
});
