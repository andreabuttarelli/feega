import { describe, expect, it } from 'vitest';
import { readScales } from './theme-scales';

const APP_CSS = `@import 'tailwindcss';

@theme {
  --spacing: 0.5rem;
  --radius-card: 14px;
  --text-display: 56px;
}
`;

const readWith = (css: string) => async (path: string) => (path === 'src/app.css' ? css : null);

describe('readScales', () => {
  it('uses the Tailwind defaults for a project without a theme', async () => {
    const scales = await readScales(async () => null);

    expect(scales.spacing.find((s) => s.name === '4')).toEqual({ px: 16, name: '4' });
    expect(scales.radius.find((s) => s.name === 'lg')).toEqual({ px: 8, name: 'lg' });
    expect(scales.fontSize.find((s) => s.name === 'xl')).toEqual({ px: 20, name: 'xl' });
  });

  it('scales spacing by the theme base', async () => {
    const scales = await readScales(readWith(APP_CSS));

    expect(scales.spacing.find((s) => s.name === '4')).toEqual({ px: 32, name: '4' });
  });

  it('adds the theme radii and sizes next to the defaults', async () => {
    const scales = await readScales(readWith(APP_CSS));

    expect(scales.radius).toContainEqual({ px: 14, name: 'card' });
    expect(scales.fontSize).toContainEqual({ px: 56, name: 'display' });
  });

  it('lists every scale from small to large', async () => {
    const scales = await readScales(readWith(APP_CSS));

    for (const steps of Object.values(scales)) {
      expect(steps.map((s) => s.px)).toEqual([...steps.map((s) => s.px)].sort((a, b) => a - b));
    }
  });

  it('lists a size once when two steps share it', async () => {
    const scales = await readScales(readWith('@theme { --radius-pill: 8px; }'));

    expect(scales.radius.filter((s) => s.px === 8)).toHaveLength(1);
  });
});
