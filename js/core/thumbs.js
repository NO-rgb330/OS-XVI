/* ============================================================
   Thumbnails — small cached previews for the Image Viewer.

   · A thumbnail is a ≤256 px WebP made once per image version, so the grid
     never has to decode full-size photos just to draw a 120 px tile.
   · Thumbnails are kept in three places: object URLs in memory (LRU), a
     separate IndexedDB database (survives reloads), and — if neither has
     it — they are generated, at most WORKERS at a time.
   · The queue is last-in-first-out: whatever scrolled into view most
     recently is served first, and tiles that scroll away before their turn
     are cancelled, so fast scrolling never builds a backlog.
   · Keys look like "<node id>:<size>:<mtime>", so an edited or replaced
     image gets a fresh thumbnail automatically.

   A "file" here is { key, name, node } where `node` is the object returned
   by vfs.list().
   ============================================================ */

import * as vfs from './vfs.js';
import { mimeOf } from './util.js';

const EDGE = 256;          // longest side of a stored thumbnail, px
const WORKERS = 3;         // thumbnails generated at the same time
const MEM_MAX = 1500;      // thumbnails held as object URLs
const DB_MAX = 8000;       // thumbnails kept on disk before the oldest are pruned
const DB_NAME = 'os16_thumbs';
const STORE = 'thumbs';

const mem = new Map();     // key -> entry. Insertion order doubles as LRU order.
const jobs = new Map();    // key -> job (queued or running)
const queue = [];          // queued jobs; the newest is served first
let running = 0;

const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

// ---- Persistent store (best effort: everything still works without it) ----
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('t', 't');
      };
      req.onsuccess = () => { resolve(req.result); idle(prune); };
      req.onerror = req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const store = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);

async function dbGet(key) {
  const db = await openDb();
  if (!db) return null;
  try { return (await wrap(store(db, 'readonly').get(key))) || null; } catch { return null; }
}
async function dbHas(key) {
  const db = await openDb();
  if (!db) return false;
  try { return (await wrap(store(db, 'readonly').count(key))) > 0; } catch { return false; }
}
async function dbPut(rec) {
  const db = await openDb();
  if (!db) return;
  try { await wrap(store(db, 'readwrite').put(rec)); } catch { /* quota or closed: skip */ }
}

/** Keeps the thumbnail database bounded: drops the oldest records once DB_MAX is exceeded. */
async function prune() {
  const db = await openDb();
  if (!db) return;
  try {
    const count = await wrap(store(db, 'readonly').count());
    let drop = count - DB_MAX;
    if (drop <= 0) return;
    drop += Math.floor(DB_MAX / 5);                       // leave headroom so this doesn't run every launch
    const t = db.transaction(STORE, 'readwrite');
    const os = t.objectStore(STORE);
    const cur = os.index('t').openKeyCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c || drop <= 0) return;
      os.delete(c.primaryKey);
      drop--;
      c.continue();
    };
    await new Promise((resolve) => { t.oncomplete = t.onerror = t.onabort = resolve; });
  } catch { /* best effort */ }
}

// ---- Rendering ----
/** Draws `source` (ImageBitmap or loaded <img>) at thumbnail size and encodes it. */
async function render(source, ow, oh) {
  const k = Math.min(1, EDGE / Math.max(ow, oh, 1));
  const w = Math.max(1, Math.round(ow * k));
  const h = Math.max(1, Math.round(oh * k));
  let blob;
  if (typeof OffscreenCanvas === 'function') {
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(source, 0, 0, w, h);
    blob = await c.convertToBlob({ type: 'image/webp', quality: 0.8 });
  } else {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(source, 0, 0, w, h);
    blob = await new Promise((resolve) => c.toBlob(resolve, 'image/webp', 0.8));
  }
  if (!blob) throw new Error('thumbnail encode failed');
  return { blob, w, h };
}

