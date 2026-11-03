import { describe, expect, it, vi } from 'vitest';

const built = vi.hoisted(() => ({ linted: 0, exposed: 0 }));

vi.mock('$lib/motion/custom/lint', async (actual) => {
  const real = await actual<typeof import('$lib/motion/custom/lint')>();
  return { ...real, lintSource: (...args: Parameters<typeof real.lintSource>) => ((built.linted += 1), real.lintSource(...args)) };
});

vi.mock('./fields', async (actual) => {
  const real = await actual<typeof import('./fields')>();
  return { ...real, exposeField: (...args: Parameters<typeof real.exposeField>) => ((built.exposed += 1), real.exposeField(...args)) };
});

describe('the built-in templates', () => {
  it('build no doc when the canvas loads them', async () => {
    const { BUILTIN_TEMPLATES } = await import('./builtins');

    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(0);
    expect(built).toEqual({ linted: 0, exposed: 0 });
  });

  it('build a doc the first time it is read and keep it', async () => {
    const { builtinTemplate } = await import('./builtins');
    const { CLOUD_TEMPLATE_ID } = await import('./media-cloud/template');
    const entry = builtinTemplate(CLOUD_TEMPLATE_ID)!;

    const first = entry.template.doc;
    const after = { ...built };
    const again = entry.template.doc;

    expect(after.linted).toBeGreaterThan(0);
    expect(again).toBe(first);
    expect(built).toEqual(after);
  });
});
