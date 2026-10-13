# A video started from a media component no longer breaks the editor

A component with a `PropFormat.Media` prop (media cloud, photo strip, ...) starts with
the media list as empty text `''`, a value the prop schema accepts alongside an array
of media items. `FieldForm` assumed an array: `(f.value ?? []).some` threw on `''`
during SSR and the motion editor route returned the error page (prod, 13/10, node
`cfb450eb…`, `TypeError: (f.value ?? []).some is not a function`).

`FieldForm` now reads the list through one `mediaOf`, which treats any non-array as
empty. The stored doc is left as is: the schema allows the string, so the reader was
wrong, not the data. Test: `doc-fields-render.test.ts`.