/** Reads the image and returns { blob, w, h, ow, oh } (ow/oh = original size, 0 if unknown). */
async function makeThumb(file) {
  const data = await vfs.readNode(file.node);
  // OPFS blobs carry no MIME type; without one SVGs (and some others) won't decode.
  const blob = new Blob([data], { type: mimeOf(file.name) });
  const isSvg = /\.svg$/i.test(file.name);

  if (!isSvg && typeof createImageBitmap === 'function') {
    try {                                         // decoded off the main thread
      const bmp = await createImageBitmap(blob);
      try { return { ...(await render(bmp, bmp.width, bmp.height)), ow: bmp.width, oh: bmp.height }; }
      finally { bmp.close?.(); }
    } catch { /* fall through */ }
    try {                                         // too big to decode in full? ask for a small decode
      const bmp = await createImageBitmap(blob, { resizeWidth: EDGE, resizeQuality: 'low' });
      try { return { ...(await render(bmp, bmp.width, bmp.height)), ow: 0, oh: 0 }; }
      finally { bmp.close?.(); }
    } catch { /* fall through */ }
  }

  const url = URL.createObjectURL(blob);          // SVG and anything createImageBitmap refuses
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const ow = im.naturalWidth || 512, oh = im.naturalHeight || 512;
    return { ...(await render(im, ow, oh)), ow, oh };
  } finally { URL.revokeObjectURL(url); }
}

function remember(key, rec) {
  const entry = { key, url: URL.createObjectURL(rec.blob), w: rec.w, h: rec.h, ow: rec.ow || 0, oh: rec.oh || 0 };
  mem.set(key, entry);
  while (mem.size > MEM_MAX) {
    const [oldKey, old] = mem.entries().next().value;
    mem.delete(oldKey);
    URL.revokeObjectURL(old.url);
  }
  return entry;
}

async function produce(file) {
  const rec = await dbGet(file.key);
  if (rec?.blob) return remember(file.key, rec);
  const made = await makeThumb(file);
  const entry = remember(file.key, made);
  dbPut({ key: file.key, blob: made.blob, w: made.w, h: made.h, ow: made.ow, oh: made.oh, t: Date.now() });
  return entry;
}

function pump() {
  while (running < WORKERS && queue.length) {
    const job = queue.pop();
    job.started = true;
    running++;
    produce(job.file).catch(() => null).then((entry) => {
      running--;
      jobs.delete(job.file.key);
      job.resolve(entry);
      pump();
    });
  }
}

// ---- Public API ----
/** The in-memory thumbnail for `key`, or undefined. Never does any work. */
export function peek(key) {
  const e = mem.get(key);
  if (e) { mem.delete(key); mem.set(key, e); }
  return e;
}

export const has = (key) => mem.has(key);

/**
 * Resolves with the thumbnail entry { url, w, h, ow, oh }, or null if the image
 * couldn't be decoded, or undefined if the request was cancelled first.
 */
export function request(file) {
  const hit = peek(file.key);
  if (hit) return Promise.resolve(hit);
  let job = jobs.get(file.key);
  if (!job) {
    job = { file, started: false };
    job.promise = new Promise((resolve) => { job.resolve = resolve; });
    jobs.set(file.key, job);
    queue.push(job);
    pump();
  } else if (!job.started) {                      // asked for again: bump to the front
    const i = queue.indexOf(job);
    if (i >= 0) { queue.splice(i, 1); queue.push(job); }
  }
  return job.promise;
}

/** Drops a queued (not yet started) request. Running ones finish and are cached. */
export function cancel(key) {
  const job = jobs.get(key);
  if (!job || job.started) return;
  const i = queue.indexOf(job);
  if (i >= 0) queue.splice(i, 1);
  jobs.delete(key);
  job.resolve(undefined);
}

/**
 * Makes a thumbnail from an image that is already decoded (the viewer calls this
 * for the picture on screen, so scrubbing and the grid get previews for free).
 */
export async function adopt(file, imageEl, ow, oh) {
  if (!file?.key || mem.has(file.key) || jobs.has(file.key) || !ow || !oh) return null;
  try {
    if (await dbHas(file.key)) return null;
    const made = await render(imageEl, ow, oh);
    const entry = remember(file.key, { ...made, ow, oh });
    dbPut({ key: file.key, blob: made.blob, w: made.w, h: made.h, ow, oh, t: Date.now() });
    return entry;
  } catch { return null; }
}
