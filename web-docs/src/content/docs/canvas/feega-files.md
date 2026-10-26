---
title: .feega files
description: Move a canvas between workspaces as a single file.
sidebar:
  order: 11
---

A `.feega` file holds a whole canvas: its nodes, connections and the documents of free elements.

- **Export.** Canvas menu, **Download .feega**.
- **Import.** Drag a `.feega` file onto the home page, or use **Import .feega** in the sidebar. The canvas lands as a new one in your project.
- **CLI.** `feega canvas save <canvasId>` writes the file, `feega canvas import <file>` creates a canvas from it.
- **MCP.** The `canvas_file` tool exports and imports too, but only on a local server: it reads and writes files on your disk.
