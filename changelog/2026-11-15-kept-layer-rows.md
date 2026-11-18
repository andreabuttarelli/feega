# Layers panel: an edit re-renders only the rows it touched

`frameRows` built a new `LayerRow` object for every layer of the open frame on each edit, so the
panel's keyed list treated all of them as changed. `layerTree` now hands back the previous row
object when the clip is the same object and every row field is equal (`keptRow`, keyed per clip and
row key in a `WeakMap`, so edited or removed clips drop out with their clip).

Discarded in the same round: sending the frame worker `diffDoc` ops instead of the whole doc. The
landings edit bench showed no p50 change: the serialisation it removes runs on the quiet rebuild
after the patch, not on the measured input-to-pixel path.
