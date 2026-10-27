# CI cancels superseded runs

With many agent PRs merging into `dev`, every push queued a full CI run and the
queue reached ~90 runs: the dev→main release never got a finished `test`. CI and
Native apps now keep one run per branch or PR (`concurrency`, cancel-in-progress);
a newer push cancels the older run.
