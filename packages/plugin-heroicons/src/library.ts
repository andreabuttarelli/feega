import { Framework } from '@feega/plugin-api/protocol';
import { libraryIn, type Library } from '@feega/plugin-icon-kit/library';
import { ICON_DIR, pascalOf } from '@feega/plugin-icon-kit/svg-component';
import { Style, LOOKS } from './icons';

const reactFrom = (style: Style) => (iconName: string, componentName: string, env: { typescript: boolean }) => ({
  file: `${ICON_DIR}/${componentName}.${env.typescript ? 'tsx' : 'jsx'}`,
  source: `export { ${pascalOf(iconName)}Icon as default } from '@heroicons/react/${LOOKS[style].directory}';\n`
});

const vueFrom = (style: Style) => (iconName: string, componentName: string) => ({
  file: `${ICON_DIR}/${componentName}.vue`,
  source: `<script setup>\nimport { ${pascalOf(iconName)}Icon } from '@heroicons/vue/${LOOKS[style].directory}';\n</script>\n\n<template>\n  <${pascalOf(iconName)}Icon />\n</template>\n`
});

const LIBRARIES = (style: Style): Record<string, Library> => ({
  '@heroicons/react': { framework: Framework.React, wrap: reactFrom(style) },
  '@heroicons/vue': { framework: Framework.Vue, wrap: vueFrom(style) }
});

export const libraryFor = (framework: Framework, packages: Record<string, string>, style: Style): Library | null => libraryIn(LIBRARIES(style), framework, packages);
