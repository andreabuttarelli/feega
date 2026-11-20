import { describe, expect, it } from 'vitest';
import { PageTarget, pageRule } from './page-rule';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

describe('page-wide styles', () => {
  it('body styles land in the global stylesheet, merged into an existing body rule', async () => {
    const css = '@import "tailwindcss";\n\nbody {\n  margin: 0;\n}\n';
    const out = await pageRule(files({ 'src/app.css': css }), PageTarget.Body, { 'background-color': '#111111', margin: '8px' });

    expect(out).toEqual({ ok: true, change: { path: 'src/app.css', before: css, after: '@import "tailwindcss";\n\nbody {\n  margin: 8px;\n  background-color: #111111;\n}\n' } });
  });

  it('html gets its own rule appended when there is none', async () => {
    const out = await pageRule(files({ 'app/globals.css': '.x {\n  color: red;\n}\n' }), PageTarget.Html, { 'font-size': '18px' });

    expect(out.ok && out.change.after).toBe('.x {\n  color: red;\n}\n\nhtml {\n  font-size: 18px;\n}\n');
  });

  it('a body rule is not confused with a selector that only contains the word', async () => {
    const css = '.body {\n  color: red;\n}\n';
    const out = await pageRule(files({ 'src/app.css': css }), PageTarget.Body, { color: 'blue' });

    expect(out.ok && out.change.after).toBe('.body {\n  color: red;\n}\n\nbody {\n  color: blue;\n}\n');
  });

  it('without a global stylesheet it says so', async () => {
    const out = await pageRule(files({}), PageTarget.Body, { color: 'red' });

    expect(out.ok).toBe(false);
  });
});
