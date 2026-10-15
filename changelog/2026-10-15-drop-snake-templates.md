# Perspective card stack and Poster deck fan removed

The user rejected both, in their deck form (#603) and as card snakes (#618). Removed: the two
template folders, `snake-chain.ts`, their catalogue cards, preview sample media, tests and the
e2e expectation. The public changelog now announces only the three kept templates; the public
"Card snakes" entry is gone.

Frames that already inserted one keep working: `insertTemplate` copies the component code into
the doc (`doc.components`), so rendering never reads the built-in list. A test holds that for
the kept templates. The template id stays in the copy's mark but no longer resolves in the
library, like any custom template.
