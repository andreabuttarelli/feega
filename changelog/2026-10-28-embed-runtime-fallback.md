# Runtime chunks from another build still load

`/motion-runtime/<chunk>.<hash>.js` served only the hash of the build answering. The hash is of
`motionEngine.toString()`, which differs between the minified browser bundle and the server
bundle, and between any two releases. Stored embed pages and frames composed in the browser
(`/e` player, canvas motion nodes) asked for a hash the server did not have: 404, ORB-blocked,
`__feegaMotion` undefined, nothing played.

Now an exact hash is served immutable; a known chunk name with another hash gets this build's
chunk with a 5-minute cache. Rejected: hashing the source at build time (still breaks every
stored embed on the next engine change).
