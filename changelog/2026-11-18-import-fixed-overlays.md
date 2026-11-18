# Imported pages keep fixed overlays as they look at the top

Importing `landing/` drew the footer's canvas chrome (a `position: fixed`
layer faded in by a scroll timeline tied to the footer) over the hero.

`revealPage` finished every non-looping animation, scroll-driven ones
included, and the still pass pinned each sampled element at its most
visible state. Both are right for blocks that reveal as they scroll in;
for a layer inside a fixed box they jump it to its end state — the one
the visitor only sees at the bottom of the page.

Now animations on a non-document timeline whose target sits in a fixed
box are left alone, and fixed elements are not pinned. Test:
`page-still.browser.test.ts` › a fixed overlay driven by scrolling to the
footer.

Not fixed here: NaN in Layout for a footer text (not reproduced on a
fresh import) and the changelog page, which is ~65k px tall and so reads
as a thin column when zoomed to fit.
