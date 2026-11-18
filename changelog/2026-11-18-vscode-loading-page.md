# The VS Code loading page shows the first step at once

`progressOf` started every step as pending, so until the launcher printed its first event the page
showed six empty circles. When the app bundle was already cached the download event never came,
and the first circle stayed empty while work was going on. The first step now starts active.

The page itself follows the new onboarding: the landing's ASCII field in a box on the left (its
phase reads the clock, so the field does not jump when the webview HTML is replaced on each
event), a title, an "N of M done" bar and the steps on the right, with a spinning arc for the
active step and a check for done ones. Under 720px the box is hidden.
