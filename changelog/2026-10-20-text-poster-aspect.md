# Snapshots keep their aspect; selection follows typing

- The GPU card built from a snapshot stretched it to the card size. A resized
  node (text fitted to its words) drew the old snapshot non-uniformly: blurry
  and wide. It is now letterboxed (`containedIn`) until a new snapshot exists.
- While typing in place the selection box stayed at the size before the first
  key. The overlay remeasures on each input.
- Text inside a frame was checked with the same typing repro: the fitted box
  already matched the words, no change needed; the spec stays as a guard.
