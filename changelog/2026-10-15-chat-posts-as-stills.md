# Social posts asked in chat land as editable still frames

Demo-quality run on the test account: "make me 3 Instagram posts" in a canvas chat made three Generate image nodes (Seedream 5 Lite) with the copy baked into the picture, plus a captions doc. Text could not be edited, the model misspells lettering, and the posts came out square though the nodes said 4:5. The canvas chat prompt never said what a post is, so the model picked the image node.

- `projectAgentPrompt` now says a post, story or poster is an editable still frame: one `create_motion_video` per post (4:5 post, 9:16 story) with a brief that asks for a still. An image node stays for a photo or illustration the user asked for.
- Re-run after the change: three motion nodes, 1080×1350 stills with live text, one user message.

Discarded: a `still` flag on `create_motion_video` — the motion agent already sets it with `set_canvas still`; the prompt line was enough in the run.
