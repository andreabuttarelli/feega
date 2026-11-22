import { describe, expect, it } from 'vitest';
import { addDependency } from './add-dependency';

describe('addDependency', () => {
  it('adds the package in alphabetical order and keeps the indent and final newline', () => {
    const before = '{\n  "name": "a",\n  "dependencies": {\n    "svelte": "^5.0.0",\n    "zod": "^3.0.0"\n  }\n}\n';
    const out = addDependency(before, 'three', '^0.180.0');
    expect(out).toEqual({ ok: true, after: '{\n  "name": "a",\n  "dependencies": {\n    "svelte": "^5.0.0",\n    "three": "^0.180.0",\n    "zod": "^3.0.0"\n  }\n}\n' });
  });

  it('keeps tab indentation', () => {
    const out = addDependency('{\n\t"name": "a"\n}', 'three', '^1.0.0');
    expect(out).toEqual({ ok: true, after: '{\n\t"name": "a",\n\t"dependencies": {\n\t\t"three": "^1.0.0"\n\t}\n}' });
  });

  it('leaves the file alone when the package is already a dependency', () => {
    const before = '{\n  "dependencies": {\n    "three": "^0.150.0"\n  }\n}\n';
    expect(addDependency(before, 'three', '^0.180.0')).toEqual({ ok: true, after: before });
  });

  it('leaves the file alone when the package is a dev dependency', () => {
    const before = '{\n  "devDependencies": {\n    "three": "^0.150.0"\n  }\n}\n';
    expect(addDependency(before, 'three', '^0.180.0')).toEqual({ ok: true, after: before });
  });

  it('adds to devDependencies when asked', () => {
    const out = addDependency('{\n  "devDependencies": {\n    "vite": "^5.0.0"\n  }\n}\n', '@types/three', '^0.180.0', true);
    expect(out).toEqual({ ok: true, after: '{\n  "devDependencies": {\n    "@types/three": "^0.180.0",\n    "vite": "^5.0.0"\n  }\n}\n' });
  });

  it('refuses text that is not json', () => {
    expect(addDependency('{ nope', 'three', '^1.0.0').ok).toBe(false);
  });

  it('refuses a missing package.json', () => {
    expect(addDependency(null, 'three', '^1.0.0')).toEqual({ ok: false, reason: 'package.json not found' });
  });
});
