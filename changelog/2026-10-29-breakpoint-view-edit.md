# Edit elements directly in breakpoint views

Tablet/Phone views beside a frame now take selection, drag and resize. The
selection outline and handles are drawn in the view, from the view's own
resolved layout (`resolveView`), and the drag result is lifted back with
`liftViewEdit`: the view's content-height stretch is undone (`restretched`),
only whitelisted keys that changed are carried (`carryChanges`), then
`liftEdit` writes them as overrides of that breakpoint.

Changed decision: `liftEdit` used to push non-overridable changes (text,
colours) made in a view to the base. It now drops them; the inspector badge
says which properties vary and that the rest is edited on the frame. Text
editing on canvas is disabled while a view is the edited one.

View labels are now drawn by the GPU tile chrome, the same path as frame
titles, instead of a DOM span with its own style.
