# Imported pages are read at the full 1280 / 768 / 390 px

The audit found imported frames 1265 px wide and breakpoints at 753 and 375: the hosted browser
(Browserless, Linux) draws a classic 15 px scrollbar that takes layout width, so
`document.documentElement.clientWidth` was the viewport minus 15. Local runs never saw it because
puppeteer launches with `--hide-scrollbars`.

- `fenced` sends `Emulation.setScrollbarsHidden` on every tab, so the page lays out at the
  viewport width whatever the host's scrollbars, including pages that style
  `::-webkit-scrollbar` themselves.
- Doc density was already one doc px per CSS px since ADR 0033 (`DOC_PX_PER_CANVAS_PX = 1`); the
  2530 px frames and 128 px type of the audit were the 2× drawn frames before it. A test now holds
  it for a page taller than one 16 384 px slice.
- Tests: `scrollbar-width.browser.test.ts` (launches without `--hide-scrollbars` to reproduce the
  hosted browser), `url-doc.test.ts`.
