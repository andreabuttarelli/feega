# Five card motion templates

Framed reveal, Showcase scatter, Diagonal card cascade, Perspective card stack, Poster deck fan:
video templates from five references (stills; motion designed here).

- Same pipeline as the other custom templates: one deterministic component per template
  (`model` pure function of `t`, `view` DOM + CSS, transforms and opacity only per frame).
- Shared `soft-settle.ts`: `glide` = in-out expo to +1.4%, then a quintic settle back; no bounce.
- Every loop is phase-based on the clip length (cards cycle `count` times per loop), so any
  length and card count loops seamlessly; a test holds first frame = last frame for each.
- Fields: every text, a media list (each picture a slot), colours, count, timing. Numeric
  params are keyframable in Motion mode; the cards are not separate clips — a clip graph
  can't take count/speed as fields.
- A component prop named `move` collides with the Image Ken Burns prop in `compose.ts`
  (`moveTweens` crashed): the cascade uses `stepSeconds`.
- No brand copy from the references; neutral placeholder text.
