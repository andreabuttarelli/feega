---
title: Plugins
description: Plugins ship with Feega Inspect, Mesh gradient, 3D object, Lucide icons, Brand logos, Gradient presets, Phosphor icons and Heroicons. Plugins run sandboxed and change your code only through the same edit engine as manual edits.
sidebar:
  order: 4
---

Plugins add controls to Feega Inspect. Seven are built in and on by default: **Mesh gradient**,
**3D object**, **Lucide icons**, **Brand logos**, **Gradient presets**, **Phosphor icons** and
**Heroicons**. You can also install third-party plugins or load one from a folder while you build
it: see [Write a plugin](/integrations/write-a-plugin/).

## Browse plugins

In the Feega menu (the logo, top left), **Plugins**, then **Browse plugins**, opens a full-panel
view of every plugin as a card: name, one-line description, an **Official** or **Community**
badge, and an **Enabled** switch. This works the same in the VS Code extension, `npx feega` and
the desktop app.

- Type in **Search plugins** to filter by name or description.
- Click a card for its details: a longer description, the permissions it asks for
  in words, and a **Docs** button.
- **Remove** appears on plugins you installed. Built-in plugins can be switched off, not removed.
- Type a source such as `github:owner/repo@tag` under the grid and press **Install**. Feega asks
  you to approve the permissions first. Where the host cannot ask, the view shows the terminal
  command instead: `npx feega plugin add`.

Plugin commands still appear under **Plugins** in the Feega menu.
A third built-in, [ShaderGradient (community)](/integrations/shadergradient/), edits ShaderGradient props.

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

- adds the `three` package to `package.json` (and `@types/three` in TypeScript projects). Feega
  then offers **Install now**, which runs your package manager (npm, pnpm, yarn or bun, from your
  lockfile). If the dev server restarts after that, Feega shows "Restarting dev server…" and
  reloads the preview by itself, keeping your scroll, selection and open panel;
- writes `src/feega/Scene3D` (`.svelte`, `.vue`, `.astro`, `.tsx` or `.jsx`, matching the file you
  add it to) and `src/feega/mount-scene.ts`, the three.js code;
- imports the component and places it in the selected element;
- for a model, copies the file to `public/feega/models/` (`static/` in SvelteKit apps);
- for 3D text, copies the bundled Inter Bold font and its OFL licence to `public/feega/fonts/`. No network needed.

Select the scene to edit it in **Properties**: **Material** (glass, metal, matte), **Lights**
(studio, soft, dramatic), **Auto-rotate**, **Mouse follow**, **Height** and **Colour**. These are written as
attributes on the component tag. Models keep their own materials.

The scene is 16:9 and fills the width until you set a **Height** (0 means automatic). The Svelte
component uses runes, so it needs Svelte 5.

## Lucide icons

Select an element. In **Properties**, the **Lucide icons** section has a search box and a grid of
icons. With nothing typed it shows common icons. Type a name or a word ("arrow", "cart", "weather")
to search the whole set. Click an icon, set the options, then press **Insert**.

- **Size** and **Stroke** set the icon's width, height and line weight.
- **Text colour** makes the icon follow the surrounding text colour. Turn it off to pick a **Colour**.

Insert is one undoable step. It places the icon next to the selected element, or inside it when it
is a container, and writes `src/feega/icons/<Name>Icon` (`.svelte`, `.vue`, `.astro`, `.tsx` or
`.jsx`, matching the file you add it to). Size, stroke and colour are written as props on the tag,
only when they differ from the defaults (24, 2, current colour).

- By default the icon file holds the SVG inline. Nothing is added to `package.json`.
- If the project already depends on `lucide-react`, `lucide-svelte`, `@lucide/svelte` or
  `lucide-vue-next`, the icon file re-exports that library's component instead, so the project keeps
  one icon implementation. The icon must exist in the installed version. Astro always uses inline SVG.
- The Svelte component uses runes in Svelte 5 projects and `export let` in Svelte 4.

