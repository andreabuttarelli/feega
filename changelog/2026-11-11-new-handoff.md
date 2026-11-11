# /new reads the landing handoff

`?prompt=&kind=&source=&attach=1` from the feega.app hero preselects the composer
(`src/lib/home/handoff.ts`). Without `attach` it saves the draft and continues to login at
once; with it, it waits for the images to be attached again. A signed-in visitor with a
handoff is no longer bounced to /app, which would drop the prompt. `source` is parsed but
not acted on until the sources wiring lands.
