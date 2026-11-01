# Import-from-URL demo video, third take: the ending

v2 ended on Code mode with the camera held at the panel's first paint and
the screencast silent (no new frames while the page is still), so it read
as a freeze on half-lines of code.

The ending now frames the code panel, scrolls to component usage
(`<NavLink …/>`, `<Button …/>`), copies (shows "Copied"), switches React →
HTML, then holds a wide shot before the end card. Each beat holds 2.5 s.

Recorder: `d.click` takes an optional `fit`, so a click can frame the panel
it changes instead of the pointer (the camera already supported `fit` for
`select` and `look`). The demo no longer hardcodes the instance name: the
imported site changes, so it picks the first component that has an instance
on the page.
