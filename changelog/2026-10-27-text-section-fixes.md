# Text section: size as typed, weight in hundreds, case icons, advanced axes

**Before.** A fixed-box Text was shrunk by 5% steps until it fit, so raising Size past the box
did nothing visible. Weight scrubbed by 1. Case showed text labels ("Small caps" wrapped).
Width, slant and other axes sat beside Weight and Size.

**Now.** `Text` is drawn at the size set (`painter.ts` `fits: () => false`; the HTML export no
longer emits `data-fit` for it). Title, Kicker and Caption still shrink to their box. Inspector
weight is 100-900 in steps of 100 (`weight-steps.ts`); stored values from the agent are untouched.
Case options are icons with the name in the tooltip. Width, slant and other axes live behind a
collapsed Advanced row. The agent prompt now says Text is not shrunk.

**Discarded.** A "fit" toggle for Text: nothing asked for it. The Rust shrink loop stays for
the components that set `fits`, so gpu-core is unchanged; only the parity fixture moved.
