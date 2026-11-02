# States on nested instances in the player

Before: the player built state hotspots from top-level clips only, and each
hotspot was a sibling div with its own pointer handlers. A Button inside a
Card instance had no hotspot, and overlapping hotspots never bubbled.

Now:
- Hotspots come from the flattened doc (`flattenComps`), so a scoped id like
  `card__0__btn__0__pill` gets one.
- A nested pick is drawn as a path override on the top host
  (`nestedOverrides`, now taking the host's existing overrides as base): the
  main component and other instances stay untouched. State variants on a
  nested instance swap `comp` through the same override.
- Pointer handling lives on the player view: `statesUnder` takes the innermost
  spot under the pointer and its ancestors by `parent` chain, like CSS
  `:hover`.
- Exports already wrote the inner component's state rules; a test now holds it.
