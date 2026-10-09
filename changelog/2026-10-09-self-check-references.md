# The self-check compares frames with the references

In the Pinterest run the agent described the pins accurately, then never described its own frames:
every fix came from the gate's text. The video matched the palette only.

- `viewedReferences` (`frames.ts`) takes the last `MAX_SELF_CHECK_REFS` (3) pictures returned by
  `REFERENCE_TOOLS` (`view_images`, `pinterest_*`, declared in `web-tools.ts`) this turn — never
  `view_frames` output.
- `checkMessage` builds the self-check or fix round: with references it attaches them as images and
  asks a one-line-per-frame diff (type scale, edge bleed, grid and rules, small-text columns, colour
  blocks); without, it is the old plain text. Cost: three low-detail images on one round.
- Discarded: a second model call to judge refs vs frames — the agent already holds both and is the
  one that must fix.
