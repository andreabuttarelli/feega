// src/lockdown.ts
var LOCKED_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel", "WebTransport", "WebSocketStream"];
function lockdown(scope, names = LOCKED_GLOBALS) {
  for (const name of names) {
    if (name in scope) {
      Object.defineProperty(scope, name, { value: void 0, writable: false, configurable: false });
    }
  }
}
var LOCKDOWN_SOURCE = `(${lockdown.toString()})(self, ${JSON.stringify(LOCKED_GLOBALS)});`;

// src/client.ts
function createApi(port) {
  let next = 0;
  const waiting = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  port.listen((message) => {
    if (message.type === "signal") {
      listeners.get(message.signal)?.forEach((listener) => listener(message.payload));
      return;
    }
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.ok) {
      pending?.resolve(message.value);
      return;
    }
    pending?.reject(new Error(message.reason));
  });
  function call(name, args) {
    const id = ++next;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      port.post({ type: "call", id, call: name, args });
    });
  }
  function on(signal, listener) {
    listeners.set(signal, [...listeners.get(signal) ?? [], listener]);
  }
  return {
    selection: {
      get: () => call("selection" /* Selection */),
      on: (listener) => on("selection" /* Selection */, (p) => listener(p.selection)),
      watch: (listener) => {
        let changed = false;
        on("selection" /* Selection */, (p) => (changed = true, listener(p.selection)));
        void call("selection" /* Selection */).then((current) => !changed && listener(current));
      }
    },
    project: { info: () => call("project" /* Project */) },
    source: { text: () => call("source-text" /* SourceText */) },
    propose: (label, ops) => call("propose" /* Propose */, { label, ops }),
    preview: (at, css) => call("preview" /* Preview */, { at, css }),
    fetch: (url) => call("fetch" /* Fetch */, { url }),
    notify: (text) => call("notify" /* Notify */, { text }),
    pickFile: (accept) => call("pick-file" /* PickFile */, { accept }),
    section: (contribution) => ({
      render: (tree) => call("render" /* Render */, { contribution, tree }),
      on: (listener) => on("control" /* Control */, (p) => p.contribution === contribution && listener(p.id, p.value, p.live))
    }),
    overlay: (contribution) => ({
      render: (handles) => call("overlay" /* Overlay */, { contribution, handles }),
      on: (listener) => on("handle" /* Handle */, (p) => p.contribution === contribution && listener(p.id, p.phase, p.x, p.y))
    }),
    menu: { on: (listener) => on("menu" /* Menu */, (p) => listener(p.item, p.target, p.place)) },
    command: { on: (listener) => on("command" /* Command */, (p) => listener(p.command)) },
    action: { on: (listener) => on("action" /* Action */, (p) => listener(p.action)) }
  };
}
function runPlugin(setup, scope = self) {
  const post = scope.postMessage.bind(scope);
  lockdown(scope);
  setup(createApi({ post, listen: (handle) => scope.addEventListener("message", (event) => handle(event.data)) }));
}
export {
  createApi,
  runPlugin
};
