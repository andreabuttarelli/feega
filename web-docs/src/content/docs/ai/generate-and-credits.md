---
title: Generate, history and credits
description: Model picker, Generate and Redo, history strip, retry, credits, Improve prompt.
sidebar:
  order: 4
---

## Model and Generate

Every node that produces text, image or video has a model picker listing only models for that medium. **Generate** stays off until a model is chosen and there is something to generate, written in the node or received from a linked text node. After the first run it becomes **Redo**; the previous version is kept.

## History

A strip under the node shows past successful generations. Failed runs leave no empty thumbnail. Clicking a thumbnail brings it back to the front without regenerating.

## Retry

A blocked or failed run shows **Retry**: same prompt, same model, new attempt.

## Credits

The organisation's credit balance is always visible at the top of the canvas; click it to open billing. Each generation spends credits by medium and model, and the balance updates after every run.

## Improve prompt

On image and video nodes, the **Improve prompt** switch rewrites the text with the chosen model's best practices before generating. The node's own prompt is unchanged. Off by default. When on, the price on Generate and Loop includes the rewrite.
