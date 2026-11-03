# Enter on a layer row stays in the Layers panel

Browser check of the import audit fixes (vercel.com): Enter on the `Link` row selected its
`Deploy now` child, then the same keydown reached the canvas, whose Enter-to-type handler opened
that label for editing. `enterRow` now stops the event. Test in `layers-panel-keys.test.ts`.
