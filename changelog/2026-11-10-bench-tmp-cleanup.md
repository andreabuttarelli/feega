# Load bench removes its fixture copies

Each load-bench run copied the landings fixture into `$TMPDIR/feega-load-*` and never removed it; ~22 GB leaked and filled the disk. `fixtureCopy` (`scripts/perf/fixture-copy.mjs`) now returns a `dispose`, called in the run's `finally` and when the server fails to start.
