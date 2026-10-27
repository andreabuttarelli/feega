# Landing link previews move

The landing's Open Graph card was a still `og.png`. Shared links now point
at `og.gif`, a 4.5 s loop of the real canvas (overview → Aurel landing →
back), 1200×630, 4.9 MB, under X's 5 MB GIF limit. `og:video` adds the
same loop as a 863 KB mp4 for platforms that play it.

Most networks still show only the first frame; Slack, Discord and
iMessage animate the GIF. `og.png` stays in `static/` as the still
fallback.
