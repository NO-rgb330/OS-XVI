#!/usr/bin/env node
/* ============================================================
   Monochrome OS — local hardware helper (optional)

   A web page can't read your CPU model, laptop model, memory type or
   free RAM: browsers deliberately hide them. This tiny helper runs on
   YOUR computer, reads them with the operating system's own tools, and
   serves them to the OS's `sysinfo` terminal command.

   Run:      node tools/sysinfo-agent.js
   Options:  --port 8787              (default 8787)
             --allow-origin <origin>  (also accept this site, e.g. https://me.github.io)

   Safety:   · listens on 127.0.0.1 only (not reachable from other machines)
             · read-only: it never writes, deletes or runs anything you send it
             · answers only pages on localhost, or origins you pass with --allow-origin
             · Host header is checked (DNS-rebinding protection)
             · no hostname, serial numbers, usernames or IP addresses are collected
   Needs:    Node 16+, no packages. Works on Windows, macOS and Linux.
   ============================================================ */
'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

// ---------- Pure parsers (exported for tests) ----------

/** SMBIOS "Memory Device" type codes (decimal, as Windows reports them). */
const SMBIOS_TYPES = {
  18: 'DDR', 19: 'DDR2', 20: 'DDR2 FB-DIMM', 24: 'DDR3', 26: 'DDR4', 27: 'LPDDR', 28: 'LPDDR2',
  29: 'LPDDR3', 30: 'LPDDR4', 32: 'HBM', 33: 'HBM2', 34: 'DDR5', 35: 'LPDDR5', 36: 'HBM3'
};
const smbiosType = (n) => SMBIOS_TYPES[Number(n)] || null;

/** Linux /proc/meminfo → bytes available (MemAvailable). */
function parseMeminfo(text) {
  const m = /^MemAvailable:\s+(\d+)\s+kB/m.exec(text || '');
  return m ? Number(m[1]) * 1024 : null;
}

/** macOS vm_stat → bytes that can be reclaimed without swapping (free + inactive + speculative). */
function parseVmStat(text) {
  if (!text) return null;
  const page = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
  if (!page) return null;
  const pages = (label) => Number(new RegExp(`^${label}:\\s+(\\d+)`, 'm').exec(text)?.[1] || 0);
  return (pages('Pages free') + pages('Pages inactive') + pages('Pages speculative')) * page;
}

/** `dmidecode -t 17` → [{ sizeBytes, type, speedMTs, vendor }] for populated slots. */
function parseDmidecode(text) {
  const modules = [];
  for (const block of String(text || '').split(/\n\s*\n/)) {
    if (!/Memory Device/.test(block)) continue;
    const field = (name) => new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm').exec(block)?.[1].trim();
    const size = /^(\d+)\s*(MB|GB|TB)$/i.exec(field('Size') || '');
    if (!size) continue; // "No Module Installed"
    const mult = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[size[2].toUpperCase()];
    const speed = /(\d+)/.exec(field('Configured Memory Speed') || field('Configured Clock Speed') || field('Speed') || '');
    const type = field('Type');
    modules.push({
      sizeBytes: Number(size[1]) * mult,
      type: type && !/unknown|other/i.test(type) ? type : null,
      speedMTs: speed ? Number(speed[1]) : null,
      vendor: clean(field('Manufacturer'))
    });
  }
  return modules;
}

/** Placeholder strings OEMs leave in firmware. */
function clean(s) {
  if (!s) return null;
  s = String(s).trim();
  return !s || /^(not specified|unknown|to be filled by o\.?e\.?m\.?|default string|system (product name|version|manufacturer)|none|0)$/i.test(s) ? null : s;
}

/** macOS system_profiler SPMemoryDataType JSON → modules (handles Apple Silicon and Intel layouts). */
function parseMacMemory(json) {
  const modules = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.dimm_type && !/empty/i.test(node.dimm_type)) {
      const size = /(\d+)\s*(MB|GB)/i.exec(node.dimm_size || node.SPMemoryDataType || '');
      const speed = /(\d+)/.exec(node.dimm_speed || '');
      modules.push({
        sizeBytes: size ? Number(size[1]) * (/gb/i.test(size[2]) ? 1024 ** 3 : 1024 ** 2) : null,
        type: node.dimm_type, speedMTs: speed ? Number(speed[1]) : null, vendor: clean(node.dimm_manufacturer)
      });
    }
    for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(walk);
  };
  walk(json);
  return modules;
}

// ---------- Running OS tools ----------

const run = (cmd, argv, timeout = 15000) => new Promise((resolve) => {
  execFile(cmd, argv, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : String(stdout)));
});

const ps = (script) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
async function psJson(script) {
  const out = await ps(script + ' | ConvertTo-Json -Compress');
  try { const v = JSON.parse(out); return Array.isArray(v) ? v : [v]; } catch { return []; }
}
const readFile = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } };

// ---------- Collectors (static facts, gathered once at start-up) ----------

async function collectWindows() {
  const [cs, prod, mem, osr] = await Promise.all([
    psJson('Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,SystemFamily'),
    psJson('Get-CimInstance Win32_ComputerSystemProduct | Select-Object Version'),
    psJson('Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed,SMBIOSMemoryType,Manufacturer'),
    psJson('Get-CimInstance Win32_OperatingSystem | Select-Object Caption')
  ]);
  const notes = {};
  const modules = mem.map((m) => ({
    sizeBytes: Number(m.Capacity) || null,
    type: smbiosType(m.SMBIOSMemoryType),
    speedMTs: Number(m.ConfiguredClockSpeed) || Number(m.Speed) || null,
    vendor: clean(m.Manufacturer)
  }));
  if (!mem.length) notes.memoryType = 'Windows did not return memory module details.';
  const c = cs[0] || {};
  const friendly = clean(prod[0]?.Version); // Lenovo stores "ThinkPad X1 Carbon Gen 9" here
  return {
    os: { name: clean(osr[0]?.Caption)?.replace(/^Microsoft\s+/i, '') || 'Windows' },
    machine: { vendor: clean(c.Manufacturer), model: friendly && friendly !== clean(c.Model) ? `${friendly} (${clean(c.Model)})` : clean(c.Model) || clean(c.SystemFamily) },
    modules, notes
  };
}

