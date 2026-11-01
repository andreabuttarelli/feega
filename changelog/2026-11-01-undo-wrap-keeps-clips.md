# Undoing a wrap in a stack keeps the wrapped element

Shift+A on a shape in a frame, then ⌘Z: the stack went away and took the shape with it, on dev
and production (found in the release QA sweep; the row was saved without it).

Undo replays `diffDoc(after, before)` on the present doc once a save has replaced it. Wrapping
puts the shape on the stack's own track, so the reverse diff removes that track and moves the
shape back. `diffDoc` emitted `TrackRemove` before the clip ops: the track left with the shape
still in it, and the `ClipMove` found nothing to move. Removed tracks now come after the clip
ops; additions and moves stay first, so clips always have a track to land in.
