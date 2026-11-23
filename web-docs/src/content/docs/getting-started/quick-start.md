---
title: Quick start
description: Your first edit with Feega, from opening the app to the diff in your source.
sidebar:
  order: 3
---

1. Open your project folder in your editor.
2. Open the command palette and run **Feega: Open from current workspace**. Or right-click a folder or a page file in the Explorer and choose **Design this folder with Feega** or **Design this page with Feega**. Or run `npx feega` in the app folder.
3. Feega starts your dev server and opens the app beside your code. The first time, a short onboarding explains Design and Navigate modes and sign in, then offers an optional checklist to support the project: star the repository, follow on X, join the Discord, buy a coffee, share Feega. Skip it freely; it stays under **Support Feega** in the Feega menu. Feega cannot verify these, so each item is ticked when you click it, and the ticks and the karma count stay on your device.
4. In **Design** mode, click an element. Its properties open in the right bar.
5. Change something: a colour, a padding, a font size. Double-click text to edit it in place.
6. Open **Changes** to see the edit as a diff in your source. Undo it, or keep it.

Check that your framework is in [Supported frameworks](/frameworks/supported-frameworks/). Astro and Nuxt need Feega to start the dev server.

Use **Navigate** mode (key `N`) to click through your app. Switch back to **Design** (key `D`) to edit.

Pick the preview width with the device bar: full, desktop, tablet or phone. At a smaller width in a Tailwind project, the edit goes to the class that applies at that width.

Next: [selecting and navigating](/editing/selecting-and-navigating/).