async function collectMac() {
  const [hwText, memText, ver] = await Promise.all([
    run('system_profiler', ['SPHardwareDataType', '-json']),
    run('system_profiler', ['SPMemoryDataType', '-json']),
    run('sw_vers', ['-productVersion'])
  ]);
  let hw = {};
  try { hw = JSON.parse(hwText).SPHardwareDataType[0] || {}; } catch { /* keep empty */ }
  let modules = [];
  try { modules = parseMacMemory(JSON.parse(memText)); } catch { /* keep empty */ }
  const name = clean(hw.machine_name) || clean(hw.model_name);
  const id = clean(hw.machine_model) || clean(hw.model_identifier);
  return {
    os: { name: `macOS ${(ver || '').trim()}`.trim() },
    machine: { vendor: 'Apple', model: name && id ? `${name} (${id})` : name || id },
    chip: clean(hw.chip_type),
    modules, notes: modules.length ? {} : { memoryType: 'macOS did not return memory module details.' }
  };
}

async function collectLinux() {
  const dmi = (f) => clean(readFile(`/sys/class/dmi/id/${f}`));
  const vendor = dmi('sys_vendor');
  const name = dmi('product_name');
  const version = dmi('product_version'); // ThinkPad: "ThinkPad X1 Carbon Gen 9"
  const model = version && version !== name ? `${version} (${name})` : name;
  const release = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(readFile('/etc/os-release') || '')?.[1];

  const notes = {};
  let modules = parseDmidecode(await run('dmidecode', ['-t', '17']));
  if (!modules.length) {
    notes.memoryType = 'Linux only allows root to read memory type. Restart the helper with: sudo node tools/sysinfo-agent.js';
  }
  if (!model) notes.machine = 'This machine does not publish a model name (common in VMs and containers).';
  return { os: { name: release || 'Linux' }, machine: { vendor, model }, modules, notes };
}

async function collectStatic() {
  const platform = process.platform;
  const part = platform === 'win32' ? await collectWindows() : platform === 'darwin' ? await collectMac() : await collectLinux();
  const cpus = os.cpus();
  const types = [...new Set(part.modules.map((m) => m.type).filter(Boolean))];
  const speeds = part.modules.map((m) => m.speedMTs).filter(Boolean);
  return {
    platform,
    os: { name: part.os.name, arch: os.arch() },
    cpu: { model: (cpus[0]?.model || part.chip || '').replace(/\s+/g, ' ').trim() || null, threads: cpus.length, speedMHz: cpus[0]?.speed || null },
    machine: part.machine,
    memory: {
      totalBytes: os.totalmem(),
      type: types.join(' / ') || null,
      speedMTs: speeds.length ? Math.max(...speeds) : null,
      modules: part.modules
    },
    notes: part.notes
  };
}

/** Memory that applications could use right now. */
async function availableMemory() {
  if (process.platform === 'linux') return parseMeminfo(readFile('/proc/meminfo')) ?? os.freemem();
  if (process.platform === 'darwin') return parseVmStat(await run('vm_stat', [], 5000)) ?? os.freemem();
  return os.freemem(); // Windows: free physical memory as the OS defines it
}

// ---------- HTTP server ----------

function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
  const PORT = Number(opt('--port', 8787));
  const EXTRA = args.flatMap((a, i) => (a === '--allow-origin' && args[i + 1] ? [args[i + 1].replace(/\/$/, '')] : []));

  const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  const originAllowed = (o) => LOOPBACK_ORIGIN.test(o) || EXTRA.includes(o);

  console.log('Reading hardware details (Windows can take a few seconds)…');
  const staticInfo = collectStatic();

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const send = (code, body, headers = {}) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };

    if (!LOOPBACK_HOST.test((req.headers.host || '').toLowerCase())) return send(403, { error: 'bad host' });
    if (origin && !originAllowed(origin)) return send(403, { error: 'origin not allowed' });

    const cors = origin ? {
      'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '600'
    } : {};

    if (req.method === 'OPTIONS') return send(204, undefined, cors);
    if (req.method !== 'GET' || req.url.split('?')[0] !== '/sysinfo') return send(404, { error: 'not found' }, cors);

    try {
      const info = await staticInfo;
      const availableBytes = await availableMemory();
      send(200, { ok: true, version: 1, ...info, memory: { ...info.memory, availableBytes } }, cors);
    } catch (err) {
      send(500, { ok: false, error: String(err && err.message || err) }, cors);
    }
  });

  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use (is the helper already running?). Try: --port ${PORT + 1}`
      : err.message);
    process.exit(1);
  });
  server.listen(PORT, '127.0.0.1', async () => {
    await staticInfo.catch(() => {});
    console.log(`\nMonochrome OS hardware helper is running on http://127.0.0.1:${PORT}/sysinfo`);
    console.log('Now run  sysinfo  in the OS terminal.  Press Ctrl+C to stop.');
    if (EXTRA.length) console.log('Also allowing:', EXTRA.join(', '));
  });
}

if (require.main === module) main();
module.exports = { parseMeminfo, parseVmStat, parseDmidecode, parseMacMemory, smbiosType, clean };
