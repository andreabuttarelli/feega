---
title: Plugins
description: Two plugins ship with Feega Inspect, Mesh gradient and 3D object. Plugins run sandboxed and change your code only through the same edit engine as manual edits.
sidebar:
  order: 4
---

Plugins add controls to Feega Inspect. Two are built in and on by default: **Mesh gradient** and
**3D object**. Third-party plugins are not loadable yet.

Every plugin change goes through the same edit engine as a manual edit. It shows in **Changes**,
opens in the diff, and **Undo** reverts it in one step.

## Mesh gradient

Select an element. In **Properties**, the **Mesh gradient** section offers **Add mesh gradient**.

- Four colour points appear over the preview. Drag them to move them.
- Pick a point in the list, then change its **Colour**.
- **Softness** sets how far each colour spreads. **Base** sets the colour behind the points.
- **Add point**, **Remove point** and **Randomize**.

The result is plain CSS, stacked `radial-gradient` layers plus a `background-color`, written to the
element's stylesheet rule (Svelte and Vue `<style>`, CSS modules for React) or its inline style
when the file has no stylesheet. This is true in Tailwind projects too. If the element already has
a mesh gradient in this form, the section reads it back.

## 3D object

**+ Add**, then **3D object**: **Cube**, **Sphere**, **Torus knot**, **3D text** or **Model (.glb)…**.

One undoable step:

- adds the `three` package to `package.json` (and `@types/three` in TypeScript projects). Install
  dependencies afterwards;
- writes `src/feega/Scene3D` (`.svelte`, `.vue`, `.astro`, `.tsx` or `.jsx`, matching the file you
  add it to) and `src/feega/scene3d.ts`, the three.js code;
- imports the component and places it in the selected element;
- for a model, copies the file to `public/feega/models/` (`static/` in SvelteKit apps);
- for 3D text, downloads a font from `cdn.jsdelivr.net` into `public/feega/fonts/`.

Select the scene to edit it in **Properties**: **Material** (glass, metal, matte), **Lights**
(studio, soft, dramatic), **Auto-rotate**, **Mouse follow** and **Colour**. These are written as
attributes on the component tag. Models keep their own materials.

Svelte projects that force runes mode need the component rewritten by hand: it uses `export let`.

## Safety

Plugins run in a sandboxed worker inside the editor panel. They have no file, shell or network
access of their own. A plugin can only:

- read the selection (tag, classes, computed styles, attributes) if its manifest asks for
  `selection`;
- propose edits (`edit.style`, `edit.attributes`, `edit.insert`, `edit.dependency`,
  `edit.asset`). A proposal with one operation the manifest does not allow is refused whole;
- ask for a file with the system dialog (`file.pick`);
- fetch from hosts it lists as `network:<host>`.

## Where plugins appear

A plugin declares contributions in `feega-plugin.json`: a **Properties** section, a preview
overlay, **Add** menu items (with a category), context menu items for Layers and the preview, a
top-bar button, a command (listed in the Feega menu) and a side panel (a tab beside Properties).
