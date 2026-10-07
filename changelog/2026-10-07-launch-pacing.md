# Launch film pacing

User feedback on every video: "always too fast". The launch film style allowed 0.8–2.5 s scenes
and cuts on half beats.

- `STYLES[LaunchFilm].seconds.scene` is now [2, 4]; a new check, `Forbidden.Rushed`, names a
  scene (a Precomp on the main timeline) shorter than 2 s. Warning, not blocking.
- OffBeat accepts only whole beats: half beats are gone.
- Reading time gains a 0.5 s pause in every style.
- Launch scenes stretched to 2–4 s; fewer ideas instead of faster cuts: the number match cut has
  two numbers, the claim run two claims, the logo build a shorter default claim.
- Prompt: 4–6 scenes in 15 s; speed ramp, montage and orbit only for longer films.
- `turn.closing.test.ts` runs on an Apple minimal doc whose title covers the film: once merged,
  #201 (a launch film without music) and #204 (empty frames) made the fake film blocking.
