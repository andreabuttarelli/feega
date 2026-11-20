import { describe, expect, it } from 'vitest';
import { VariableHome, freeVariable, saveVariable } from './save-variable';

describe('saveVariable', () => {
  it('adds the property to the existing :root rule', () => {
    const out = saveVariable(':root {\n  --ink: #111;\n}\n', 'brand', '#0078d4', VariableHome.Root);

    expect(out).toBe(':root {\n  --ink: #111;\n  --brand: #0078d4;\n}\n');
  });

  it('creates :root when the sheet has none', () => {
    expect(saveVariable('body { margin: 0; }\n', 'brand', '#0078d4', VariableHome.Root)).toBe(':root {\n  --brand: #0078d4;\n}\n\nbody { margin: 0; }\n');
  });

  it('with Tailwind v4 the colour goes in @theme as --color-*, so bg-brand works', () => {
    expect(saveVariable('@import "tailwindcss";\n', 'brand', '#0078d4', VariableHome.Theme)).toBe('@import "tailwindcss";\n\n@theme {\n  --color-brand: #0078d4;\n}\n');
  });
});

describe('freeVariable', () => {
  it('suggests a kebab name that is not taken', () => {
    expect(freeVariable('Brand Blue', ':root { --brand-blue: red; }')).toBe('brand-blue-2');
    expect(freeVariable('Accent', '')).toBe('accent');
  });
});
