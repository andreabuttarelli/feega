# `/api/v1/org/canvas` honours the uncensored lock

The page refuses a canvas of an uncensored project until the caller has unlocked the workspace
(`canvasReachable` in `motionScope`). The endpoint added in step 1 of ADR 0009 only checked the
project belonged to the org, so CLI and MCP reached locked canvases. It now calls
`canvasReachable` and answers the same `project_not_found` 404 as a missing project, leaking
nothing about the lock.
