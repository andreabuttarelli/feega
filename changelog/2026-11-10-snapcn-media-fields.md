# snapcn media fields use the media pickers

The 61 snapcn ports took pictures and clips as URL text, and feega's CSP blocks external hosts, so a pasted link often rendered nothing. Image and clip props are now `PropFormat.Asset` (one picture, default `null`) or `PropFormat.Media` (a list, default empty), the same formats the other templates use: the Properties panel shows the project-assets picker, upload and drag from the canvas, and the motion agent sets them with `set_template_fields` and asset ids.

Decisions: the generated component source normalises props (`null` becomes `''`) and `S.media` turns picker items into URLs, so ports keep their placeholders when nothing is picked. `S.h` marks `img` and `video` `crossorigin=anonymous`, otherwise the sandboxed DOM reader gets a tainted bitmap and the frame renders blank. `card-rail` and `channel-thread` carried pictures inside a delimited text prop; they now have separate `cardImages`, `backdropImage` and `avatars` props. `hero-launch` loses its gradient-as-text option (empty still draws the gradient). `custom-template` maps `PropFormat.Asset` to the asset field.

Templates already inserted keep the old component source stored in their doc: insert them again.
