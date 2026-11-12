# Top bar: static project name, roomier mark

The project switcher dropdown in the desktop top bar is gone. The name is plain text, smaller (`--ui-type-label`, medium, secondary ink); double-click renames it. Projects stay reachable from the mark's menu and the home.

The left pill now insets the feega mark 10px from its rounded end (`--topbar-mark-inset`), so the logo no longer touches the edge. Right padding stays 3px.

Mobile switcher and `switcher-list.ts` are untouched (the mobile sheet still uses them).
