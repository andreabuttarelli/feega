# Canvas actions post to the canvas route, not the current URL

Opening a sheet (settings, calendar, promote) shallow-routes the URL to the
sheet's path. The canvas posted its form actions to a relative `?/<action>`,
so with a sheet open every create, write, move, connect or sync landed on the
sheet's route: `No action with name 'create' found`, shown as "Not saved".

`canvasActionUrl` builds `/p/<project>/c/<canvas>?/<action>`; the page's
`post()` and `NextStepChips` use it. A source guard test fails if any canvas
file goes back to a relative action URL.
