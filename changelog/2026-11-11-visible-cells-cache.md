# Perf: the spatial index remembers the last cell range it walked

`SpatialIndex.within` (behind `visible`) rebuilt a `Set` from every grid cell under the camera,
then sorted it, on every pan frame: ~130 ms of a 4 s landings pan, called from `CoreFrames`
(`standIndex`, `cardIndex`) and `sight`. A pan moves the camera a few pixels while the 1024-unit
cell range stays the same, so the sorted candidate list for the last range is kept and only the
exact overlap filter runs. A new index (scene change) starts empty.
