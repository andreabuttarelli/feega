---
title: Pages canvas
description: See every page of your app at desktop, tablet and phone size on one canvas.
sidebar:
  order: 8
---

The Pages canvas shows all the pages of your app together. Each page is a group, labelled with its route, with the Desktop, Tablet and Phone sizes side by side. Groups flow left to right in route order and wrap into rows, so the whole canvas fits the window as large as possible. A page taller than three screens is cut there with a fade; open it to see all of it.

Open it with the **Open canvas** banner at the top of the Pages tab, or with the grid button in the toolbar. It opens as a view tab, in the tab row above the editor or, in Feega desktop, in the window's top bar as `project · Pages canvas`. Press `Esc` or switch to the Page tab to go back, and close the tab when you are done.

While the canvas tab is open, the Layers, Pages and Components bar, the toolbar and the Properties bar are hidden: the canvas fills the whole area and keeps only its zoom controls. They come back with the Page tab. The Components canvas works the same way.

## Move around

The canvas is the only place with zoom and pan. The editor itself stays at its fitted size.

| Action | How |
|---|---|
| Zoom | `Cmd`/`Ctrl` + scroll, trackpad pinch, `+` and `-` |
| Pan | Scroll or two-finger swipe, hold `Space` and drag, or middle-button drag |
| Zoom to fit | `0` or the fit button |
| Zoom to 100% | `Shift+0` |

## Select, use and resize a frame

Click a frame to select it: it gets an accent outline, handles on its corners and sides, and its name highlights. Click empty canvas or press `Esc` to deselect. With nothing selected, `Esc` closes the canvas.

The selected frame is live: it swaps its snapshot for the real page, so you can scroll and interact inside it. Scrolling over it moves the page, not the canvas. Only the selected frame is live. When you deselect it, it goes back to a snapshot, captured again.

Drag a corner or side handle to resize the frame. The page lays out again at the new width, and the frames around it move to make room. The bar at the bottom of the canvas shows the selected frame's size: pick a device preset, or type a width and a height. Sizes are kept while the canvas session lasts.

## Open a page

Double-click a frame, press `Enter` on the selected frame, or use **Open in editor** in the bottom bar to switch to the Page tab on that route at that size. The canvas tab stays open. Frames highlight on hover. A dynamic route such as `/blog/[slug]` renders its first example page, and its row is labelled with the pattern and the example. With no example yet, the frames show a field per parameter: type a value and press `Enter` to show that page. See [Layers](/editing/layers/) for where examples come from.

## Snapshots

Unselected frames show static snapshots, not live pages. Feega loads each page once at its real size, in the background and out of sight, and captures the whole page, up to 15,000 px tall. Frames are as tall as their page, and a row is as tall as its tallest frame. Two pages are captured at a time, the ones nearest the middle of the view first, at any zoom level.

Snapshots stay for the session. When you save a page file, that page is captured again; the old snapshot stays until the new one is ready. A page that cannot be captured keeps its route card, and the reason is logged in the webview console.
