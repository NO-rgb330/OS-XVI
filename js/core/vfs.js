/* ============================================================
   VFS — Virtual File System
   Metadata: IndexedDB (fast tree traversal, renaming, moving)
   Blobs:    OPFS (fast raw data storage)
   API:      Promise-based, path-centric.

   Three node kinds:
     · file  — content in OPFS, tracked in IndexedDB
     · dir   — folder metadata
     · app   — shortcut to a registered app (metadata only, no blob).
               Used by the SYSTEM APPS folder to expose every app in
               the file manager without storing them as real files.

   Protected nodes (`protected: true`) can be read but not modified —
   used for the SYSTEM APPS folder and its app entries. A protected
   entry can't be deleted, renamed or moved; it can be copied out to
   create an unprotected copy elsewhere.
   ============================================================ */

import { formatBytes } from './util.js';

/** Default fallback size. Updated by the setup wizard via localStorage. */
const DISK_CAPACITY_DEFAULT = 25 * 1024 ** 3;

const DB_NAME = 'os_vfs_db';
const DB_VERSION = 1;
const STORE_NODES = 'nodes';
const STORE_BLOBS = 'blobs';

/** Canonical location of the auto-populated app shortcuts folder. */
export const SYSTEM_APPS_DIR = '/home/user/SYSTEM APPS';

let db = null;
let opfsBlobs = null;
const listeners = new Map(); // event -> Set<cb>

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// ---- Init ----
export async function mount() {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    opfsBlobs = await opfsRoot.getDirectoryHandle('.blobs', { create: true });
  } catch (err) {
    console.error('OPFS mount failed', err);
    throw new Error('OPFS not available');
  }

  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NODES)) {
        const store = d.createObjectStore(STORE_NODES, { keyPath: 'id' });
        store.createIndex('pid', 'pid', { unique: false });
        store.createIndex('pid_name', ['pid', 'name'], { unique: true });
      }
      if (!d.objectStoreNames.contains(STORE_BLOBS)) {
        d.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!(await idbGet('root'))) {
    await idbPut({ id: 'root', pid: null, name: '', kind: 'dir', mtime: Date.now() });
  }
}

// ---- Event Bus ----
export function on(event, cb) {
  let set = listeners.get(event);
  if (!set) listeners.set(event, (set = new Set()));
  set.add(cb);
  return () => set.delete(cb);
}
function emit(event, path) {
  for (const cb of listeners.get(event) ?? []) cb(path);
  for (const cb of listeners.get('*') ?? []) cb(path);
}

