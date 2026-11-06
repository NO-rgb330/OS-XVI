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
let opfsRoot = null;
let opfsBlobs = null;
const listeners = new Set();

// ---- Init ----
export async function mount() {
  // 1. Mount OPFS
  try {
    opfsRoot = await navigator.storage.getDirectory();
    opfsBlobs = await opfsRoot.getDirectoryHandle('.blobs', { create: true });
  } catch (err) {
    console.error('OPFS mount failed', err);
    throw new Error('OPFS not available');
  }

  // 2. Mount IndexedDB
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

  // Ensure root exists
  const root = await idbGet('root');
  if (!root) {
    await idbPut({
      id: 'root', pid: null, name: '', kind: 'dir', mtime: Date.now()
    });
  }
}

// ---- Event Bus ----
export function on(event, cb) {
  listeners.add({ event, cb });
  return () => {
    for (const l of listeners) {
      if (l.event === event && l.cb === cb) listeners.delete(l);
    }
  };
}
function emit(event, path) {
  for (const l of listeners) {
    if (l.event === event || l.event === '*') l.cb(path);
  }
}

// ---- Path & ID utilities ----
function normPath(p) {
  const parts = p.split('/').filter(Boolean);
  const stack = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

function splitPath(p) {
  const n = normPath(p);
  return { parent: n.substring(0, n.lastIndexOf('/')) || '/', name: n.substring(n.lastIndexOf('/') + 1) };
}

async function resolveId(path) {
  const n = normPath(path);
  if (n === '/') return 'root';
  const parts = n.split('/').filter(Boolean);
  let currentId = 'root';
  for (const part of parts) {
    const node = await idbGetFromIndex('pid_name', [currentId, part]);
    if (!node) return null;
    currentId = node.id;
  }
  return currentId;
}

async function getNode(path) {
  const id = await resolveId(path);
  if (!id) return null;
  return idbGet(id);
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
  const nodes = await idbGetAllFromIndex('pid', id);
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export async function mkdir(path) {
  const { parent, name } = splitPath(path);
  const pid = await resolveId(parent);
  if (!pid) throw new Error('ENOENT: ' + parent);
  
  const existing = await idbGetFromIndex('pid_name', [pid, name]);
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
  const pid = await resolveId(parent);
  if (!pid) throw new Error('ENOENT: ' + parent);

  let node = await idbGetFromIndex('pid_name', [pid, name]);
  const blob = data instanceof Blob ? data : new Blob([data]);

  if (!node) {
    node = {
      id: crypto.randomUUID(), pid, name, kind: 'file', 
      size: blob.size, mtime: Date.now()
    };
  } else {
    if (node.kind === 'dir') throw new Error('EISDIR: ' + path);
    node.size = blob.size;
    node.mtime = Date.now();
  }

  // Write Blob to OPFS
  const fileHandle = await opfsBlobs.getFileHandle(node.id, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  await idbPut(node);
  emit('change', parent);
  return node.id;
}

export async function read(path) {
  const node = await getNode(path);
  if (!node) throw new Error('ENOENT: ' + path);
  if (node.kind === 'dir') throw new Error('EISDIR: ' + path);
  
  try {
    const fileHandle = await opfsBlobs.getFileHandle(node.id);
    return await fileHandle.getFile();
  } catch (err) {
    // Fallback to IDB blobs if OPFS file is missing
    const fallback = await idbGetBlob(node.id);
    if (fallback) return fallback;
    throw new Error('EIO: Failed to read ' + path);
  }
}

export async function rm(path) {
  const node = await getNode(path);
  if (!node) return; // Idempotent
  
  const { parent } = splitPath(path);

  if (node.kind === 'dir') {
    const children = await list(path);
    for (const child of children) {
      await rm(path + (path === '/' ? '' : '/') + child.name);
    }
  } else {
    try { await opfsBlobs.removeEntry(node.id); } catch (e) {}
  }
  
  await idbDel(node.id);
  emit('change', parent);
}

export async function mv(src, dst) {
  const srcNode = await getNode(src);
  if (!srcNode) throw new Error('ENOENT: ' + src);
  
  const { parent: dstParent, name: dstName } = splitPath(dst);
  const dstPid = await resolveId(dstParent);
  if (!dstPid) throw new Error('ENOENT: ' + dstParent);

  // Prevent moving a directory into itself
  if (srcNode.kind === 'dir') {
    const dstId = await resolveId(dst);
    if (dstId === srcNode.id) throw new Error('EINVAL: Cannot move into self');
  }

  srcNode.pid = dstPid;
  srcNode.name = dstName;
  srcNode.mtime = Date.now();
  
  await idbPut(srcNode);
  emit('change', src.substring(0, src.lastIndexOf('/')) || '/');
  emit('change', dstParent);
}

export async function cp(src, dst) {
  const srcNode = await getNode(src);
  if (!srcNode) throw new Error('ENOENT: ' + src);

  const { parent: dstParent, name: dstName } = splitPath(dst);
  const dstPid = await resolveId(dstParent);
  if (!dstPid) throw new Error('ENOENT: ' + dstParent);

  if (srcNode.kind === 'dir') {
    await mkdir(dst);
    const children = await list(src);
    for (const child of children) {
      await cp(src + '/' + child.name, dst + '/' + child.name);
    }
  } else {
    const blob = await read(src);
    const newId = crypto.randomUUID();
    const fileHandle = await opfsBlobs.getFileHandle(newId, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    await idbPut({ id: newId, pid: dstPid, name: dstName, kind: 'file', size: blob.size, mtime: Date.now() });
  }
  emit('change', dstParent);
}

// ---- IndexedDB Helpers ----
function idbGet(key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_NODES).objectStore(STORE_NODES).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function idbPut(obj) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_NODES, 'readwrite').objectStore(STORE_NODES).put(obj);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function idbDel(key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_NODES, 'readwrite').objectStore(STORE_NODES).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function idbGetFromIndex(indexName, query) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_NODES).objectStore(STORE_NODES).index(indexName).get(query);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function idbGetAllFromIndex(indexName, query) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_NODES).objectStore(STORE_NODES).index(indexName).getAll(query);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function idbGetBlob(key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_BLOBS).objectStore(STORE_BLOBS).get(key);
    req.onsuccess = () => res(req.result ? req.result.data : null);
    req.onerror = () => rej(req.error);
  });
}
