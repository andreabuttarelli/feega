# Assets panel: assets only, compact header

Components have their own rail panel (`ProjectComponentsPanel`), so `ComponentsList` no longer
renders above the assets in `CanvasLeftPanel.svelte`; it stays inside the Components panel.
The panel header now uses the same compact `section-head` as Pages/Layers instead of the large
title; same row tokens and radius scale. Guarded by `assets-panel.test.ts`.
