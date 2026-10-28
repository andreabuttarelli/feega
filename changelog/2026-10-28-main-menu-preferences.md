# Main menu: Preferences, Theme, menu overflow

- Burger menu (`CanvasMenu.svelte`): View group replaced by a
  Preferences submenu built from `PREFERENCE_ITEMS` (`main-menu.ts`);
  shortcut label read from `SHORTCUTS`. Only Rulers is there: pixel
  grid, outlines, dev mode and guides are per-frame state inside
  `GpuFlow` and have no global store to bind to.
- Theme: the inline segmented switch inside a menu row (not a menu
  item, unreachable by keyboard) became a radio submenu. Persistence
  moved to `chooseTheme` (`theme-choice.ts`), shared with `ThemeSwitch`.
- Context menus: `placeMenu` (pure, tested) shifts a menu inside the
  viewport, else caps its height. `FloatingMenu.svelte` adds hover
  chevrons that auto-scroll, and arrow-key focus that scrolls into view.
  Only `CanvasContextMenu` uses it so far; the Bits UI dropdown has its
  own collision handling.