The icons are [Lucide](https://lucide.dev), released under the ISC licence, Copyright Lucide
Contributors. Feega bundles only the list of icon names and search words. Each icon file is
downloaded when it first appears in the grid or is inserted, from jsDelivr
(`cdn.jsdelivr.net`, with `unpkg.com` as a fallback), at the exact `lucide-static` version the list
was built from. **The first use needs internet.** Icons already shown stay available for the
session; the others show "Icons need internet the first time." with a **Retry** button. The
plugin declares those two hosts as its network permission, and the downloads go through Feega, not
the panel.

## Brand logos

Select an element. In **Properties**, the **Brand logos** section works like Lucide icons: a search
box, a grid (common brands when nothing is typed), then **Insert**.

- **Size** sets the width and height.
- **Colour** is **Brand colour**, the brand's official hex, or **Text colour**, which follows the
  surrounding text.

Insert writes `src/feega/icons/<Name>Icon` with the downloaded SVG inline and a `<title>` with the brand name,
imports it and places it like the Lucide icons. Nothing is added to `package.json`. The colour is
written as a `color` prop on the tag only when it is the brand colour.

Feega bundles only the list of brand names and colours. Each logo file is downloaded when it first
appears in the grid or is inserted, from jsDelivr (`cdn.jsdelivr.net`, with `unpkg.com` as a
fallback), at the exact `simple-icons` version the list was built from. **The first use needs
internet**; logos already shown stay available for the session, the others show "Icons need
internet the first time." with a **Retry** button. The downloads go through Feega, not the panel.

The shapes come from [Simple Icons](https://simpleicons.org) (CC0). The logos themselves are
trademarks of their owners: follow each brand's guidelines when you use them. A few brands, such as
LinkedIn, Slack and Microsoft, are not in the set.

## Gradient presets

Select an element. In **Properties**, **Gradient presets** shows a gallery of 36 subtle gradients.
**Kind** filters the gallery to linear, radial or conic. Click a preset to apply it; **Remove
gradient** sets the background image back to `none`.

The preset is written as the element's background image through the same edit engine as a manual
style change: a `background-image` declaration in the element's stylesheet rule (Svelte and Vue
`<style>`, CSS modules for React) or its inline style when the file has no stylesheet. This is true
in Tailwind projects too. Each click is one undoable step.

## Phosphor icons

Works like Lucide icons: search box, grid, **Insert**. Search matches names and Phosphor's tags
("photography" finds the camera). Options:

- **Weight**: thin, light, regular, bold, fill or duotone. The grid redraws in the weight you pick.
- **Size** and **Text colour** or **Colour**.

Insert writes `src/feega/icons/<Name>Icon`. With inline SVG, every weight is its own file
(`CameraIcon`, `CameraBoldIcon`), so several weights of one icon can live together. If the project
depends on `@phosphor-icons/react` or `@phosphor-icons/vue`, the file re-exports (React) or wraps
(Vue) that library's component and the weight is written as a `weight` prop. `@phosphor-icons/web`
and Svelte or Astro files use inline SVG. Nothing is added to `package.json`.

Feega bundles only the list of icon names and tags. Each icon file, in the weight you pick, is
downloaded when it first appears in the grid or is inserted, from jsDelivr (`cdn.jsdelivr.net`,
with `unpkg.com` as a fallback), at the exact `@phosphor-icons/core` version the list was built
from. **The first use needs internet**; icons already shown stay available for the session, the
others show "Icons need internet the first time." with a **Retry** button. The downloads go through
Feega, not the panel.

Phosphor Icons are released under the MIT licence, Copyright Phosphor Icons.

## Heroicons

Works like Lucide icons: search box (by name), grid, **Insert**. Options:

- **Style**: Outline 24, Solid 24, Mini 20 or Micro 16. A few icons do not exist in Micro; they
  drop out of the grid when that style is chosen.
- **Size** and **Text colour** or **Colour**.

Insert writes `src/feega/icons/<Name>Icon` (`<Name>SolidIcon`, `<Name>MiniIcon`,
`<Name>MicroIcon` for the other styles). If the project depends on `@heroicons/react` or
`@heroicons/vue`, the file re-exports (React) or wraps (Vue) that library's component for the
chosen style and the size is written as `width` and `height`. Otherwise, and in Svelte and Astro
files, the SVG is inline. Nothing is added to `package.json`.

Feega bundles only the list of icon names and the styles each exists in. Each icon file, in the
style you pick, is downloaded when it first appears in the grid or is inserted, from jsDelivr
(`cdn.jsdelivr.net`, with `unpkg.com` as a fallback), at the exact `heroicons` version the list was
built from. **The first use needs internet**; icons already shown stay available for the session,
the others show "Icons need internet the first time." with a **Retry** button. The downloads go
through Feega, not the panel.

Heroicons are released under the MIT licence, Copyright Tailwind Labs, Inc.

## Safety

Plugins run in a sandboxed worker inside the editor panel. They have no file, shell or network
access of their own. A plugin can only:

- read the selection (tag, classes, computed styles, attributes) if its manifest asks for
  `selection`;
- propose edits (`edit.style`, `edit.attributes`, `edit.insert`, `edit.dependency`,
  `edit.asset`). A proposal with one operation the manifest does not allow is refused whole;
- ask for a file with the system dialog (`file.pick`);
- fetch from hosts it lists as `network:<host>` (neither built-in plugin does).

Third-party plugins run in the same sandbox, are marked **Not reviewed**, and are installed only
after you approve the permissions they ask for.

## Where plugins appear

A plugin declares contributions in `feega-plugin.json`: a **Properties** section, a preview
overlay, **Add** menu items (with a category), context menu items for Layers and the preview, a
top-bar button, a command (listed in the Feega menu) and a side panel (a tab beside Properties).
