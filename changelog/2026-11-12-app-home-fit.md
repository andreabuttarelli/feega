# App home: title smaller, list reaches the bottom

The home column had a fixed height (`100svh` minus bar and padding variables) that did not match
the shell's real padding, so the recents list scrolled inside a box that ended well above the
window bottom. The fixed height and inner scroller are gone: the page scrolls with the shell.
The heading drops from `clamp(40px, 4.5vw, 72px)` to `clamp(32px, 3.2vw, 48px)` (mobile
`clamp(36px, 10vw, 64px)` to `clamp(28px, 8vw, 36px)`).
