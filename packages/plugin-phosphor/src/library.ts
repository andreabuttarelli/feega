import { Framework } from '@feega/plugin-api/protocol';
import { libraryIn, type Library, type Wrap } from '@feega/plugin-icon-kit/library';
import { ICON_DIR, pascalOf } from '@feega/plugin-icon-kit/svg-component';

const react: Wrap = (iconName, componentName, env) => ({
  file: `${ICON_DIR}/${componentName}.${env.typescript ? 'tsx' : 'jsx'}`,
  source: `'use client';\n\nexport { ${pascalOf(iconName)} as default } from '@phosphor-icons/react';\n`
});

const vue: Wrap = (iconName, componentName) => ({
  file: `${ICON_DIR}/${componentName}.vue`,
  source: `<script setup>\nimport { Ph${pascalOf(iconName)} } from '@phosphor-icons/vue';\n</script>\n\n<template>\n  <Ph${pascalOf(iconName)} />\n</template>\n`
});

const LIBRARIES: Record<string, Library> = {
  '@phosphor-icons/react': { framework: Framework.React, wrap: react },
  '@phosphor-icons/vue': { framework: Framework.Vue, wrap: vue }
};

export const libraryFor = (framework: Framework, packages: Record<string, string>): Library | null => libraryIn(LIBRARIES, framework, packages);
