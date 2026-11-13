# Views menu moved into Preferences

The eye button on the right of the canvas top bar is gone. Its view toggles and zoom commands
now sit in the main menu (left), inside the Preferences submenu, rendered from the same
`VIEW_ITEMS` / `ZOOM_ITEMS` lists, so state and shortcuts are unchanged.

- `ViewMenu.svelte` deleted; `CanvasMenu.svelte` renders the lists.
- The separate Rulers row in Preferences (`PREFERENCE_ITEMS`) is removed: `VIEW_ITEMS` already
  holds Rulers on the same state, so keeping both would show it twice.
- Test ids `view-<view>` and `zoom-<command>` are kept; `view-menu` (the trigger) is gone.
- The entry shimmer mounts the real top bar, so it follows without changes.
- web-docs pages that named the eye button updated.
