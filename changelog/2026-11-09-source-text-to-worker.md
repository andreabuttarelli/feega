# Frame source crosses to the build worker as JSON text

Posting the parsed FrameDoc made the main thread structured-clone the whole
doc graph (~0.23 s self at CPU 4x on the landings fixture). It now posts
`JSON.stringify(source)` and the worker parses it: stringify plus a string
clone is about a quarter of the object clone, and the parse runs off the
main thread. Discarded: keeping the server's raw bytes per frame (the
batch is one JSON body; splitting it would change the route format).
