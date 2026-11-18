# Build lanes start when the canvas mounts

`frameBuilder` spawned a worker per lane on the first build. Each new worker then fetched the
1.5 MB `frame-build.worker` module (420 KB br). In local mode, where the page talks to one server
over six HTTP/1.1 connections, those fetches queued behind posters, fonts and pictures: on the
36-page stress canvas the four script requests went out at 1.3–1.9 s and landed at 5.2–5.8 s, and
every first build waited for them (first frame built ~0.3 s after the script arrived).

`frameBuilder.warm()` now spawns every lane, and `CoreFrames` calls it right after creating the
builder. With it the script lands at ~1.6–1.8 s. Considered: a document `<link rel=preload>` for
the worker chunk — a module worker request does not reuse a script preload, and warming at mount
already starts it before the picture flood.
