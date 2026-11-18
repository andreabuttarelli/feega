# Breakpoint views get their images

Since `2026-11-16-views-with-frames`, a view shown for the first time paints its vectors before
its images (`showsBeforeMedia`). That first paint went out under the same group name
(`<id>@bp:<view>:live<n>`) as the whole view that follows once `media.ready` resolves. `put` is
keyed by group, so the whole list replaced the vectors one in `lists` but was never sent to the
core: every image of a tablet or phone view stayed a `--line` block (`withoutPictures`), #222 in
dark mode, until the next edit or rebuild. On the landings bench the Stripe tablet and phone
views kept their hero, card and mockup blocks for more than 60 s.

The vectors-first paint now goes out as `<key>:vectors` (`beforeMediaGroup`), the suffix the
base frame's `load` already uses, so the whole view is a new group and is put. Stripe views at
rest: blocks forever → whole at ~5 s from navigation, with the base frame.

Considered: dropping the group from `put` when its list changes. Rejected: a group whose content
changes under the same name is the defect; every other path already names a new group.
