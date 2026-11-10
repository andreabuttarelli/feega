# Load bench: a build's query keeps its value

`BENCH_BUILDS="off=.?coreTiles=0"` split the entry on every `=`, so the query became `?coreTiles`
with no value and the page read it as tiles on. Every "tiles off" load run so far measured the
tiled hybrid. The entry is now split on the first `=` only.
