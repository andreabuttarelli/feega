# Always-visible timeline trim handles

Trim grips (`.grip` in `MotionTimeline.svelte`) were already mounted and draggable on every clip, but only drawn once the clip was selected, so trimming looked click-first. They now render a subtle accent line on both ends of every bar, full strength on hover or selection. Press-drag on an edge selects the clip and trims (existing `startClip`); the body still moves. Touch keeps select-first.
