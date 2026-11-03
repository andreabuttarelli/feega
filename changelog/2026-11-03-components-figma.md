# Components hold a design, mains edit mains

From the mobile and landing case studies (B1, B6, M1, M4, M16, landing B3/#14).

**Subtree (B1).** `createComponent` passed only the picked clips to `precompose`; the
children of a stack stayed in the frame, unparented, and the main was an empty shell.
`withSubtrees` adds every descendant first. `precompose` itself is unchanged (a plain
precomp of one clip keeps its old behaviour).

**Main vs instance (B6).** `mergeScope` turned every edit inside a component host into an
override on that host, mains included, so a main never changed and no instance followed.
`Hosted` now carries `here` (the frame node id, passed by GpuFlow, the inspector panel and
text typing); an outermost host whose role is Main edits the comp. Nested hosts stay
instances: a button inside a card main is overridden on the card, as in Figma.

**Set members (M1).** Placing and following a main copied only that comp, so pickers in
other frames saw one variant. `componentSlice` and `copied` take the whole set
(`withSet`); a member that arrives by following gets the home.

**Duplicate (M4).** `duplicateClip` appends at the clip's end (timeline semantics), so a
canvas ⌘D copy was off screen. `duplicateInPlace` copies at the same `from`, carries the
subtree with fresh ids (stack `order` remapped), and makes a new main (or a new variant in
a set) when the clip is a main here. Used by ⌘D and Alt-drag; `duplicate_clip` gains
`place: in_place` and keeps `after` as default.

**Layers (M16).** Rows inside a comp carried the inner id; they now carry `scene`
(`host__0__inner`), used to pick and to show the pick.

**Instance box.** Layer boxes of an instance were the frame box (its Precomp clip spans
the frame). `instanceBoxes` (motion-core) gives the content box; `propBoxes` uses it and the
inspector shows BoxFields for instances. W/H on an instance scale it.

**Go to main.** FocusMode.Pick centred at the current zoom: on a crowded Components page the
main was a few pixels and never got an inspector. `centreIn` zooms to at least 64 px.

Not in this change: B2 (adding children into a main), B5 (Change to in Play), M2, M3, M5,
M6, instance resize as a frame (W/H scale instead).
