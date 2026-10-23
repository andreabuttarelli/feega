# New layers pin to left and top

`addClip` now writes `constraints: left/top` when the caller gives none, as Figma's default Left/Top
(MIN). Draw tools and the agent already passed `TOP_LEFT_START`; paste, templates and every other
add path got no constraint, which behaves like Scale. Documents saved before are not rewritten:
a clip without `constraints` still reads and behaves as Scale. The type grid poster fixture was
regenerated.
