# Editor scrub and playback probe

`tests/e2e/editor-scrub-budget.spec.ts` (`E2E_PERF=1`) mounts the split-headline template in a
real `hyperframes-player` and measures rAF both in the host and inside the iframe (a probe script
appended to the srcdoc), for scrub via `player.seek` + exact seek, each alone, and playback.

Chromium (1x and 4x CPU): 60/60 fps everywhere, iframe JS per frame p95 1.5-2.4 ms. Dropping the
double seek saves under 1 ms: not worth a change. WebKit: host 60, iframe 30 fps in every mode:
the cross-origin iframe throttle (see LESSONS.md). Frame cache, throttled prop updates and a
compositor playhead were not built: none addresses a 30 fps cap set by the browser.
