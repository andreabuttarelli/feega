# The chat knows which canvas the user has open

The project agent's prompt listed every canvas of the project but not the one open; the route
already resolved `canvasId` from the request and used it only for motion delegation and product
placement. Asked on "Prima tela" to "create a new frame from the Phone split template", the agent
put it on the brief's canvas from earlier in the thread. The prompt now names the open canvas as
the default for anything new (`openCanvasId`), unless the user names another one.
