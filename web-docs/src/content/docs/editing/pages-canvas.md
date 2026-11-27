---
title: Pages canvas
description: See every page of your app at desktop, tablet and phone size on one canvas.
sidebar:
  order: 8
---

The Pages canvas shows all the pages of your app together. Each page is one row, labelled with its route, with the Desktop, Tablet and Phone sizes side by side.

Open it with **Open canvas** in the Pages tab, or with the grid button in the toolbar. Press `Esc` or choose **Editor** to go back.

## Move around

The canvas is the only place with zoom and pan. The editor itself stays at its fitted size.

| Action | How |
|---|---|
| Zoom | `Cmd`/`Ctrl` + scroll, trackpad pinch, `+` and `-` |
| Pan | Scroll or two-finger swipe, hold `Space` and drag, or middle-button drag |
| Zoom to fit | `0` or the fit button |
| Zoom to 100% | `Shift+0` |

## Open a page

Click a frame to return to the editor on that route at that size. Frames highlight on hover. A dynamic route such as `/blog/[slug]` renders its first example page, and its row is labelled with the pattern and the example. With no example yet, the frames show a field per parameter: type a value and press `Enter` to show that page. See [Layers](/editing/layers/) for where examples come from.

## Performance

Only the frames near the viewport run live, at most six at a time. The others show a snapshot taken after the page first loaded or when the frame left the view, so a snapshot can be slightly out of date until the frame is back on screen.