// ---- Path utilities ----
function normPath(p) {
  const stack = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

function splitPath(p) {
  const n = normPath(p);
  const i = n.lastIndexOf('/');
  return { parent: n.slice(0, i) || '/', name: n.slice(i + 1) };
}

function assertName(name) {
  if (!name) throw new Error('EINVAL: empty name');
}

async function resolveId(path) {
  const n = normPath(path);
  if (n === '/') return 'root';
  let id = 'root';
  for (const part of n.split('/').filter(Boolean)) {
    const node = await idbIndexGet('pid_name', [id, part]);
    if (!node) return null;
    id = node.id;
  }
  return id;
}

async function getNode(path) {
  const id = await resolveId(path);
  return id ? idbGet(id) : null;
}

/** Resolve a path that must be an existing directory; returns its id. */
async function dirId(path) {
  const node = await getNode(path);
  if (!node) throw new Error('ENOENT: ' + path);
  if (node.kind !== 'dir') throw new Error('ENOTDIR: ' + path);
  return node.id;
}

// ---- Blob helpers ----
async function writeBlob(id, blob) {
  const handle = await opfsBlobs.getFileHandle(id, { create: true });
  const w = await handle.createWritable();
  await w.write(blob);
  await w.close();
}

async function readBlob(node) {
  try {
    return await (await opfsBlobs.getFileHandle(node.id)).getFile();
  } catch {
    const fallback = await idbGetBlob(node.id);
    if (fallback) return fallback;
    throw new Error('EIO: failed to read ' + node.name);
  }
}

// ---- Core API ----
export async function exists(path) {
  return (await getNode(path)) !== null;
}

export async function stat(path) {
  const node = await getNode(path);
  if (!node) throw new Error('ENOENT: ' + path);
  return { ...node };
}

export async function list(path) {
  const id = await resolveId(path);
  if (!id) throw new Error('ENOENT: ' + path);
  const nodes = await idbIndexAll('pid', id);
  return nodes.sort((a, b) =>
    a.kind !== b.kind ? (a.kind === 'dir' ? -1 : 1) : collator.compare(a.name, b.name));
}

export async function mkdir(path, { protected: isProtected = false } = {}) {
  const { parent, name } = splitPath(path);
  assertName(name);
  const pid = await dirId(parent);

  const parentNode = await getNode(parent);
  if (parentNode?.protected && !isProtected) {
    throw new Error('EPERM: ' + parent + ' is read-only');
  }

  const existing = await idbIndexGet('pid_name', [pid, name]);
  if (existing) {
    if (existing.kind === 'dir') return existing.id;
    throw new Error('EEXIST: ' + path);
  }

  const id = crypto.randomUUID();
  await idbPut({ id, pid, name, kind: 'dir', protected: isProtected, mtime: Date.now() });
  emit('change', parent);
  return id;
}

export async function write(path, data) {
  const { parent, name } = splitPath(path);
  assertName(name);
  const pid = await dirId(parent);
  const parentNode = await getNode(parent);
  if (parentNode?.protected) throw new Error('EPERM: ' + parent + ' is read-only');
  const blob = data instanceof Blob ? data : new Blob([data]);

  let node = await idbIndexGet('pid_name', [pid, name]);
  if (node?.kind === 'dir') throw new Error('EISDIR: ' + path);
  if (node?.kind === 'app') throw new Error('EEXIST: ' + path + ' (app shortcut exists)');
  if (node?.protected) throw new Error('EPERM: cannot overwrite protected entry');

  await assertSpace(blob.size - (node?.size || 0));

  node = node
    ? { ...node, size: blob.size, mtime: Date.now() }
    : { id: crypto.randomUUID(), pid, name, kind: 'file', size: blob.size, mtime: Date.now() };

  try {
    await writeBlob(node.id, blob);
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
      throw new Error('ENOSPC: The browser storage limit has been reached. You cannot save more files.');
    }
    throw err;
  }

  await idbPut(node);
  emit('change', parent);
  return node.id;
}

/**
 * Create an app shortcut entry (metadata only — no blob).
 * Used by the boot sequence to populate SYSTEM APPS with every registered
 * app, and by drag-and-drop when an app is moved from the desktop or
 * copied out of SYSTEM APPS.
 */
export async function writeApp(path, appId, { protected: isProtected = false } = {}) {
  const { parent, name } = splitPath(path);
  assertName(name);
  const pid = await dirId(parent);
  const parentNode = await getNode(parent);
  if (parentNode?.protected && !isProtected) {
    throw new Error('EPERM: ' + parent + ' is read-only');
  }

  const existing = await idbIndexGet('pid_name', [pid, name]);
  let node;
  if (existing) {
    if (existing.kind !== 'app') throw new Error('EEXIST: ' + path);
    if (existing.protected && !isProtected) throw new Error('EPERM: cannot modify protected entry');
    // `protected` upgrades, never downgrades.
    node = { ...existing, appId, protected: existing.protected || isProtected, mtime: Date.now() };
  } else {
    node = {
      id: crypto.randomUUID(),
      pid, name, kind: 'app', appId,
      protected: isProtected,
      size: 0,
      mtime: Date.now()
    };
  }
  await idbPut(node);
  emit('change', parent);
  return node.id;
}

