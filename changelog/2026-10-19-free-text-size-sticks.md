# A free text keeps the Size typed in Properties

Halving Size on a free text (auto height) was undone within a second. Chain, traced with logs in
`canvas-free-text.spec.ts` "the Size field…":

1. the smaller text measures half its box → `fitHost` shrinks the node 300×100 → 300×50 and
   `keepTextSize` doubles the relative `size` so the pixels stay halved (correct);
2. the editor still held the old doc (600×200) for a moment and reported the same share (0.5)
   again; `fitHost` applied it to the already-shrunk node → 300×25, and a revision written after
   the editor closed had no poster;
3. the page effect that grows a node to its open doc's aspect ran on that stale doc and stored
   300×100: original pixel size back.

Fixes: a share now carries the stage it was measured on, and `hostFit` ignores it when the node
no longer has that shape, or when it would change nothing; the doc→node height effect only runs
for nodes whose height follows the doc (`heightFollowsDoc`: presets; custom frames and free
elements are sized by the node, as `frameResize` already said). Each fix alone still failed the
spec; together 10/10. Discarded: dropping overlay measurements whose doc changed in flight (not
the cause), tagging measure replies with the iframe aspect (the stale share had the right aspect).

Test drift fixed in the same PR: `right-bar-persists` phone case and `poster-text-kept` still
used the "Open editor" pill and the click-selects-inner-element gesture removed by #814;
`canvas-free-text` looked for "Box width" (now "Resizing", #785), asserted the relative `size`
(meaningless once the stage resizes; now the shown pixel size) and carried debug lines.
`canvas-poster-parts.spec.ts` :39/:115 fail on dev for the same #814 reason; not touched here.
