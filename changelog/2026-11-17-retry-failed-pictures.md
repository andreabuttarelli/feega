# Failed pictures are retried at rest and logged

`media.ready` cached a failed picture's rejected promise in `images`, so a picture that failed once
(fetch error, HTTP status, decode error) never loaded again for the session. `failed()` now drops
it from `images`/`loaded`, records the reason (`failure(src)`: the fetch error, e.g. `image 503
<src>`, over the `Image.decode` fallback's), and `showStaged` asks again at rest after 1, 4 and 15 s
(`RETRY_MS`, each wait also waits for the gesture to end). Every failure is logged once per frame:
`[canvas] picture not loaded <frame> <src> <reason>`.

A frame still missing pictures is presented as `<key>:missing<n>`: a fuller version later is a new
group, so the core puts it (the same name would have kept the old list on the core).

stress36 panned at zoom 0.12 while loading, 1 in 40 asset requests aborted: dev 1361 block cells at
rest; with retries 0 visible at that zoom, 28 failures logged. Without injected failures nothing
fails locally (0 failed requests on dev and branch).
