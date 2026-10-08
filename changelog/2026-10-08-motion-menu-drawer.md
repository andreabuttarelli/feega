# Motion editor: burger menu drawer

**Before.** The top bar carried the back arrow, the full composition breadcrumb, the
composition chip with its settings popover, the save state text, Template, and (in `⋯`)
Template again plus Keyboard & gestures. Crowded, and Template was duplicated.

**Now.** A `Menu` icon (`Tool.Menu` in the actions table, tooltip, guide row) at the far left
opens `MenuDrawer`: left sheet, full screen under 600px, modal, focus trapped, Esc closes and
returns focus. It holds back to canvas, breadcrumb, save state + version, composition
settings, Template, Keyboard & gestures. The bar keeps the menu button, the current comp name
and a round save dot (tone + `aria-label`). The top bar `⋯` keeps only Publish (narrow widths) and
Keyboard & gestures left the timeline `⋯` (now `Place.Drawer`): nothing is in two places. Transport stays centred: the 3-zone grid is unchanged.

**Discarded.** A keyboard shortcut for the menu: no free key that reads naturally.
