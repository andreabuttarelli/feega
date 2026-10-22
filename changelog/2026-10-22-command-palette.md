# ⌘K command palette on the canvas

Lists every command the Design-mode shortcut table reaches (`SHORTCUTS`, names
from `ACTIONS`), searchable by name or description. Running an entry dispatches
its own shortcut on `window`, so the palette adds no second dispatch table: the
shortcut and the palette cannot diverge. Commands shadowed in Design (e.g. bare
K is the scale tool there, not pause) are left out because their key would run
something else. Not listed yet: actions without a shortcut (select same…).
