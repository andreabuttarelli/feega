import { describe, expect, it } from 'vitest';
import { Framework } from '@feega/plugin-api/protocol';
import { Stack, dependenciesFor, planFor, stackOf } from './stack';

const REACT_18 = { react: '^18.3.1', 'react-dom': '^18.3.1' };
const REACT_19 = { react: '^19.0.0', 'react-dom': '^19.0.0' };

describe('stackOf', () => {
  it.each([
    ['src/App.tsx', Framework.React, REACT_18, Stack.React],
    ['app/page.tsx', Framework.React, { ...REACT_19, next: '^15.0.0' }, Stack.Next],
    ['src/pages/index.astro', Framework.Astro, { ...REACT_19, '@astrojs/react': '^4.0.0' }, Stack.Astro],
    ['src/pages/index.astro', Framework.Astro, {}, Stack.AstroWithoutReact],
    ['src/App.vue', Framework.Vue, {}, Stack.Vue],
    ['src/routes/+page.svelte', Framework.Svelte, {}, Stack.Svelte]
  ])('%s is %s', (file, framework, packages, stack) => {
    expect(stackOf(framework, packages)).toBe(stack);
  });
});

describe('planFor', () => {
  it('writes a client component for Next.js', () => {
    expect(planFor(Stack.Next)).toMatchObject({ ok: true, clientDirective: true, attributes: '' });
  });

  it('keeps React and React Router plain', () => {
    expect(planFor(Stack.React)).toMatchObject({ ok: true, clientDirective: false, attributes: '' });
  });

  it('mounts the component in the browser only in Astro', () => {
    expect(planFor(Stack.Astro)).toMatchObject({ ok: true, clientDirective: false, attributes: 'client:only="react"' });
  });

  it.each([
    [Stack.AstroWithoutReact, '@astrojs/react'],
    [Stack.Vue, 'Vue'],
    [Stack.Svelte, 'Svelte']
  ])('is unavailable in %s, with the reason', (stack, word) => {
    const plan = planFor(stack);
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toContain(word);
  });
});

describe('dependenciesFor', () => {
  it('asks for the React 18 line of the 3D libraries on React 18', () => {
    expect(dependenciesFor(REACT_18)).toEqual({ ok: true, missing: [{ name: '@shadergradient/react', version: '^2.4.20' }, { name: '@react-three/fiber', version: '^8.17.10' }, { name: 'three', version: '^0.169.0' }] });
  });

  it('asks for the React 19 line on React 19', () => {
    expect(dependenciesFor(REACT_19)).toMatchObject({ ok: true, missing: expect.arrayContaining([{ name: '@react-three/fiber', version: '^9.0.0' }]) });
  });

  it('asks only for what is missing', () => {
    expect(dependenciesFor({ ...REACT_18, three: '^0.170.0', '@react-three/fiber': '^8.17.10' })).toEqual({ ok: true, missing: [{ name: '@shadergradient/react', version: '^2.4.20' }] });
    expect(dependenciesFor({ ...REACT_18, '@shadergradient/react': '^2.4.20', three: '^0.169.0', '@react-three/fiber': '^8.17.10' })).toEqual({ ok: true, missing: [] });
  });

  it('refuses a React major the package does not support', () => {
    const out = dependenciesFor({ react: '^17.0.2' });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toContain('React 18 or 19');
    expect(dependenciesFor({}).ok).toBe(false);
  });
});
