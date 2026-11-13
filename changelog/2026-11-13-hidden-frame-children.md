# Hiding a frame hides its children

`withoutHidden` (`motion/organize.ts`, used by compose, precomp, outline, fast patch) dropped only
the hidden clip. Its children lost their parent and were drawn as loose layers. Breakpoint views
already hid the whole subtree through their own `withHiddenSubtrees`.

- `withHiddenSubtrees` moved to `organize.ts` (own commit, no behaviour change); breakpoint views
  import it. `withoutHidden` now applies it first, so there is one rule.
- Tests: `gpu-full/hidden-subtree.test.ts` (child, grandchild, only the child hidden).
- Fast patch: the `Parent` rule still declines hiding a parent, now because its children must go
  with it. It was not widened. Follow-up: a hidden parent could be patched by dropping its subtree.
