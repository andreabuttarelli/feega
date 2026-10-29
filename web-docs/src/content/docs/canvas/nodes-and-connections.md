---
title: Nodes and connections
description: Add nodes, wire them, and what flows through a wire.
sidebar:
  order: 14
---

## Add a node

From **+** in the bottom bar. One menu holds everything you can add: drawing tools, Generate nodes (text, image, video, product, list and more), import (upload a file, Drive or Dropbox, Figma) and templates; with a frame selected it also offers Insert image and templates for that frame. On a phone the Insert sheet shows the same menu. Each node entry has a number; the same number on the keyboard adds that type without opening the menu, and an entry can be dragged onto the canvas to drop it at that spot. Dragging a file from the asset library, or a colour or product from the brand panel, creates a node already filled.

## What a wire carries

- **Text:** the generated text, or its prompt if it has not generated yet. Upstream text is the prompt of the downstream node when that has none of its own.
- **Doc:** the document content.
- **Linked image or video:** a visual reference by default, not an opening or closing frame.

## Ports depend on the model

A generating node has no fixed ports: they follow the chosen model. Changing model can open or close inputs, for example an audio port on a video model that accepts audio.

## Wire colours

Text blue, images green, video pink, audio orange, first frame purple, last frame light blue.

## First and last frame

A video node can have separate **first frame** and **last frame** ports. An image wired there gets that temporal role instead of being a generic reference.
