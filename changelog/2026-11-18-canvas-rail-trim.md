# A shorter canvas rail

The rail had Layers, Assets, Brands, Influencers, Components, History, Styles and AI.

- Influencers live at the bottom of the AI panel (`AiNodesPanel` renders `InfluencersPanel`):
  both are things you drop on the canvas to generate with.
- History is a project settings page (`/p/<id>/settings/history`, a `project`-scope row in
  `SETTINGS_SECTIONS`), opened as a sheet over the canvas on the canvas you are on, or picked from
  a list. `historyPanel.show()` (menu, frame context menu) now opens that sheet.
- The bottom bar no longer offers Play (prototyping): `MODES` has a `listing` column, and a stored
  hidden mode reopens Design.
- Comments are hidden for now: no panel, no menu entry, no unread dot, no comment tool. The code is
  unhooked, not deleted.

Shortcuts: Alt+1..6 for Layers, Assets, Brands, Components, Styles, AI.