export async function read(path) {
  const node = await getNode(path);
  if (!node) throw new Error('ENOENT: ' + path);
  if (node.kind === 'dir') throw new Error('EISDIR: ' + path);
  if (node.kind === 'app') throw new Error('EAPPN: ' + path + ' is an application shortcut');
  return readBlob(node);
}

async function removeNode(node) {
  if (node.protected) throw new Error('EPERM: cannot delete protected entry');
  if (node.kind === 'dir') {
    for (const child of await idbIndexAll('pid', node.id)) {
      if (child.protected) throw new Error('EPERM: folder contains protected entries');
      await removeNode(child);
    }
  } else if (node.kind === 'file') {
    try { await opfsBlobs.removeEntry(node.id); } catch { /* already gone */ }
  }
  // app entries have no blob
  await idbDel(node.id);
}

export async function rm(path) {
  const n = normPath(path);
  if (n === '/') throw new Error('EPERM: cannot remove root');
  const node = await getNode(n);
  if (!node) return; // idempotent
  await removeNode(node);
  emit('change', splitPath(n).parent);
}

export async function mv(src, dst) {
  const s = normPath(src);
  const d = normPath(dst);
  if (s === '/') throw new Error('EPERM: cannot move root');
  if (s === d) return;

  const srcNode = await getNode(s);
  if (!srcNode) throw new Error('ENOENT: ' + src);
  if (srcNode.protected) throw new Error('EPERM: cannot move protected entry');

  const { parent: dstParent, name: dstName } = splitPath(d);
  assertName(dstName);
  const dstPid = await dirId(dstParent);
  const dstParentNode = await getNode(dstParent);
  if (dstParentNode?.protected) throw new Error('EPERM: ' + dstParent + ' is read-only');

  if (srcNode.kind === 'dir' && d.startsWith(s + '/')) {
    throw new Error('EINVAL: cannot move a folder into itself');
  }
  if (await idbIndexGet('pid_name', [dstPid, dstName])) throw new Error('EEXIST: ' + dst);

  await idbPut({ ...srcNode, pid: dstPid, name: dstName, mtime: Date.now() });
  const srcParent = splitPath(s).parent;
  emit('change', srcParent);
  if (dstParent !== srcParent) emit('change', dstParent);
}

async function copyNode(node, pid, name) {
  const id = crypto.randomUUID();
  if (node.kind === 'dir') {
    await idbPut({ id, pid, name, kind: 'dir', mtime: Date.now() });
    for (const child of await idbIndexAll('pid', node.id)) await copyNode(child, id, child.name);
  } else if (node.kind === 'app') {
    // Copies of app shortcuts lose their protected flag — the copy is a
    // user-owned reference, only the original in SYSTEM APPS is protected.
    await idbPut({
      id, pid, name, kind: 'app',
      appId: node.appId,
      protected: false,
      size: 0,
      mtime: Date.now()
    });
  } else {
    const blob = await readBlob(node);
    await writeBlob(id, blob);
    await idbPut({ id, pid, name, kind: 'file', size: blob.size, mtime: Date.now() });
  }
}

export async function cp(src, dst) {
  const s = normPath(src);
  const d = normPath(dst);
  const srcNode = await getNode(s);
  if (!srcNode) throw new Error('ENOENT: ' + src);

  const { parent: dstParent, name: dstName } = splitPath(d);
  assertName(dstName);
  const dstPid = await dirId(dstParent);
  const dstParentNode = await getNode(dstParent);
  if (dstParentNode?.protected) throw new Error('EPERM: ' + dstParent + ' is read-only');

  if (srcNode.kind === 'dir' && d.startsWith(s + '/')) {
    throw new Error('EINVAL: cannot copy a folder into itself');
  }
  if (await idbIndexGet('pid_name', [dstPid, dstName])) throw new Error('EEXIST: ' + dst);

  await assertSpace(await treeSize(srcNode));
  await copyNode(srcNode, dstPid, dstName);
  emit('change', dstParent);
}

