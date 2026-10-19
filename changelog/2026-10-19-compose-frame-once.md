# The editor composes an unchanged frame once

`MotionEditorShell` composed the frame twice per doc change: the preview `html` and, in an effect,
the baked root html it hands to `frameDocs`. With no preview doc, no comp drilled into and not in
interactive mode, the two inputs are the same fields, so the second compose redid ~40 ms of work
on a 270-clip landing, on open and on every edit.

`lastComposed` remembers the last input and html, and returns the html when every input field is
the same object. It is a one-slot memo on purpose: the two calls alternate, and a bigger cache
would hold html strings for docs no one shows anymore.

Chrome CPU profile of opening a landing frame (prod build): `composeHtml` 77.6 → 43.7 ms.
