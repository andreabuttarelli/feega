import { runPlugin } from './feega-plugin-sdk.js';

runPlugin((api) => {
  api.command.on(async (command) => {
    if (command !== 'hello') {
      return;
    }
    const selection = await api.selection.get();
    await api.notify(selection ? `Hello from <${selection.tag}>` : 'Hello. Select an element first.');
  });
});
