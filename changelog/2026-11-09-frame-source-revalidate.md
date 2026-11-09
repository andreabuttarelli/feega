# Frame sources revalidate instead of downloading again

`frameSources` fetched each frame's source with `cache: 'no-store'`: every canvas open downloaded
every frame again (0.7–3.6 MB each on the landings fixture). The source route now answers with an
ETag over the body and `private, no-cache`; the client asks with `cache: 'no-cache'`, so a reopen
gets a 304 and the browser's copy.

Not `immutable` by revision: the body also carries brand tokens, which change without a new frame
revision, and the route serves the head whatever `revision` the URL names.

On the local benchmark the gain is within noise (localhost transfer is cheap; parse and build
still run). The saving is the download on a real network.