// ---- Virtual disk accounting ----
let capacityCache = { t: 0, v: DISK_CAPACITY_DEFAULT };

async function diskCapacity() {
  const now = Date.now();
  if (now - capacityCache.t < 30000) return capacityCache.v;

  let requested = DISK_CAPACITY_DEFAULT;

  try {
    const cfg = JSON.parse(localStorage.getItem('os16.config'));
    if (cfg && cfg.diskLimit) {
      requested = cfg.diskLimit * 1024 ** 3;
    }
  } catch {}

  let actual = requested;
  try {
    const est = await navigator.storage.estimate();
    if (est?.quota > 0) {
      actual = Math.min(requested, est.quota);
    }
  } catch { /* estimate() unavailable: use the nominal size */ }

  capacityCache = { t: now, v: actual };
  return actual;
}

/** Totals for the whole virtual disk: { used, free, capacity, files, dirs } (bytes / counts). */
export async function usage() {
  let used = 0, files = 0, dirs = 0;
  for (const n of await wrap(nodes().getAll())) {
    if (n.id === 'root') continue;
    if (n.kind === 'dir') dirs++;
    else if (n.kind === 'file') { files++; used += n.size || 0; }
    // app entries take up no disk space and are not counted as files
  }
  const capacity = await diskCapacity();
  return { used, files, dirs, capacity, free: Math.max(0, capacity - used) };
}

/** Immediate children of `path` with recursive sizes, largest first: [{ name, kind, size }]. */
export async function breakdown(path) {
  const rootId = await resolveId(path);
  if (!rootId) throw new Error('ENOENT: ' + path);
  const kids = new Map();
  for (const n of await wrap(nodes().getAll())) {
    if (!kids.has(n.pid)) kids.set(n.pid, []);
    kids.get(n.pid).push(n);
  }
  const memo = new Map();
  const sizeOf = (n) => {
    if (n.kind !== 'dir') return n.size || 0;
    if (memo.has(n.id)) return memo.get(n.id);
    let t = 0;
    for (const c of kids.get(n.id) ?? []) t += sizeOf(c);
    memo.set(n.id, t);
    return t;
  };
  return (kids.get(rootId) ?? [])
    .map((n) => ({ name: n.name, kind: n.kind, size: sizeOf(n) }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

async function treeSize(node) {
  if (node.kind !== 'dir') return node.size || 0;
  let t = 0;
  for (const c of await idbIndexAll('pid', node.id)) t += await treeSize(c);
  return t;
}

async function assertSpace(extra) {
  if (extra <= 0) return;
  const { free } = await usage();
  if (extra > free) {
    throw new Error(`ENOSPC: Not enough disk space (need ${formatBytes(extra)}, ${formatBytes(free)} left)`);
  }
}

/**
 * Requests persistent storage from the browser and forces a quota refresh.
 * Returns { granted: boolean, capacity: number }.
 */
export async function requestPersist() {
  let granted = false;
  if (navigator.storage && navigator.storage.persist) {
    try {
      granted = await navigator.storage.persist();
    } catch (e) {
      console.error('Error requesting persist:', e);
    }
  }

  capacityCache = { t: 0, v: DISK_CAPACITY_DEFAULT };

  const stats = await usage();
  return { granted, capacity: stats.capacity };
}

// ---- IndexedDB helpers ----
const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const nodes = (mode = 'readonly') => db.transaction(STORE_NODES, mode).objectStore(STORE_NODES);

const idbGet = (key) => wrap(nodes().get(key));
const idbPut = (obj) => wrap(nodes('readwrite').put(obj));
const idbDel = (key) => wrap(nodes('readwrite').delete(key));
const idbIndexGet = (index, query) => wrap(nodes().index(index).get(query));
const idbIndexAll = (index, query) => wrap(nodes().index(index).getAll(query));
async function idbGetBlob(key) {
  const row = await wrap(db.transaction(STORE_BLOBS).objectStore(STORE_BLOBS).get(key));
  return row ? row.data : null;
}
