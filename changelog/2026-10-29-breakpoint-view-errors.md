# Breakpoint view ids never reach the network

Breakpoint view tiles carry a synthetic id `<frameId>@bp:<bpId>`. CoreFrames
loaded every drawn frame by URL, views included, so a view entering the fill
order (when the canvas area or frame list changed, e.g. while using the
History panel) hit `/motion/<view id>/source` and the route passed it to a
uuid column: 500 `22P02`.

- `baseNodeId` / `withoutViews` in `breakpoint-views.ts`: the one mapping from
  tile id to node id. CoreFrames no longer URL-loads views (they derive from
  the base frame's live doc); `coreSource` and the History frame filter map
  through `baseNodeId`.
- The source route answers 400 for a non-uuid node id.
