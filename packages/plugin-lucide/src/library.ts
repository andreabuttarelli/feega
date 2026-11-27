import { Framework } from '@feega/plugin-api/protocol';
import { libraryIn, type Library, type Wrap } from '@feega/plugin-icon-kit/library';
import { ICON_DIR, pascalOf } from '@feega/plugin-icon-kit/svg-component';

const file = (componentName: string, extension: string) => `${ICON_DIR}/${componentName}.${extension}`;

const react: Wrap = (iconName, componentName, env) => ({
  file: file(componentName, env.typescript ? 'tsx' : 'jsx'),
  source: `export { ${pascalOf(iconName)} as default } from 'lucide-react';\n`
});

const svelteFrom = (packageName: string): Wrap => (iconName, componentName, env) => ({
  file: file(componentName, 'svelte'),
  source: env.svelte5
    ? `<script>\n  import Icon from '${packageName}/icons/${iconName}';\n\n  let props = $props();\n</script>\n\n<Icon {...props} />\n`
    : `<script>\n  import Icon from '${packageName}/icons/${iconName}';\n</script>\n\n<Icon {...$$props} />\n`
});

const vue: Wrap = (iconName, componentName) => ({
  file: file(componentName, 'vue'),
  source: `<script setup>\nimport { ${pascalOf(iconName)} } from 'lucide-vue-next';\n</script>\n\n<template>\n  <${pascalOf(iconName)} />\n</template>\n`
});

const LIBRARIES: Record<string, Library> = {
  'lucide-react': { framework: Framework.React, wrap: react },
  'lucide-svelte': { framework: Framework.Svelte, wrap: svelteFrom('lucide-svelte') },
  '@lucide/svelte': { framework: Framework.Svelte, wrap: svelteFrom('@lucide/svelte') },
  'lucide-vue-next': { framework: Framework.Vue, wrap: vue }
};

export const libraryFor = (framework: Framework, packages: Record<string, string>): Library | null => libraryIn(LIBRARIES, framework, packages);
