# URL import: breakpoint views drawn from the narrow reads

The first cut (#1671) moved the desktop layers to the boxes the 768 and 390 px reads gave them.
It topped out at tablet fold 0.49-0.96 and phone 0.53-0.90 (capture `v4`): a narrow page words a
headline differently, swaps pictures (srcset), builds menus from other elements and runs longer
than the frame maximum, and none of that is a box.

## What changed

- Each narrow read is planned on its own at the base frame's units per pixel and merged into the
  base doc (`withViews`, `page-views.ts`; ADR 0022 amendment 2). A base clip and a view clip from
  the same element are one layer when they differ only in layout keys and their parents matched;
  the view's values become overrides and the layer leaves its flow at its captured box. The rest
  of the view comes in as view-only layers (`<view>:<id>`), slotted in the view's paint order.
- A view runs as tall as its read: `Breakpoint.height` may pass the frame maximum (stripe's phone
  page is 20 426 px). Lowering the frame's units per pixel instead blurred the desktop.
- Override keys gain letter spacing, font axes and a shape's outline (rounded boxes store their
  outline relative to their box).
- Each read brings up to 200 pictures (apple.com's phone photos were dropped at the cap).
- Only paragraphs that are their element's single run are joined into one wrapping text.
- With breakpoints the page is not split into section frames (a section cuts a block into pieces
  named after one element); components and interactive parts are kept on the desktop.
- Walker: characters go to the line they overlap most (72 px type on a 57.6 px line), hidden `<br>`
  is skipped, text lines cut by a horizontally scrolling box stay.
- Harnesses size views by the frame's pixels per unit, as the canvas does, and
  `URL_IMPORT_SHAPE=full` scores the product shape.

## Tried and dropped

- Units per pixel lowered to fit the tallest view (and to 0.5 steps so 390 and 768 divide evenly):
  stripe desktop full 0.981 → 0.962.
- Explicit-break texts set to never wrap: blog gained 0.004, apple lost 0.025.
- Sections on with views: stripe phone fold 0.98 → 0.88.

## Measured

Measured with the HTML still (SSIM fold/full against the page at that width; capture `v4`, supabase
and astro from `v6`; before = the first cut on the same capture):

| page | desktop | tablet before | tablet after | phone before | phone after |
|---|---|---|---|---|---|
| vercel | 0.99/0.96 → 0.99/0.96 | 0.67/0.89 | 0.92/0.93 | 0.69/0.85 | 0.98/0.94 |
| linear | 0.97/0.96 → 0.98/0.97 | 0.84/0.87 | 0.98/0.97 | 0.62/0.81 | 0.97/0.97 |
| stripe | 0.99/0.98 → 0.99/0.98 | 0.49/0.83 | 0.98/0.97 | 0.53/0.57 | 0.98/0.95 |
| apple | 0.99/0.97 → 0.99/0.97 | 0.94/0.71 | 0.99/0.97 | 0.62/0.58 | 0.98/0.96 |
| framer | 0.99/0.96 → 0.99/0.96 | 0.93/0.74 | 0.98/0.98 | 0.82/0.75 | 0.91/0.95 |
| webflow | 0.99/0.96 → 0.99/0.96 | 0.95/0.92 | 0.99/0.94 | 0.80/0.76 | 0.90/0.94 |
| tailwind | 0.95/0.95 → 0.95/0.95 | 0.94/0.95 | 0.97/0.97 | 0.90/0.91 | 0.97/0.95 |
| blog | 0.98/0.97 → 0.98/0.97 | 0.92/0.83 | 0.94/0.92 | 0.88/0.41 | 0.92/0.86 |
| feega | 0.96/0.95 → 0.96/0.95 | 0.84/0.86 | 0.96/0.98 | 0.70/0.58 | 0.82/0.91 |
| supabase | 0.94/0.94 → 0.94/0.94 | 0.90/0.84 | 0.92/0.93 | 0.70/0.78 | 0.79/0.86 |
| astro | 0.90/0.93 → 0.90/0.93 | 0.77/0.82 | 0.81/0.83 | 0.57/0.64 | 0.66/0.68 |

Below 0.95 the causes are the narrow page as the planner draws it at any width, not the merge: the
same reads planned alone as pages score alike (feega phone fold 0.84, framer phone 0.91, webflow
phone 0.90, blog phone 0.91/0.87). Fonts render a hair heavier and wider than the page (feega's
serif headline, supabase's Inter at weight 450), so lines wrap one word early (blog, framer);
blurs wider than the effect's cap come in brighter (vercel's card glow); scroll-revealed blocks
caught mid-fade in the screenshot (webflow); astro's desktop is below 0.95 too.
