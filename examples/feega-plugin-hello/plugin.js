"use strict";
(() => {
  // src/feega-plugin-sdk.js
  var LOCKED_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel", "WebTransport", "WebSocketStream"];
  function lockdown(scope, names = LOCKED_GLOBALS) {
    for (const name of names) {
      if (name in scope) {
        Object.defineProperty(scope, name, { value: void 0, writable: false, configurable: false });
      }
    }
  }
  var LOCKDOWN_SOURCE = `(${lockdown.toString()})(self, ${JSON.stringify(LOCKED_GLOBALS)});`;
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
        get: () => call(
          "selection"
          /* Selection */
        ),
        on: (listener) => on("selection", (p) => listener(p.selection)),
        watch: (listener) => {
          let changed = false;
          on("selection", (p) => (changed = true, listener(p.selection)));
          void call(
            "selection"
            /* Selection */
          ).then((current) => !changed && listener(current));
        }
      },
      project: { info: () => call(
        "project"
        /* Project */
      ) },
      source: { text: () => call(
        "source-text"
        /* SourceText */
      ) },
      propose: (label, ops) => call("propose", { label, ops }),
      preview: (at, css) => call("preview", { at, css }),
      fetch: (url) => call("fetch", { url }),
      notify: (text) => call("notify", { text }),
      pickFile: (accept) => call("pick-file", { accept }),
      section: (contribution) => ({
        render: (tree) => call("render", { contribution, tree }),
        on: (listener) => on("control", (p) => p.contribution === contribution && listener(p.id, p.value, p.live))
      }),
      overlay: (contribution) => ({
        render: (handles) => call("overlay", { contribution, handles }),
        on: (listener) => on("handle", (p) => p.contribution === contribution && listener(p.id, p.phase, p.x, p.y))
      }),
      menu: { on: (listener) => on("menu", (p) => listener(p.item, p.target, p.place)) },
      command: { on: (listener) => on("command", (p) => listener(p.command)) },
      action: { on: (listener) => on("action", (p) => listener(p.action)) }
    };
  }
  function runPlugin(setup, scope = self) {
    const post = scope.postMessage.bind(scope);
    lockdown(scope);
    setup(createApi({ post, listen: (handle) => scope.addEventListener("message", (event) => handle(event.data)) }));
  }

  // src/plugin.js
  runPlugin((api) => {
    api.command.on(async (command) => {
      if (command !== "hello") {
        return;
      }
      const selection = await api.selection.get();
      await api.notify(selection ? `Hello from <${selection.tag}>` : "Hello. Select an element first.");
    });
  });
})();
