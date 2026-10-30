# 0025 — Instances resolve their main at read time

## Status

Accepted, 2026-10-29.

## Context

A main component lives in one frame doc (`motion_revisions`). An instance in another frame or
canvas held a copy of the main's comp, so edits never reached it. Instances record the main's
frame in `component.home`.

## Decision

Resolution at read. Every server read of a frame head (`headOrNew`, `motionSource`, editor
session) replaces comps homed elsewhere with the home frame's current main; overrides stay on
the instance clip. The stored copy is the fallback: kept when the home is not known, detached
(overrides baked) when the home frame or the main is gone, kept when following would make a
main contain itself.

Realtime is kept with a stamp, not a doc write: a frame's node data lists `mainHomes`; when a
frame's mains change (content signature), dependents get `data.linked[home] = signature`, one
small `nodes` patch through `patchNodeData` (version-checked, retried). Clients key frame
fetches on revision + `linked`.

## Consequences

- One extra head read per foreign home on reads of frames holding instances; none otherwise.
- No new revisions on dependent frames, no version conflicts with open editors, no migration.
- A frame open in an edit session shows the new main after reopening.

## Rejected

Propagation on write: fanning out new `motion_revisions` to every dependent frame multiplies
writes on big projects and races open editors on `version`.
