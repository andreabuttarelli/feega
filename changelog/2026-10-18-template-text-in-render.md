# Template text typed where it is drawn

Only posters built on the poster kit tagged their texts with data-part,
so every other library template could be edited only from the inspector.

- compose writes each layer's editable text props as data-texts.
- measure finds the innermost element whose text equals each value and
  tags it data-part, unless the template already tagged that field.
- The existing pick and in-place editing then work unchanged.

Discarded: tagging by hand in ~80 template views.

Guard: tests/e2e/template-text-in-render.spec.ts.
