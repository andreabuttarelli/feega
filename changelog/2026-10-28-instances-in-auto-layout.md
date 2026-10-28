# Instances and wrapped text in auto layout

The Ledgerline landing (codegen fixture) imported into a canvas frame drew
every component instance off by its own position, and left huge gaps.

- **Instances moved twice** in the HTML renderer (`view snapshot`, exports):
  an instance's children are nested inside the instance group, and also
  received the instance's transform as parent copies. The chain of a clip now
  stops at its nearest Precomp host (`outsideGroup` in `compose.ts`).
- **Fill-width text measured at its drawn width**: a hug-height text set to
  fill was measured against its stale box (often 100 px), wrapping into dozens
  of lines. Layout items now carry `heightAt(width)`; stacks pass the known
  cross size to fill children, and hugging rows measure children at their
  grown width.
- **Instance size from the unlaid component**: instance bounds now come from
  the laid-out component, so a hugging card is as tall as its content.
- Fixture: text-only components get a hug root frame (top-level text in a
  component is never laid out), the task row is drawn at the list width, the
  headline is a plain Text (Title fits itself to a box), page height 4480.

Known gap: hug text width still uses the 0.5 em average advance, so tight
pairs ("New" + badge copy, price + period) can touch.
