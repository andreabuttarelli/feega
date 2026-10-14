# A poster from a template starts as its own clip

Poster part editing (select a line, double-click to type, part colour) works on a top-level
Custom clip. Every poster added from the frame templates, the dashboard or the agent came through
`startFromTemplate`, which wraps the template in a Precomp instance: on the canvas a double-click
did nothing and Properties showed only the template form. The parts spec passed because it seeds
a flat doc.

`startFromTemplate` now lifts a still doc's sole clip out of its precomp (`liftSoleClip`). Videos
keep the template instance. Lost for posters: the template mark (Detach, template field form);
the part panel covers the same fields.
