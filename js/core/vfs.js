/* ============================================================
   VFS — Virtual File System
   Metadata: IndexedDB (fast tree traversal, renaming, moving)
   Blobs:    OPFS (fast raw data storage)
   API:      Promise-based, path-centric.
   ============================================================ */

const DB_NAME = 'os_vfs_db';
const DB_VERSION = 1;
const STORE_NODES = 'nodes';
const STORE_BLOBS = 'blobs';

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
      // Fallback blob store if OPFS is flaky
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

export async function mkdir(path) {
  const { parent, name } = splitPath(path);
  assertName(name);
  const pid = await dirId(parent);

  const existing = await idbIndexGet('pid_name', [pid, name]);
  if (existing) {
    if (existing.kind === 'dir') return existing.id;
    throw new Error('EEXIST: ' + path);
  }

  const id = crypto.randomUUID();
  await idbPut({ id, pid, name, kind: 'dir', mtime: Date.now() });
  emit('change', parent);
  return id;
}

export async function write(path, data) {
  const { parent, name } = splitPath(path);
  assertName(name);
  const pid = await dirId(parent);
  const blob = data instanceof Blob ? data : new Blob([data]);

  let node = await idbIndexGet('pid_name', [pid, name]);
  if (node?.kind === 'dir') throw new Error('EISDIR: ' + path);
  node = node
    ? { ...node, size: blob.size, mtime: Date.now() }
    : { id: crypto.randomUUID(), pid, name, kind: 'file', size: blob.size, mtime: Date.now() };

  await writeBlob(node.id, blob);
  await idbPut(node);
  emit('change', parent);
  return node.id;
}

export async function read(path) {
  const node = await getNode(path);
  if (!node) throw new Error('ENOENT: ' + path);
  if (node.kind === 'dir') throw new Error('EISDIR: ' + path);
  return readBlob(node);
}

async function removeNode(node) {
  if (node.kind === 'dir') {
    for (const child of await idbIndexAll('pid', node.id)) await removeNode(child);
  } else {
    try { await opfsBlobs.removeEntry(node.id); } catch { /* already gone */ }
  }
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

  const { parent: dstParent, name: dstName } = splitPath(d);
  assertName(dstName);
  const dstPid = await dirId(dstParent);

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

  if (srcNode.kind === 'dir' && d.startsWith(s + '/')) {
    throw new Error('EINVAL: cannot copy a folder into itself');
  }
  if (await idbIndexGet('pid_name', [dstPid, dstName])) throw new Error('EEXIST: ' + dst);

  await copyNode(srcNode, dstPid, dstName);
  emit('change', dstParent);
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
