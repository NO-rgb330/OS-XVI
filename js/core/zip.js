/* ============================================================
   Zip reader — dependency-free, browser-native.
   Reads the central directory (including Zip64), then inflates
   individual entries on demand with DecompressionStream.

   Entries are verified (size + CRC-32) and bounded by the sizes the
   archive declares, so a lying header can't inflate past its claim.
   Blobs are sliced, never read whole, so large archives stay cheap.
   Pure: no filesystem or DOM access.
   ============================================================ */

export class ZipError extends Error {}

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_LOC64 = 0x07064b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;
const MAX_CD_BYTES = 256 * 1024 * 1024;

// ---- CRC-32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crcUpdate(crc, buf) {
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

const big = (v, o) => Number(v.getBigUint64(o, true));
const view = async (blob, start, end) => new DataView(await blob.slice(start, end).arrayBuffer());

function decodeName(bytes, flags) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* not UTF-8 */ }
  if (flags & 0x800) return new TextDecoder().decode(bytes);
  return new TextDecoder('windows-1252').decode(bytes);   // legacy archives
}

/**
 * Parse an archive.
 * Returns [{ name, isDir, isSymlink, method, flags, crc, csize, usize, offset }].
 */
export async function listZip(blob) {
  const size = blob.size;
  if (size < 22) throw new ZipError('This isn’t a zip archive.');

  // End-of-central-directory record: scan backwards through the (possibly commented) tail.
  const tailLen = Math.min(size, 22 + 0xffff);
  const tailStart = size - tailLen;
  const tail = await view(blob, tailStart, size);
  let at = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD && i + 22 + tail.getUint16(i + 20, true) <= tailLen) { at = i; break; }
  }
  if (at < 0) throw new ZipError('This isn’t a valid zip archive (no end-of-archive record).');

  let count = tail.getUint16(at + 10, true);
  let cdSize = tail.getUint32(at + 12, true);
  let cdOffset = tail.getUint32(at + 16, true);

  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {   // Zip64
    const abs = tailStart + at;
    if (abs < 20) throw new ZipError('Corrupt Zip64 archive.');
    const loc = await view(blob, abs - 20, abs);
    if (loc.getUint32(0, true) !== SIG_LOC64) throw new ZipError('Corrupt Zip64 archive.');
    const rec64 = big(loc, 8);
    const rec = await view(blob, rec64, rec64 + 56);
    if (rec.byteLength < 56 || rec.getUint32(0, true) !== SIG_EOCD64) throw new ZipError('Corrupt Zip64 archive.');
    count = big(rec, 32);
    cdSize = big(rec, 40);
    cdOffset = big(rec, 48);
  }

  if (cdSize > MAX_CD_BYTES || cdOffset + cdSize > size) throw new ZipError('The archive’s directory is damaged.');
  const cd = await view(blob, cdOffset, cdOffset + cdSize);
  const raw = new Uint8Array(cd.buffer);
  const entries = [];
  let p = 0;

  for (let n = 0; n < count; n++) {
    if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== SIG_CEN) throw new ZipError('The archive’s directory is damaged.');
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    const crc = cd.getUint32(p + 16, true);
    let csize = cd.getUint32(p + 20, true);
    let usize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const extAttr = cd.getUint32(p + 38, true);
    let offset = cd.getUint32(p + 42, true);
    const nameStart = p + 46;
    if (nameStart + nameLen + extraLen + commentLen > cd.byteLength) throw new ZipError('The archive’s directory is damaged.');
    const name = decodeName(raw.subarray(nameStart, nameStart + nameLen), flags);

    // Zip64 extended information: only the fields that overflowed are present, in this order.
    for (let x = nameStart + nameLen, end = x + extraLen; x + 4 <= end;) {
      const id = cd.getUint16(x, true), len = cd.getUint16(x + 2, true);
      if (id === 0x0001) {
        let q = x + 4;
        if (usize === 0xffffffff && q + 8 <= x + 4 + len) { usize = big(cd, q); q += 8; }
        if (csize === 0xffffffff && q + 8 <= x + 4 + len) { csize = big(cd, q); q += 8; }
        if (offset === 0xffffffff && q + 8 <= x + 4 + len) { offset = big(cd, q); }
      }
      x += 4 + len;
    }

    const unixMode = (extAttr >>> 16) & 0xf000;
    entries.push({
      name, flags, method, crc, csize, usize, offset,
      isDir: name.endsWith('/') || name.endsWith('\\'),
      isSymlink: unixMode === 0xa000
    });
    p = nameStart + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Turn an archive path into safe name segments, or null if it must be rejected.
 * Blocks absolute paths and "..", the classic zip-slip attack.
 */
export function safeSegments(name) {
  const parts = name.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
  if (!parts.length || parts.includes('..')) return null;
  return parts;
}

/** Inflate and verify one entry. Returns a Blob. Throws ZipError on any problem. */
export async function readEntry(blob, e) {
  if (e.flags & 0x41) throw new ZipError('it is password-protected');
  if (e.method !== 0 && e.method !== 8) throw new ZipError(`it uses an unsupported compression method (${e.method})`);
  if (e.method === 8 && typeof DecompressionStream === 'undefined') {
    throw new ZipError('this browser can’t decompress zip files');
  }

  const head = await view(blob, e.offset, e.offset + 30);
  if (head.byteLength < 30 || head.getUint32(0, true) !== SIG_LOC) throw new ZipError('its header is damaged');
  const start = e.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
  if (start + e.csize > blob.size) throw new ZipError('the archive is truncated');
  const raw = blob.slice(start, start + e.csize);

  let stream = raw.stream();
  if (e.method === 8) stream = stream.pipeThrough(new DecompressionStream('deflate-raw'));

  const keep = e.method === 8;          // stored data is already a lazy slice; no need to hold it twice
  const chunks = [];
  let total = 0, crc = 0xffffffff;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > e.usize) throw new ZipError('it is larger than the archive says');   // bounds a zip bomb
      crc = crcUpdate(crc, value);
      if (keep) chunks.push(value);
    }
  } catch (err) {
    reader.cancel().catch(() => {});
    throw err instanceof ZipError ? err : new ZipError('its compressed data is damaged');
  }
  if (total !== e.usize) throw new ZipError('its size doesn’t match the archive');
  if (((crc ^ 0xffffffff) >>> 0) !== e.crc) throw new ZipError('it failed its checksum (the file is corrupt)');
  return keep ? new Blob(chunks) : raw;
}
