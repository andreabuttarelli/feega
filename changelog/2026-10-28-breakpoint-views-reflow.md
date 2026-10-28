# Breakpoint views reflow like the exported page

Tablet and Phone views of "Ledgerline — landing" were broken on the canvas while the code export of the same doc was right. Overrides were fine (31 Phone + 13 Tablet, checked on the live node). The canvas engine did not do what CSS does:

- a hidden clip still took its slot in auto layout, and its children kept stale boxes (drawn at the view's top-left);
- a hugging or fixed-width child wider than its column (headline, lede, fine print) never shrank to the column (`max-width: 100%` in CSS);
- a Fill instance (feature card, tier, task row) drew its component at the width it was drawn on desktop;
- the view kept the desktop frame height, so the taller reflowed page was cut.

Now:
- `layout/auto-layout.ts` `fitted`: in a vertical flow a child wider than the column is measured at the column width; text reflows (`heightAt` for every hug-height text).
- `layout/resolve.ts`: hidden children take no slot; `withFittedInstances` makes a width variant of a component whose instance is laid out at another width; `withContentHeight` grows a doc to its hug-height root, keeping pixels.
- `breakpoints/view.ts` `resolveView` = hidden subtrees + fitted instances + content height over `resolveAt`; the canvas views (`breakpoint-views.ts`, `GpuFlow.svelte`) use it, and a view box is as tall as its page.

Discarded: changing `resolveAt` itself (codegen reads it, and CSS already reflows); growing the base frame (the user sized it).
