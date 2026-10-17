# Menus above the editor on the canvas

The editor mounted on the canvas sits at `z-index: 60`; shell menus (`MENU_CONTENT`, portaled to
`body`) were `z-50`. Every header menu in Properties — Fill +, Effects + — opened underneath
the panel, and a real click on an item hit the section body instead. Users saw "+ does nothing",
most visibly on a shape with no fill left.

`MENU_CONTENT` is now `z-[70]`. `canvas-fills.spec.ts` had hidden it with
`dispatchEvent('click')`; it now clicks for real. New `canvas-empty-fills.spec.ts`: free box,
remove every fill and stroke, add them back, reload.
