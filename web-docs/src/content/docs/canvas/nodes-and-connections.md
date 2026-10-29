---
title: Nodes and connections
description: Add nodes, wire them, and what flows through a wire.
sidebar:
  order: 14
---

## Add a node

From the bottom bar: text, image, video, product or list. Each entry has a number; the same number on the keyboard adds that type without opening the menu. Dragging a file from the asset library, or a colour or product from the brand panel, creates a node already filled.

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
