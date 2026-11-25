---
title: Selecting and navigating
description: Pick elements, walk the tree and switch between Design and Navigate.
sidebar:
  order: 1
---

## Design and Navigate

- **Design** (`D`): clicks select elements.
- **Navigate** (`N`): clicks use your app, so you can follow links and reach other pages and states.

## Selecting

- Click an element to select it. The selection maps to a file, line and column.
- The breadcrumb walks up to parents and across to siblings.
- Pick from the [Layers](/editing/layers/) tree.
- Keyboard: `Enter` selects the first child, `Shift+Enter` the parent, `Tab` the next sibling, `Shift+Tab` the previous one, `Escape` clears the selection.

## Preview size

The device bar sets the preview to full, desktop, tablet or phone. The default is a setting: [`feegaInspect.defaultSize`](/more/settings/).

## Open in editor

From Changes, open the source at the line of the edit. In `npx feega` this uses `code -g`, else `$VISUAL` or `$EDITOR`, else prints the path.

## The floating toolbar

The bar at the bottom of the preview holds the Design and Navigate switch and undo and redo. Drag its handle to move it; it snaps to six spots in the preview, or use the arrow keys on the handle.

Drag it mostly past any edge of the preview to tuck it away. A small tab with a chevron stays on that edge, where the bar left. Click the tab, or focus it and press Enter or Space, and the bar slides back. Feega remembers this per workspace.

Notices over the preview, such as "Saved to", have a close button.
