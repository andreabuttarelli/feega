---
title: Live frames
description: Show pages of your running dev server on the canvas, hot-reloading as you save.
---

In local Feega, a **live frame** shows a route of your project's dev server. Save a file on disk and the frame updates.

## The dev server

When a canvas opens, Feega looks for a dev server already running for the [live checkout](#the-live-checkout) of the folder that holds the `.feega` file: it probes the common ports (3000, 3001, 5173, 5174, 4321, 4200, 8080, 8000) and keeps one only if its process works inside that folder. If none answers, it runs the project's `dev` script (pnpm, yarn, bun or npm, from the lockfile), restarts it up to three times if it crashes, and stops it when Feega closes.

| Variable | Use |
|---|---|
| `FEEGA_DEV_DIR` | Folder of the app, when it is not the one holding the `.feega` file |
| `FEEGA_DEV_COMMAND` | Command to run instead of the `dev` script |
| `FEEGA_DEV_URL` | Address of a dev server to use as is |
| `FEEGA_LIVE_DIR` | Where the live checkouts are kept, instead of `~/.feega/live` |

From a terminal or an agent:

```bash
feega dev-server            # status: state, url, detected or started, recent logs
feega dev-server start
feega dev-server stop
```

The MCP tool is `dev_server` (`action`: `status`, `start`, `stop`). The endpoint is `GET` / `POST /api/v1/local/dev-server`.

## Adding one

**Insert → Add live frame**. Type a path or pick one of the routes already imported from code, then a width: desktop 1440, tablet 768 or mobile 390.

## Live or snapshot

At most three live frames run at once: the largest on screen. The others, and all of them while the camera moves, show their last snapshot. A snapshot is taken when the page loads and when the camera rests, and is saved in the `.feega` file with the frame's route and width.

Reopened without a dev server, each frame shows its snapshot marked **Not connected**.

## The live checkout

Feega never writes to your working copy. In a git repository it checks the branch `feega/live` out in a second folder, `~/.feega/live/<repo>-<id>`, and runs the dev server there. The branch starts at your current commit, so work you have not committed is not in the live frames. The checkout gets its own copy of `node_modules` (copy-on-write where the disk supports it) and links to your `.env` files. A folder that is not a git repository is served as it is.

## Editing an element

Select a live frame by its label, then click an element inside it. A frame that is not selected stays a normal page you can scroll and use.

The element opens in the **Properties** tab of the right bar, the same panel and controls as any element on the canvas. These are written to your code:

| In Properties | Written as |
|---|---|
| Content | the text between the tags, or the message it comes from |
| Text colour, Fill | `text-…`, `bg-…` (theme token when it matches) |
| Size, Weight | `text-…`, `font-…` |
| Font | `font-['Family']` |
| Leading, Tracking | `leading-[…]`, `tracking-[…]` |
| Align, Case, Italic, Underline/Strikethrough, Truncate | `text-left/center/right`, `uppercase`…, `italic`, `underline`/`line-through`, `truncate`/`line-clamp-N` |
| X, Y | `translate-x-[…px]`, `translate-y-[…px]` (offset from where the element is) |
| W, H | `w-[…px]`, `h-[…px]` |
| Rotation, Flip | `rotate-[…deg]`, `-scale-x-100`/`-scale-y-100` |
| Opacity, Blend mode, Hide | `opacity-[…]`, `mix-blend-…`, `hidden` |
| Auto layout direction, alignment, gap, padding | `flex-row`/`flex-col`, `items-…`, `justify-…`, `gap-…`, `p-…`/`px-…`/`py-…` |
| Corner radius | `rounded-…` |
| Shadow and other effects | `shadow-[…]`, or an arbitrary property `[property:value]` |

Setting a control back to where it started puts the element's original class back. A control with no CSS equivalent (constraints, keyframes) changes nothing in the code and says so.

A value that matches a token of your theme is written as that token (`text-primary`, `p-6`, `rounded-card`); any other value is written exactly (`text-[#2563eb]`, `py-[16px]`). Only the one class or text changes: the rest of the class list is left as it was.

With responsive classes (`text-2xl sm:text-3xl lg:text-4xl`) the class that applies at the frame's width is the one changed, so a desktop frame edits `lg:` and a mobile frame edits the base class.

The change shows at once, then the dev server hot-reloads the file. Each edit is one commit on `feega/live`; **Cmd/Ctrl+Z** writes the previous value back. The selected frame shows how many files changed, and **Push** sends them to a `feega/` branch.

An element without a source position is read-only: run [`feega init`](/integrations/source-map/) in the app and restart the dev server.

From a terminal or an agent:

```bash
feega live-edit src/routes/+page.svelte:12:3 color "#2563eb"
feega live-edit src/routes/+page.svelte:12:3 padding 24px --side y --viewport 1440
feega live-edit src/routes/+page.svelte:12:3 text "Ship today" --was "Ship faster"
feega live-edit src/routes/+page.svelte:12:3 fill --token primary
feega live-undo <sha>
feega live-changes
feega live-push
```

The position is the element's `data-feega-src`. The MCP tool is `live_edit` (`action`: `edit`, `undo`, `changes`, `push`). The endpoints are `GET` / `POST /api/v1/local/live-edit` and `POST /api/v1/local/live-edit/push`.

### Limits

- State and theme variants (`hover:bg-…`, `dark:…`) and custom breakpoints are not edited.
- Margin is not in Properties; set it with `feega live-edit … margin`.
- `feega live-edit` takes the theme-backed properties; the other controls are canvas only for now.
- A class list that is not a plain string (`class={cn(...)}`) is not written; the edit is refused with the reason.
- Local Feega only.

