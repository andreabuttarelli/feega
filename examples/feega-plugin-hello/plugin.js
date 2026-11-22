const waiting = new Map();
let lastId = 0;

function call(name, args) {
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    self.postMessage({ type: 'call', id, call: name, args });
  });
}

function onResult(message) {
  const reply = waiting.get(message.id);
  waiting.delete(message.id);
  if (message.ok) {
    reply.resolve(message.value);
    return;
  }
  reply.reject(new Error(message.reason));
}

async function sayHello() {
  const selection = await call('selection');
  const text = selection ? `Hello from <${selection.tag}>` : 'Hello. Select an element first.';
  await call('notify', { text });
}

self.addEventListener('message', ({ data }) => {
  if (data.type === 'result') {
    onResult(data);
    return;
  }
  if (data.signal === 'command' && data.payload.command === 'hello') {
    sayHello();
  }
});
