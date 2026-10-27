---
title: Loops
description: Run many generations of one node in a single go.
sidebar:
  order: 3
---

A loop runs one generation per combination of the values wired into a node.

## Set an axis

An axis is a **list** node wired into a generating node. Click the wire to set its mode: **fixed** (same value every run) or **iterate** (one run per list item). Only an iterate wire from a list counts as an axis.

## Fill a list

Drop images on it, type one line per item, or **wire nodes** into its input: each linked image or text node adds its latest result after the hand-written items and stays current when the node regenerates. A linked node with no result yet waits and does not count as a run. Remove the wire to remove the item.

## Combine axes

With several iterate axes the default is the **cartesian** product: every value of the first axis crossed with every value of the second. In **zip** mode axes pair by index and the shortest wins. A node with no axes uses **repeat N**: N variants of the same prompt.

## Safety limits

Above 50 combinations the loop asks for confirmation. Above 1000 it refuses: split the work.

## Results

A loop produces a list node with one item per combination. Regenerate any item alone without redoing the loop. The **Loop** button appears only when an axis has at least two values and shows the count (for example "x12").

## Pick a result

The **select** node takes a list and pins one item by index, to carry only the chosen result downstream.
