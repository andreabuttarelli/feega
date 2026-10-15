# A still with a clip off screen at its frame is blocked

Demo-quality run: a 4:5 Instagram still came out as "LIME." on black. The doc had a lime split, speed lines, a sneaker and "BLACK.", but the shape clips ran frames 0–90 and the still was pinned at frame 90, one past their end. The agent could not view its frames and delivered blind; nothing in the gate looked at the still frame.

- `docProblems` adds `Quality.HiddenInStill` (blocking) for a still doc: every top-level clip that does not cover `still.frame` is named, with the move (move the still or stretch the clip).
- Precomp children are not checked: their visibility follows the parent clip, which is.

Discarded: refusing `set_canvas still` when a clip misses the frame — clips are often added after the still is pinned, so the check belongs to the gate that runs on the finished doc.
