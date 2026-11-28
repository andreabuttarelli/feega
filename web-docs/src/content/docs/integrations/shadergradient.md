---
title: ShaderGradient
description: Edit ShaderGradient props from the Properties bar. Community plugin, not affiliated with ShaderGradient.
sidebar:
  order: 6
---

Edit ShaderGradient props from the Properties bar. Community plugin, not affiliated with
ShaderGradient. It is built in, on by default, and listed under **Plugins** in the Feega menu.
[ShaderGradient](https://github.com/ruucm/shadergradient) is an MIT-licensed React library; its
package is `@shadergradient/react`.

## Edit a gradient

Select the element that holds a `<ShaderGradient>` (the section or wrapper around it). The
**ShaderGradient** section in **Properties** shows:

- **Type**: plane, sphere or waterPlane.
- **Colour 1**, **Colour 2**, **Colour 3**: colour fields.
- **Animate** and **Grain**: switches, written as `"on"` and `"off"`.
- **Speed**, **Strength**, **Density**, **Frequency**, **Brightness**: sliders.
- **Light**: 3d or env.
- **Camera azimuth**, **polar**, **distance**, **zoom** and **Rotation X**, **Y**, **Z**.

Each change writes the prop on the tag: strings as `color1="#1a73e8"`, numbers as
`uSpeed={0.8}`. A prop that comes from an expression (`uSpeed={speed}`) is left out of the list
and named in a note: edit it in code. Edits show in **Changes** and **Undo** reverts them in one
step. If the element holds several gradients, the first one is edited.

## Insert a gradient

**+ Add**, then **ShaderGradient**. One undoable step:

- adds the packages that are missing to `package.json`: `@shadergradient/react`,
  `@react-three/fiber` and `three`, on the line that matches your React (React 18: fiber
  `^8.17.10`; React 19: fiber `^9.0.0`; three `^0.169.0` for both). Anything you already have is
  left alone. React 17 or older is refused;
- writes `src/feega/ShaderGradientBackground` (`.tsx`, or `.jsx` in a JavaScript project), a
  component that fills its parent;
- imports it and places it in the selected element, with the props as attributes, ready to edit.

Feega then asks whether to run the install, and shows the exact command for your package manager,
taken from your lockfile (npm, pnpm, yarn or bun). Nothing is installed until you say yes. If the
install fails, Feega shows the last line of its output and your files stay as the edit left them.
Lockfiles are written by your package manager only.

The parent needs `position: relative` (or any positioned box) for the gradient to fill it.

## Frameworks

| Project | What happens |
|---|---|
| React (Vite), React Router | Works. |
| Next.js | Works. The component starts with `'use client'`, so it can sit in a server component. |
| Astro | Works with the `@astrojs/react` integration. The component gets `client:only="react"`. Without the integration, Feega says to add it and changes nothing. |
| Vue, Nuxt | Not supported. The only official Vue build, `@shadergradient/vue`, is at 0.1.0 and uses other props. Feega says so and changes nothing. |
| Svelte, SvelteKit | Not supported. ShaderGradient has no Svelte build. Feega says so and changes nothing. |

## Safety

The plugin asks for `selection`, `source`, `project`, `edit.attributes`, `edit.insert` and
`edit.dependency`. It has no network access and no logo or code of ShaderGradient is bundled: the
library is installed in your project from npm.
