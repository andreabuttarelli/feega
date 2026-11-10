# Frame sources asked with the page data

On the user's canvas the first source was asked 2.6 s after the page was ready: the ask lived in CoreFrames, which waits for the renderer chunk and its mount. `+page.ts` now warms every saved frame's source as soon as the page data lands, on-screen first from the saved viewport (`openingSources`). The URL comes from `frameSourceUrl`, the same function CoreFrames reads with, so the canvas finds them held and never asks twice.
