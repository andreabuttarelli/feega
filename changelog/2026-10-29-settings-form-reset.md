# Settings forms with a field named reset

`/settings/spend` threw `t.reset is not a function` after saving a cap. The `reset` select
shadows `HTMLFormElement.reset` (named form access), so `form.reset()` hit the select.
`enhance.ts` now resets through `resetForm`, which calls the prototype method.

Not fixed here: `data.models[...]`, `.find`, `optIn` reads on spend, fonts, danger, api-keys.
They are one page component (models, spend, content) rendering with the next page's data.
