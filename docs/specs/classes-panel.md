# Classes panel

Global-class management for non-Tailwind CSS, in the spirit of Webflow and Elementor classes.

## Scope

In: plain CSS, CSS modules, scoped `<style>` of Vue, Svelte and Astro, `<style>` in HTML.
Out: SCSS, Sass and Less (no parser), CSS-in-JS, Tailwind utilities (a class counts only when a rule for it exists in project CSS).

Phase 1 index and panel. Phase 2 edit a class rule. Phase 3 (follow-up) duplicate merge and dedupe; this PR ships only the detection model.

## Data model

`ClassEntry`, one per class per scope:

- `name`, `scope` (`global`, `module`, `component`), `sheet` (file that owns the rules: the CSS file, the module, or the component file).
- `rules`: `{ file, line, selector, state, media, declarations, own }`. `own` is true when the selector is exactly `.name` plus an optional pseudo-class. Only own rules are edit targets.
- `uses`: `{ file, line, dynamic }`. `dynamic` marks a name found next to an expression (clsx with variables, template literals, ternaries): the class may apply elsewhere too.
- `home`: first own, state-free, media-free rule. The place an edit lands.

Scope resolution: a `.module.css` rule is `module`, reached only through a binding imported from it; a rule in a Vue (`scoped`), Svelte or Astro `<style>` is `component`, used only in that file; everything else is `global`.

Per-language behaviour (style blocks, markup attributes, scope) lives in one table each.

## Incremental update

The host keeps facts per file and re-reads only files whose mtime changed after a file-watch event.

## UI

Properties, for the selected element:

- Classes section: the element's classes that have rules, each with `14 elements · 6 files`. A `dynamic` badge when applicable.
- Click opens the class view: rules (file:line, declarations, media and state) and uses (click reveals in editor, select on page when it is the current page's element).
- Used in this file: classes the picked element's file uses.
- Edit target: `Edit .card` sets `Editing: .card (global)`. The property controls then write into the class rule.

## Phase 2 edit

`EditAsk.cls = { name, file }`. The writer replaces the declarations in the rule `.name` (plus state and media) in `file`, through the same rule writer the element path uses. Impact line: `.card in N elements, M files`. A class used in more than one element is held in the existing preview before it lands. The change shows in Changes and undoes.

## Limits

- Counts come from source, not the DOM: a loop counts once.
- Selectors with combinators (`.a .b`) are listed as context, not editable.
- Imports order and cascade between sheets are not resolved; an edit goes to `home`.
- Class names built only from variables are invisible.
