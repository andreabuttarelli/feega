# Scorecard: no video on WebKit

WebKit scorecard runs read ~1 s frames and ~1 s input→paint on every step. Cause: Playwright's
WebKit `recordVideo` screencast drops rAF to ~1 fps, reproduced on `about:blank` (390 ms mean,
1020 ms max) and gone without video (17 ms). Not an app regression, not window throttling.

WebKit runs now skip video (`recordsVideo` in `fluidity-report.ts`); Chromium keeps it. After the
fix, WebKit gpu/session frame p95 is 18–34 ms on editor steps.

Discarded: disabling background throttling (window was visible and focused throughout).
