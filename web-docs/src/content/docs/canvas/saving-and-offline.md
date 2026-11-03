---
title: Saving and offline
description: Every edit saves in the background, survives a closed tab and waits out a lost connection.
sidebar:
  order: 11
---

You never press save. Each change shows on the canvas at once and is sent in the background.

## The status in the top bar

| Status | Meaning |
|---|---|
| **Saved** | Everything you did is on the server. |
| **Saving…** | Some changes are on their way. |
| **Retrying…** | The server did not answer; Feega tries again with growing pauses. |
| **Offline — N changes waiting** | No connection. Your changes are kept and sent when you are back. |

The count covers every kind of change: moves and resizes, shapes you draw, the contents of an
element or frame (fill, text, anything inside it), lines between nodes, and undo or redo.

## Offline

Keep working. Shapes you draw stay on the canvas, and edits to their fill or text are kept.
When the connection returns, Feega sends everything in the order you made it.

## Closing the tab mid-save

Unsent changes are also kept in your browser. If you close or reload the tab before they
land, the browser asks you to confirm; open the canvas again and Feega sends what was left.
Sending a change twice is harmless: the server recognises a shape it already created.

## When a change is refused

A change the server refuses (the node was deleted, or the change is invalid) is not retried.
The canvas shows a short notice and puts the element back as the server has it.
