# Panels from the logo menu on a phone

The mobile layout has no left panel, and the logo menu's "Pages" entries (History, Assets,
Components, Styles) were links with an empty path: they went to the project root and opened
nothing. A panel entry now calls `leftPanelRequest.ask(kind)`; the project layout sets `leftPanel`
from it, and on a phone renders `CanvasLeftPanel` (`docked`) inside a `PhoneSheet`. Desktop
keeps the floating panel. Sheet and route entries stay links.

People's drags are now history events: `moveNode` logs `user` as well as `agent`, once per drag
end (the page action already writes once per gesture), and nothing when the position did not
change.
