# Wrap with stack makes a new parent, and Layers shows it

Defect: on a lone free Text, Wrap with stack (toolbar "…", right-click, Layers menu) produced an
element node still named "Text" whose root was the new Stack, and Layers showed one row "Text"
with the Stack icon and no child.

Three causes:

- The element's own clip is auto-picked, so the toolbar/menu ran `runFrameAction` inside the
  element doc (the "one free element wraps inside its own doc" choice of the first wrap PR). The
  wrap was right, the node kept its name. Now `stacksWholeElement` sends a wrap covering every
  root of a free element to the canvas path (`stackElements`), which creates a new node "Stack".
- Layers ignored `clip.parent`: children of a stack or group were listed flat, beside it.
  `trackRows` now lists clips under their parent (stack order from `childrenInOrder`).
- Free element nodes showed one row, never their insides, and `frameHead` gave no head to
  `type = 'element'` nodes, so their outlines were never fetched. An element whose doc has one
  root now lists that root's descendants under the node row.

Test: `canvas-stack-padding.spec.ts` "Wrap with stack on one free text…" (fails without the
`runFrameAction` routing), plus unit tests in `layers`, `frame-inspector`, `frame-outlines`,
`element-groups.route`.
