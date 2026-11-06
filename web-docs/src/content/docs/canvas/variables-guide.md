---
title: Variables guide
description: Build a light and dark theme for a landing page card with variables and modes.
sidebar:
  order: 6
---

A step-by-step walkthrough. You will theme one landing page card for light and dark. For the short reference, see [Styles and variables](/canvas/styles-and-variables/).

## What you build

A hero card with a page background, a button and a headline. One collection, `Theme`, drives all of it. Switching the frame to Dark restyles every bound field. Editing one value updates every frame that uses it.

## 1. Create a collection and variables

1. Select the frame itself, not a layer. Its properties open on the right.
2. Open **Frame settings**, then the **Variables** section.
3. In the collection field type `Theme`.
4. Type a variable name, pick a type, click **Add variable**. Repeat:

| Name | Type | Used for |
|---|---|---|
| `surface` | colour | page background, button label |
| `ink` | colour | button, headline |
| `radius` | number | button corners |
| `headline` | string | headline text |

Names use letters, digits, spaces, `-` or `_`, up to 40 characters. A collection holds up to 64 variables, a project up to 8 collections.

A new collection has one mode, `Default`. New variables start at `#000000`, `0`, empty text or off.

## 2. Add a Dark mode

1. In the collection, type `Dark` in **New mode** and click **Add mode**.
2. The new mode copies the values of the first mode. A collection holds up to 8 modes.
3. Every variable now lists one value per mode. Edit each one:
   - Colour: click the swatch and set the colour.
   - Number: type the value.
   - Text: type the text.

Example values:

| Variable | Default | Dark |
|---|---|---|
| `surface` | `#f6f1ea` | `#14110e` |
| `ink` | `#1d1a16` | `#f6f1ea` |
| `radius` | `0` | `24` |
| `headline` | `Mornings, made slower.` | `Evenings, made slower.` |

## 3. Use an alias

An alias makes a variable follow another one. Example: `button/bg` points to `brand/primary`, so changing `brand/primary` moves both.

The panel shows aliases (`→ brand/primary`) but cannot create them. Create one with the `variable` agent tool, see [Agents and CLI](#agents-and-cli).

Rules:

- An alias points to a variable of the same type.
- Loops are refused.
- You cannot remove a variable that another one aliases.

## 4. Bind fields

Every colour, number, text and on/off field in Properties has a diamond chip. A bound field becomes a pill with the variable name and value.

1. Select the page background. Click the diamond beside **Fill**, pick `Theme/surface`.
2. Select the button. Bind **Fill** to `Theme/ink`, **Radius** to `Theme/radius`.
3. Select the headline. Bind its colour to `Theme/ink` and its text to `Theme/headline`.
4. Select the button label. Bind its colour to `Theme/surface`.

Notes:

- The list shows only variables of the field's type.
- Radius is bindable on rectangles. The value is in pixels.
- A bound fill replaces the fill stack of that layer.
- The cross on the pill unbinds. The field keeps its current value.

## 5. Switch the mode

1. Select the frame, open **Frame settings**, **Variables**.
2. Use the mode menu of `Theme`: pick `Dark`.
3. Every bound field follows. Pick `Default` to go back.

Each frame keeps its own mode. Put one frame in Dark and another in Default to compare them side by side.

## 6. Edit a value, everything follows

- Click the pill name on a bound colour field. Change the colour. Every layer bound to it, in every frame of the project, updates.
- Or change the value in the Variables section.

The collection belongs to the project. A frame that has not used it yet shows it as **Use here**: click to bring it into that frame. Binding a field does the same on its own.

## Agents and CLI

Agents use the `variable` tool, the same steps as the panel. Aliases are only possible here.

```json
{ "tool": "variable", "input": { "action": "define", "collection": "Theme", "name": "surface", "type": "colour", "modes": ["Default", "Dark"], "values": { "Default": "#f6f1ea", "Dark": "#14110e" } } }
{ "tool": "variable", "input": { "action": "define", "collection": "Brand", "name": "primary", "type": "colour", "values": { "Default": "#e8a35c" } } }
{ "tool": "variable", "input": { "action": "define", "collection": "Button", "name": "bg", "type": "colour", "values": { "Default": { "alias": "Brand/primary" } } } }
{ "tool": "variable", "input": { "action": "add_mode", "collection": "Theme", "mode": "Dark" } }
{ "tool": "variable", "input": { "action": "mode", "collection": "Theme", "mode": "Dark" } }
{ "tool": "bind_variable", "input": { "clip_id": "cta", "target": "fill", "variable": "Theme/ink" } }
{ "tool": "bind_variable", "input": { "clip_id": "cta", "target": "radius", "variable": "Theme/radius" } }
{ "tool": "unbind_variable", "input": { "clip_id": "cta", "target": "fill" } }
```

Actions of `variable`: `define`, `mode`, `add_mode`, `bind`, `unbind`, `remove`, `list`. `define` needs a value for every mode. `define` with `modes` replaces the list, the first is the default.

From the CLI, through the motion tool runner:

```bash
feega motion tool <nodeId> variable --input '{"action":"mode","collection":"Theme","mode":"Dark"}'
feega motion tool <nodeId> bind_variable --input '{"clip_id":"cta","target":"fill","variable":"Theme/ink"}'
```

See the [edit ops](/reference/generated/edit-ops/) for every tool.
