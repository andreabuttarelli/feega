# Layers: html root, Head group, body

The Layers tree used to list a Head group next to the body layers, with no way to select `html`.

- Root is now `html`: a collapsed Head group (code icon, count badge) with title, meta, link,
  script, style and base, then `body` with the page tree. `treeOf` (`packages/source-map/src/runtime.js`)
  builds it; `HTML_SOURCE` joins `PAGE_SOURCE` as a stable page source.
- Selecting `html` or `body` (tree, breadcrumb, Esc from the top level) edits page-wide rules through
  `page-rule.ts`, which already handled both targets.
- Role table (`roles.ts`): `Role.Page` and `Role.Head` carry no visibility or lock actions; the tree
  reads `actionsOf` instead of a tag list.
- A head element shows only its attributes (read-only). Editing them is a later step.
- Fixed: the Head group showed the repeat icon whenever it held more than one element.
