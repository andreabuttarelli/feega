# Shared canvas link froze on a blank page

`/s/[token]` mounts GpuFlow with no project, so `StyleLibrary`/`VariableLibrary` have no store.
Their `found()` then rebuilt the `$state` object on every call (`{ ...inDocs, ...this.styles }`),
and the GpuFlow effect that calls `found()` reads it: `effect_update_depth_exceeded`, nothing
rendered. Not RLS: same on the old and new app. Fix: without a store, write only names not
already known. Tests cover both libraries.

Still open: motion frames and elements render as `empty` on a share (only published frames have
a viewer at `/s/[token]/[frame]`), so a canvas made only of unpublished frames shows no content.
