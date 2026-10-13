# Path cards motion template (draft)

Hand-made template: a curved path draws itself across a light frame, its dot pausing at each stop while a place card (photo, name, address, rating) and a review card (initial avatar, stars, text) pop up; the camera follows, far cards blur slightly.

- Path is a Catmull-Rom through alternating stops, sampled to arc length; dot and camera move stop to stop with pure in-out expo, holds between.
- Lays out along the long side: horizontal in 16:9/1:1, vertical in 9:16.
- Avatars are initials, not faces: sample media has no people.
- A slow linear push keeps holds from being static frames.
- Step 1 only: one 16:9 test render, no library preview yet.
