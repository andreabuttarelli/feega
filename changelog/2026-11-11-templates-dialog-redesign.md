# Templates dialog redesigned on the app's catalogue primitives

The in-frame Templates dialog was a bare modal: a text list of names, one large preview, an unstyled
"Insert at playhead" and a save form of unlabelled inputs. It now uses the shell the Frame templates
catalogue uses: `Dialog` (focus trap, Escape), search, group chips, a card grid with a poster per
template (`previewOf`, via `catalogue()`, so newest first), a detail pane with live preview, a
labelled field list, the sounds checkbox and a primary `Button`. Saving moved to a "Save selection"
tab with labelled inputs. Grouping and filtering are pure (`library-groups.ts`) and tested.

Decided against live-rendering a `MotionPreview` per card: eleven to sixty players in one grid cost
more than the catalogue's posters. Templates without a poster (own ones, a few built-ins) show a name
tile; the selected one plays live in the detail pane. Behaviour (insert at the playhead, sounds, save,
delete) is unchanged.
