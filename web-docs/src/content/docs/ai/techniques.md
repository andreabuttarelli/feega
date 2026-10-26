---
title: Techniques
description: Save a flow once, run it on one input or a whole list.
sidebar:
  order: 3
---

A technique is a connected group of generation nodes saved under a name. Its open inputs become slots (text, document or image), its last nodes the outputs.

## Run it on a list

Select a technique node, then **Run on a list…** in the menu.

1. Paste one row per line, or a CSV (commas or tabs), or load a CSV file. Up to 50 rows.
2. Map columns to the technique inputs. By default the columns fill the inputs in order. An image input takes an image URL.
3. **See the cost** shows the credits for all rows before anything starts.
4. **Start** writes one output group per row on the *Technique runs* canvas and queues them. Progress shows done and failed rows; **Stop the rest** cancels the rows not started yet.

Agents use the canvas ops `preview_technique_rows`, `run_technique_rows`, `technique_rows_progress` and `cancel_technique_rows`.

## Prompt guidance

The agents also read prompt-writing guides bundled in `src/lib/agent-docs/how/` (`WRITE-IMAGE-PROMPTS.md`, `WRITE-VIDEO-PROMPTS.md`). The MCP tool `enhance_prompt` improves a prompt before generating.
