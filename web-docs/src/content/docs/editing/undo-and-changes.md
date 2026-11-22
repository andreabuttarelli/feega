---
title: Undo and changes
description: Review every edit as a diff, undo it, redo it, or revert it.
sidebar:
  order: 9
---

Each edit is a step. Undo and redo walk the steps. The **Changes** tab lists every edit with its file and line.

For each change you can select it in the page, open the source, show the diff, or **Revert** it. **Revert all** returns the files to how they were before your edits.

History is kept between sessions. Edits you make by hand in the same files are respected: undo does not overwrite them.

The editor layout and the history are stored outside your project, so they never trigger reloads of your dev server and never show up in your commits. With `npx feega`, settings live in `.feega/settings.json` in the app folder.
