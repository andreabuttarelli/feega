# URL import: only the layers that matter

Imported pages kept every DOM wrapper: `div > span > stack > text`,
`icon > icon > path`, same-name parents and children, tag names
(`div`, `span`, `stack`, `path`) as layer names. `page-flatten.ts` runs
after stacks and component marking, before the plan, with two rule
tables:

- child rules: `empty` (no paint and no children, or zero size; only
  outside a stack or when absolute — in a stack it holds space),
  `unwrap` (bare wrapper, one child, same box; text only outside a
  stack), `lift` (bare wrapper in an absolute parent), `grow` (bare
  wrapper around a bare frame: the frame takes the box, padding absorbs
  the offset);
- parent rules: `hoist` (frame or instance with one same-box bare frame
  takes its layout and children), `fold` (stack whose only flowing
  child is a bare wrapper of one layer: padding folds into the stack,
  the button holds its label), `merge` (same-direction bare stack, same
  gap and cross alignment).

"Bare" = no visible fill, stroke or effect (a 0 px blur counts as
none), opacity 1, no transform, no clipping, not a component or
section. Instances of one component must keep the same shape or the
override link to the main breaks: groups that diverge after flattening
are put back as they were. Names: role table (nav → Nav, a → Link,
svg → Icon), else content (single text, small all-vector → Icon), else
Row/Column; a child never repeats its parent's name. `token-bind` CTA
detection accepts `Link`.

Discarded, each dropped fidelity: unwrapping a text inside a stack (the
wrapper's fixed box isolates font-metric drift; vercel full .962 →
.952); widening a lone text to its wrapper with alignment (text
vanished); merging same-paint sibling vectors (`geometryOf` joins paths
into one blob, per-path winding is lost); unwrapping clipping wrappers
whose grandchildren overflow.

Result on capture d11 (layers / max depth, fold/full SSIM):
vercel 648/16 → 420/13, .9936/.9616 → .9934/.9616;
linear 1054/27 → 983/24, .9894/.9728 → .9894/.9722;
stripe 1960/21 → 1819/19, .9835/.9283 → .9835/.9274.
