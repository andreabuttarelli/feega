# Shortening a video under its music

`add_music` lays the track to the end of the video. In a real chat run the agent then tried
`set_canvas duration 14` and got "a clip ends at frame 450": the music blocked every shortening and
the video stayed 15 s.

- `setCanvas` first cuts every Audio-track clip that crosses the new end and gives it a fade-out
  (at least 1.5 s, or its length), then checks what is left. A sound that starts after the new end
  and any visual clip still refuse the cut: those hold content the user placed.
