# GPU canvas: cold load and live runs

- Cold load rasterises idle cards visible-first, nearest the centre, in idle slices; the last snapshot per node is kept in Cache Storage and shown on reopen.
- Cross-origin images that taint the capture are dropped and the capture retried.
- `snapshotKey` ignores run fields (`running`, `status`, `run_id`, `started_at`, `finished_at`, `cost_usd`): a run starting or ending no longer re-rasterises the card. The running state is a native Pixi outline in the overlay.
- Discarded: a Pixi text pill for "Running…" — one more texture per run for no extra information.
- Known gap: the running outline ignores node rotation.
