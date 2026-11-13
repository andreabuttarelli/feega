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

**100 credits = €1.** Prices next to Generate are shown in euros; balances and costs in credits.

Every new account gets **100 free credits (€1)** once, at signup. A second organisation does not get them again.

### Plan and top-ups

- **Plan**: €9 per editor per month; each editor brings 500 credits a month into the team's shared balance.
- **Editors and viewers**: owners, admins and members are editors and need a seat; viewers are free and unlimited. A free team has one editor, its owner. Agents (the chat, MCP, CLI, API keys) never take a seat: they act for a person.
- **Adding an editor** on a paid team adds €9/month when the invite is accepted, prorated for the rest of the period, and grants the prorated credits at once. Only the owner can add a paid editor; admins can invite viewers. While a payment is past due, no editor can be added.
- **Removing an editor** lowers the bill from the next renewal; the seat stays paid until then, so re-adding someone in the same period costs nothing more. Credits already granted stay.
- **Agent edits on a free team**: agents (the canvas chat, the motion chat, MCP, the CLI and API keys) can create or change up to **1,000 layers a week**, counted over the last seven days. At the cap an agent gets a `402 agent_edit_cap` answer with `used`, `limit`, `resets_at` and `upgrade_path`; the chat, the CLI and MCP show it in words. Your own edits and every read are never capped, and neither is work a person launched in the app (loops, workflows, studio batches, compose): those already cost credits. The same runs started with an API key count. A batch is checked as a whole before it runs, and a frame batch counts every op in it. Two requests sent at the same moment can each pass and together go slightly over the cap. Paid teams have no cap. The Credits page shows this week's count.
- **Cancelling**: when the plan ends, every editor except the owner becomes a viewer. They keep their access, and the owner can make them editors again once the team pays. A payment that is late never demotes anyone; a plan that stays unpaid after the retries turns editors other than the owner into viewers, and the owner can make them editors again once it is paid.
- **Top-ups**: €10 for 1,000 credits, €20 for 2,000, €50 for 5,000. One-time.
- **Credits never expire.** Unspent monthly credits carry over; top-ups stay until spent.

Subscribe, manage the plan and buy top-ups on the **Credits** page. From the CLI: `feega upgrade <slug>` for the plan, `feega upgrade <slug> --top-up 1000` for a top-up.

The canvas chat agent runs on Claude Opus 5.5, and every turn spends credits. When the balance runs out, the chat stops before spending and shows the upgrade screen.

## Improve prompt

On image and video nodes, the **Improve prompt** switch rewrites the text with the chosen model's best practices before generating. The node's own prompt is unchanged. Off by default. When on, the price on Generate and Loop includes the rewrite.
