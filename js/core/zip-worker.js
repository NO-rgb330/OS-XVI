/* ============================================================
   Web Worker hosting ZipWriter.

   Protocol (main → worker):
     { type: 'add-start', name, method }   — begin an entry
     { type: 'add-chunk', data: ArrayBuffer }   — data (transferred)
     { type: 'add-end' }                    — finalize the entry
     { type: 'finish' }                     — write central dir + EOCD

   Protocol (worker → main):
     { type: 'progress', bytes, files }     — throttled status update
     { type: 'done', chunks, files, bytes } — final chunks (transferred)
     { type: 'error', message }

   Chunks come back to the main thread as transferable ArrayBuffers, so
   worker memory drops to zero immediately after `finish()`. On the main
   thread, `new Blob([...chunks])` is a lazy composite — the assembly
   is free.
   ============================================================ */

import { ZipWriter } from './zip-writer.js';

let writer = null;
let fileCount = 0;
let lastProgressAt = 0;
let closed = false;

const send = (msg, transfer) => self.postMessage(msg, transfer || []);

self.onmessage = async (ev) => {
  if (closed) return;
  const msg = ev.data || {};

  try {
    switch (msg.type) {
      case 'add-start':
        writer ??= new ZipWriter();
        await writer.addStart(msg.name, msg.method);
        fileCount++;
        break;

      case 'add-chunk':
        if (!writer) throw new Error('worker: no active writer');
        await writer.addChunk(new Uint8Array(msg.data));
        // Report progress at most ~4×/sec to avoid hammering the main thread.
        {
          const now = performance.now();
          if (now - lastProgressAt > 250) {
            lastProgressAt = now;
            send({ type: 'progress', bytes: writer.bytesWritten, files: fileCount });
          }
        }
        break;

      case 'add-end':
        await writer.addEnd();
        break;

      case 'finish': {
        const chunks = writer.finish();
        closed = true;
        send(
          { type: 'done', chunks, files: fileCount, bytes: writer.bytesWritten },
          chunks.map((c) => c.buffer)
        );
        break;
      }
    }
  } catch (err) {
    closed = true;
    send({ type: 'error', message: String((err && err.message) || err) });
  }
};
