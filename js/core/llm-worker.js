/* Runs WebLLM off the main thread so chatting never freezes the desktop.
   The library URL arrives in the query string (?lib=…) and is restricted to known CDNs.
   Messages that arrive while the library is still downloading are queued, not lost. */

const lib = new URL(import.meta.url).searchParams.get('lib') || '';
if (!/^https:\/\/(cdn\.jsdelivr\.net|esm\.run)\//.test(lib)) throw new Error('llm-worker: untrusted library URL');

let handler = null;
const queue = [];
self.onmessage = (msg) => (handler ? handler.onmessage(msg) : queue.push(msg));

import(lib).then(({ WebWorkerMLCEngineHandler }) => {
  handler = new WebWorkerMLCEngineHandler();
  for (const msg of queue.splice(0)) handler.onmessage(msg);
}).catch((err) => {
  setTimeout(() => { throw err; });   // surfaces as the Worker's `error` event on the main thread
});
