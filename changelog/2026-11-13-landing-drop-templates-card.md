# Landing: templates card removed

The motion chapter on the marketing home ended with a card ("Graphic & motion design", two poster
shots). The owner asked to drop the box dedicated to posters.

- `Motion.svelte` no longer renders `Features`; the chapter is intro, steps and the video ticker.
- `Card.Templates`, its snippet, CSS and `tool-tpl-a/b.webp` are deleted; nothing else used them.
- Chapter spacing is unchanged: `.chapter-block` and `--site-section` already own the boundary.
