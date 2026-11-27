import { describe, expect, it } from 'vitest';
import { styleImportsOf } from './layout-styles.ts';

describe('styleImportsOf', () => {
  it('takes the stylesheets a layout imports for their side effect', () => {
    const code = "import '../app.css';\nimport favicon from '@/favicon.svg';\nimport \"@/theme.scss\";\nimport './local.css'";

    expect(styleImportsOf(code, 'src/routes/+layout.svelte')).toEqual(['/src/app.css', '@/theme.scss', '/src/routes/local.css']);
  });

  it('ignores a stylesheet imported as a value and anything that is not a stylesheet', () => {
    expect(styleImportsOf("import styles from './a.module.css';\nimport './polyfill.js';", 'src/routes/+layout.svelte')).toEqual([]);
  });

  it('keeps a package stylesheet as it is', () => {
    expect(styleImportsOf("import 'leaflet/dist/leaflet.css';", 'src/routes/+layout.svelte')).toEqual(['leaflet/dist/leaflet.css']);
  });

  it('is empty for code with no imports', () => {
    expect(styleImportsOf('const a = 1', 'src/app/layout.tsx')).toEqual([]);
  });
});
