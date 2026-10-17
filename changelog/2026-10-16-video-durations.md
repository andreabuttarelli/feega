# Video duration snapped to the model's offered steps

Wan 2.6 failed with "Duration 13s is not supported. Supported durations: 5, 10s". The
node params had no `duration`; the server fell back to `DEFAULT_VIDEO_DURATION` (13) while
the toolbar showed the first offered step (10). Two causes:

- the sync dropped `/videos/models` `supported_durations`, so models without a static spec
  offered only the product floor `[10]`. Now stored as `param_schema.duration` (enum, same
  shape Kie.ai rows use) and read by `genericVideoChoice`.
- the run sent `params.duration` raw. Now snapped to the choice's `durationOptions`
  (missing: first option, the one the toolbar displays; off-step: nearest).

Takes effect for synced rows after the next `ai-models/sync`.
