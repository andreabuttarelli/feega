# One failed picture no longer greys out a whole page

`showStaged` showed a frame never drawn before with vectors only (`<key>:vectors`, every picture a
`look.line` block), then waited on `media.ready`. When that came back `Partial` (any one picture
failed to fetch or decode) it returned without showing again, so the frame stayed on the
vectors-only list for good: every picture of the page grey, including the ones that had decoded.
On stress36 with 1 image in 40 failing (72 failures), 2388 block cells stayed on screen at rest.

Now a settled frame (`Stage.Settled`, whatever the readiness) is always shown again under its
whole key; `drawable` blocks only the pictures that are still missing. Same scenario: 114 block
cells, one per failed picture.
