/* ============================================================
   Streaming ZIP writer — pure, no DOM, no messaging.

   Usable from a Worker or the main thread. Produces a valid ZIP
   incrementally: headers, data chunks, then central directory,
   then EOCD. The output is an array of Uint8Array chunks that can
   be assembled with `new Blob(chunks)` (a lazy composite — no copy).

   Every entry uses a *data descriptor* (flags bit 3), so the caller
   never has to pre-scan a file to know its CRC or compressed size.
   This is what makes unknown-length streaming safe.

   Methods:
     STORED  (0) — raw bytes. Use for already-compressed content
                   (video, images, archives, PDFs). Fast: no CPU.
     DEFLATE (8) — native CompressionStream('deflate-raw'). Use for
                   text. Async, but 20-50× faster than zipSync(level 6).

   Limits:
     · 4 GB per entry (Zip64 not implemented)
     · 4 GB per archive (ditto)
     · 65,535 entries (standard EOCD record)
   ============================================================ */

const SIG_LOCAL   = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD    = 0x06054b50;
const SIG_DESC    = 0x08074b50;
const FLAG_UTF8      = 0x0800;
const FLAG_DATA_DESC = 0x0008;
const METHOD_STORED  = 0;
const METHOD_DEFLATE = 8;
const MAX_32 = 0xffffffff;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function updateCrc(crc, bytes) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

const enc = new TextEncoder();

export const ZIP_METHOD = Object.freeze({
  STORED: METHOD_STORED,
  DEFLATE: METHOD_DEFLATE
});

export class ZipWriter {
  constructor() {
    this._chunks = [];
    this._central = [];
    this._offset = 0;
    this._state = null;
    this._closed = false;
  }

  /**
   * Start an entry.
   * @param {string} name    — path inside the archive (forward slashes)
   * @param {number} method  — ZIP_METHOD.STORED or ZIP_METHOD.DEFLATE
   */
  async addStart(name, method = METHOD_STORED) {
    if (this._closed) throw new Error('ZipWriter: already finished');
    if (this._state) throw new Error('ZipWriter: previous entry not ended');
    if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
      throw new Error('ZipWriter: unknown method ' + method);
    }

    const nameBytes = enc.encode(name);
    const flags = FLAG_UTF8 | FLAG_DATA_DESC;
    const offset = this._offset;

    // Local file header (30 bytes) — crc/sizes are zero because of bit 3.
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, SIG_LOCAL, true);
    lh.setUint16(4, 20, true);                // version needed 2.0
    lh.setUint16(6, flags, true);
    lh.setUint16(8, method, true);
    lh.setUint16(10, 0, true);                // mtime
    lh.setUint16(12, 0, true);                // mdate
    lh.setUint32(14, 0, true);                // crc (deferred)
    lh.setUint32(18, 0, true);                // csize (deferred)
    lh.setUint32(22, 0, true);                // usize (deferred)
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);

    this._push(new Uint8Array(lh.buffer));
    this._push(nameBytes);

    const state = {
      name: nameBytes, method, offset, flags,
      crc: 0xffffffff, csize: 0, usize: 0,
      writer: null, readerLoop: null
    };

    if (method === METHOD_DEFLATE) {
      if (typeof CompressionStream === 'undefined') {
        throw new Error('ZipWriter: CompressionStream unavailable in this browser');
      }
      const cs = new CompressionStream('deflate-raw');
      state.writer = cs.writable.getWriter();
      const reader = cs.readable.getReader();
      // Run the reader in parallel; every compressed chunk appends to output.
      state.readerLoop = (async () => {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          this._push(value, true);
          state.csize += value.byteLength;
        }
      })();
    }

    this._state = state;
  }

  /**
   * Feed a chunk of uncompressed data. May be called many times per entry.
   * For STORED entries, the chunk is appended directly (no copy — caller
   * must not reuse the buffer after this call).
   */
  async addChunk(bytes) {
    const s = this._state;
    if (!s) throw new Error('ZipWriter: no active entry');
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    s.crc = updateCrc(s.crc, u8);
    s.usize += u8.byteLength;
    if (s.method === METHOD_DEFLATE) {
      await s.writer.write(u8);
    } else {
      this._push(u8, true);
      s.csize += u8.byteLength;
    }
  }

  /** Finish the current entry: write the data descriptor, record for the central directory. */
  async addEnd() {
    const s = this._state;
    if (!s) throw new Error('ZipWriter: no active entry');
    this._state = null;

    if (s.method === METHOD_DEFLATE) {
      await s.writer.close();
      await s.readerLoop;
    }

    if (s.usize > MAX_32 || s.csize > MAX_32) {
      throw new Error('ZipWriter: entry over 4 GB — Zip64 not supported');
    }

    const crc = (s.crc ^ 0xffffffff) >>> 0;

    const dd = new DataView(new ArrayBuffer(16));
    dd.setUint32(0, SIG_DESC, true);
    dd.setUint32(4, crc, true);
    dd.setUint32(8, s.csize, true);
    dd.setUint32(12, s.usize, true);
    this._push(new Uint8Array(dd.buffer));

    this._central.push({
      name: s.name, crc, csize: s.csize, usize: s.usize,
      offset: s.offset, method: s.method, flags: s.flags
    });
  }

  /** Write the central directory and EOCD. Returns the output chunk array. */
  finish() {
    if (this._closed) return this._chunks;
    if (this._state) throw new Error('ZipWriter: entry not ended');
    this._closed = true;

    const cdStart = this._offset;
    for (const e of this._central) {
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, SIG_CENTRAL, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, e.flags, true);
      ch.setUint16(10, e.method, true);
      ch.setUint16(12, 0, true);
      ch.setUint16(14, 0, true);
      ch.setUint32(16, e.crc, true);
      ch.setUint32(20, e.csize, true);
      ch.setUint32(24, e.usize, true);
      ch.setUint16(28, e.name.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, e.offset, true);
      this._push(new Uint8Array(ch.buffer));
      this._push(e.name);
    }
    const cdSize = this._offset - cdStart;
    if (cdStart > MAX_32 || cdSize > MAX_32) {
      throw new Error('ZipWriter: archive over 4 GB — Zip64 not supported');
    }

    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, SIG_EOCD, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, this._central.length, true);
    eocd.setUint16(10, this._central.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, cdStart, true);
    eocd.setUint16(20, 0, true);
    this._push(new Uint8Array(eocd.buffer));

    return this._chunks;
  }

  /** Total bytes written so far (headers + data + descriptors). */
  get bytesWritten() { return this._offset; }

  /** Detach a fresh view from a shared backing buffer. */
  _push(bytes, owned = false) {
    const u8 = owned ? bytes : bytes.slice();
    this._chunks.push(u8);
    this._offset += u8.byteLength;
  }
}
