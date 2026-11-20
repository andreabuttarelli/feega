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
