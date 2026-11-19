# A Feega icon in the VS Code activity bar opens the canvas

Opening a canvas took the command palette or a `.feega` file in the explorer. The extension now
contributes an activity bar container with the Feega mark and one view, `feega.home`.

VS Code has no "run a command on activity icon click": the click only shows the container. So the
view's visibility does the work (`openOnShow` in `vscode/home.js`): each time it becomes visible,
the workspace's `.feega` files decide the action — none runs **New canvas**, one opens it with the
custom editor, several ask in a quick-pick — and the sidebar is closed first. Closing it is what
makes the next click open the canvas again (a click on the icon of a container already showing
only hides it), and closing it before the quick-pick matters: closed after, it took focus and
dismissed the pick. A window with no folder keeps the sidebar open on a welcome view with
**Open Folder**; the view also has **Open canvas** / **New canvas** buttons as a fallback.

The icon is the favicon's four lobes, flattened from `<use>` to four paths in `currentColor`.

Discarded: a webview view (heavier, same visibility event), opening on `onView:` activation only
(fires once per session, not per click).
