# Core canvas: cache textures only while zooming, vectors at rest

Reported: at some zoom levels frames, texts and generate cards looked like soft bitmaps. Cause:
every held group that fit the cache budget was drawn from a cache texture, also at rest. A
texture built for an earlier zoom is accepted within 20 % of the wanted scale and, after a zoom,
is re-rastered a few groups per frame, so for a while (long with many cards) the old soft texture
stays on screen.

Now `uses` carry `cache: true` only while the zoom is moving (`zooming`, same 150 ms quiet window
as the gesture watch); at rest `uncached` drops the flag and the refine draws every group straight
from its vectors at the current zoom × DPR. A pan does not toggle the flag, so a pan still sends
only the camera. Cache bytes, the retained screen and the rough zoom-out raster are unchanged;
`coreDebug` gesture-end lines now include `caching=`.

Not changed: held textures for a node under a resize (`heldWhileEdited`, a gesture by definition)
and the rough pass (the sharp refine follows it within a frame or two).
