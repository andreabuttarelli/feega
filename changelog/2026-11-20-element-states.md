# Element states in the editor bar

Edits only ever hit the default look. Properties now opens with a State dropdown (Default, Hover, Focus, Focus visible, Active, and Disabled on form controls). A dot marks a state that already has styles for the selected element; the list is read from the page's own stylesheets, so Tailwind `hover:` utilities (compiled to `:hover` rules) and authored CSS count alike.

Preview: the bridge clones the page's `:hover`/`:focus`/`:focus-visible`/`:active`/`:disabled` rules into one stylesheet (`#feega-forced`) with the pseudo-class replaced by `[data-feega-force~="state"]`, and sets that attribute on the element (hover and active also on its ancestors, as the browser does). Media and layer wrappers are kept, `(hover: hover)` is dropped so a touch-less webview still matches, and transitions are finished so the panel reads the end values. The sheet is rebuilt when the page's styles change, so a hot reload keeps the state.

Reading: the panel shows the computed values of the forced state; rows that differ from Default are tinted blue.

Writing: an edit in a state writes to that state. Tailwind gets the variant prefix and replaces conflicting utilities of the same variant only (`hover:bg-red-500` never touches `bg-white` or `focus:bg-...`). CSS modules, plain imported sheets and Svelte/Vue scoped blocks get `.cls:hover { ... }` next to the base rule, reusing it when present. Inline-style-only files refuse a state instead of writing it into the default. Reset removes only that state's token or declaration. One undo step per edit; previews made in a state apply only while it is forced.

Limits: states driven by JS (class toggles on click), `:has()`, `parent:hover` written as `group-hover:`/`peer-*` (they appear under the parent's hover, not the element's), and rules inside CSS nesting are not forced. Tailwind edits ignore the breakpoint while a state is on (`hover:` not `md:hover:`).
