# Hairline rules and bleeding shapes

In a real chat run `add_shape` refused a 4 px grid rule ("width Too small: expected >=0.02" — the
input is px, the floor is the stored fraction shared by every `layout()`) and a 1200 px block on a
1080 frame. The agent dropped the grid.

- `Shape` overrides `width`/`height`: from `HAIRLINE` (0.0002 of the frame, under 1 px at 4K) to
  `BLEED_REACH` (two frames). Other components keep the shared layout range.
- Tested through the tool in 16:9, 9:16 and 4:5.
