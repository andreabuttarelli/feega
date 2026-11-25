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
- Keyboard: see [Shortcuts](#shortcuts).

## Selecting several elements

- In Layers, `Shift+click` selects every visible row between the last clicked row and this one. `⌘+click` (`Ctrl+click` on Windows and Linux) adds or removes one row.
- In the preview, `Shift+click` or `⌘+click` adds or removes an element.
- Every selected element is outlined. The last one clicked is the primary: it shows the label, feeds the breadcrumb and the source badge.
- The Properties panel shows "N elements selected" with Duplicate, Wrap, Unwrap, Delete and Copy for agent. Styles are edited one element at a time.
- Right-click on a selected element acts on the whole selection. Right-click on another element selects just that one first.

Delete, duplicate, wrap and unwrap apply to all selected elements as one change: one undo restores everything, across files.

- Wrap puts the selection in one container only when the elements are adjacent siblings of the same parent in one file. Otherwise nothing is written and the reason is shown.
- Elements that cannot be edited, such as items rendered by a loop without a resolvable array, are skipped. The rest are changed and the notice says how many and why.

## Shortcuts

Use `Ctrl` instead of `⌘` on Windows and Linux. Shortcuts are ignored while you type in a field or editable text.

| Action | Key |
|---|---|
| Delete | `Delete` or `⌫` |
| Duplicate | `⌘D` |
| Wrap in a container | `⌘G` |
| Unwrap | `⇧⌘G` |
| Select all siblings | `⌘A` |
| Copy for agent (all selected, one block) | `⌘C` |
| Select the parent, which also ends a multi-selection | `Esc` |
| Select the first child | `Enter` |
| Select the parent | `Shift+Enter` |
| Next sibling | `Tab` |
| Previous sibling | `Shift+Tab` |

## Preview size

The device bar sets the preview to full, desktop, tablet or phone. The default is a setting: [`feegaInspect.defaultSize`](/more/settings/).

## Open in editor

From Changes, open the source at the line of the edit. In `npx feega` this uses `code -g`, else `$VISUAL` or `$EDITOR`, else prints the path.

## The floating toolbar

The bar at the bottom of the preview holds the Design and Navigate switch and undo and redo. Drag its handle to move it; it snaps to six spots in the preview, or use the arrow keys on the handle.

Drag it mostly past any edge of the preview to tuck it away. A small tab with a chevron stays on that edge, where the bar left. Click the tab, or focus it and press Enter or Space, and the bar slides back. Feega remembers this per workspace.

Notices over the preview, such as "Saved to", have a close button.
