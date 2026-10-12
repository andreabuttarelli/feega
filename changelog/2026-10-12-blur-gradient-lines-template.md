# Blur gradient lines template

Built-in `builtin:blur-gradient-lines`: lavender-to-peach gradient, four white hairlines drawn in
from the centre, one picture (or a radial blob without media) heavily blurred and drifting on a
closed path, and a centred thin line typed letter by letter with a glow on the newest letters.
The typed part stays centred: the line glides as it grows. Loop: lines retract and the text fades
at the end, the drift is periodic.

Decisions: CSS only; blur is the reference's subject, so it stays. Typing progress is a quintic
smoothstep so the centring glide starts and stops at zero speed.
