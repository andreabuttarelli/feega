# CI build gets an 8 GB heap

The `test` job's Build step ran `vite build` with Node's default heap, about 4 GB on the
16 GB `ubuntu-24.04` runner. The module graph (5316 + 4732 modules across the two Vite
passes) now peaks right at that limit, so Build OOMed on unrelated PRs (#2360, #2353,
#2227) while siblings on the same `dev` passed. First OOM: run 44291419292
(feat/onboarding-flow); no single import to blame.

The step now sets `NODE_OPTIONS=--max-old-space-size=8192`, the ceiling `build:node`
already uses. Measured on the runner with `/usr/bin/time -v` (run 44319972532): peak RSS
6.9 GB, build 3:05.

Discarded: hunting one heavy import (modules grew <1% between the last green and the
first red build) and skipping the build.
