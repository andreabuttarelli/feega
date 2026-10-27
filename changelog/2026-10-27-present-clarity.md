# Present control: clear label, banner, no vanishing

**Before.** "Spotlight me" showed whenever a peer list existed, gave no feedback to the presenter
and sat behind the same visibility gate as the avatars, so it could disappear mid-presentation.

**Now.** Button reads "Present" with a tooltip, only with other people on the canvas. While
presenting a banner shows "You're presenting" and a Stop button; it stays until Stop. Off in
local mode (`LocalOff.Present`). Follow protocol unchanged (e2e `canvas-cursors` covers it).

**Discarded.** "N following": presence marks do not carry who follows; the banner counts people
on the canvas instead.
