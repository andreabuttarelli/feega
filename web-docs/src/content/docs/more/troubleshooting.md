---
title: Troubleshooting
description: Fixes for the common problems.
sidebar:
  order: 3
---

## The dev server is not found or does not start

Set [`feegaInspect.devCommand`](/more/settings/) to the command you use, such as `npm run dev`. With several apps in one folder, pass the app folder: `npx feega ./apps/web`.

## The port is taken

`npx feega --port 5180` sets the editor port. The dev server port comes from your own config.

## The page reloads on every edit

Feega keeps its layout and history outside your project, so they do not trigger reloads. If an older version left a `.feega/` folder in your app, add it to your ignore file, so Tailwind and the dev server stop scanning it.

## Layers is empty

It fills in after the first update from the app. Interact with the page or make an edit.

## An edit is refused

Feega refuses what it cannot write safely: text from data, class names built by an expression. The message points at the source line.

## Clicking selects nothing on Next.js

Update the extension, or run `npx feega@latest`.

## Still stuck

Open an issue: [github.com/andreabuttarelli/feega/issues](https://github.com/andreabuttarelli/feega/issues).
