/* ============================================================
   Boot stage checks — pure and side-effect-light enough to test.
   Each returns mkResult({ key, label, code, message, ms }).
   The caller (boot.js) is responsible for timeouts and UI;
   HANG is never produced here, only by the orchestrator.
   ============================================================ */

import { BootCode, mkResult } from './boot-codes.js';
import { SYSTEM_APPS_DIR } from './vfs.js';

const REQUIRED_DOM = [
  '#desktop', '#desktop-icons', '#window-layer',
  '#panel', '#tasklist', '#apps-menu', '#apps-grid', '#dialog-layer', '#toast-layer'
];

/** Every root element the shell needs, and every one is present. */
export function checkDom() {
  const t0 = performance.now();
  const missing = REQUIRED_DOM.filter((sel) => !document.querySelector(sel));
  const ms = performance.now() - t0;
  if (missing.length) {
    return mkResult('dom', 'DOM shell', BootCode.FAILURE,
      `Missing element${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, ms);
  }
  return mkResult('dom', 'DOM shell', BootCode.OK,
    `${REQUIRED_DOM.length} root elements present`, ms);
}

/** localStorage and IndexedDB exist and localStorage is writable. */
export function checkStorage() {
  const t0 = performance.now();
  if (typeof localStorage === 'undefined') {
    return mkResult('storage', 'Web Storage', BootCode.FAILURE,
      'localStorage is unavailable (private-browsing mode with storage disabled?)', performance.now() - t0);
  }
  if (typeof indexedDB === 'undefined') {
    return mkResult('storage', 'IndexedDB', BootCode.FAILURE,
      'IndexedDB is unavailable in this browser context', performance.now() - t0);
  }
  try {
    const k = '__os16_boot_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
  } catch (e) {
    return mkResult('storage', 'Web Storage', BootCode.FAILURE,
      `Cannot write to localStorage: ${e.message || e}`, performance.now() - t0);
  }
  return mkResult('storage', 'Web Storage + IndexedDB', BootCode.OK,
    'Both writable', performance.now() - t0);
}

/** vfs.mount() resolves. */
export async function checkVfsMount(vfs) {
  const t0 = performance.now();
  try {
    await vfs.mount();
    return mkResult('vfs', 'Virtual file system', BootCode.OK,
      'OPFS + IndexedDB mounted', performance.now() - t0);
  } catch (e) {
    const msg = String(e?.message || e);
    const hint = /OPFS/i.test(msg) ? ' — OPFS may be unavailable in this browser context' : '';
    return mkResult('vfs', 'Virtual file system', BootCode.FAILURE,
      msg + hint, performance.now() - t0);
  }
}

/** Disk has a usable capacity and is not effectively full. */
export async function checkDisk(vfs) {
  const t0 = performance.now();
  let u;
  try { u = await vfs.usage(); }
  catch (e) {
    return mkResult('disk', 'Virtual disk', BootCode.FAILURE,
      `Cannot read disk usage: ${e.message || e}`, performance.now() - t0);
  }
  const ms = performance.now() - t0;
  if (!u.capacity || u.capacity <= 0) {
    return mkResult('disk', 'Virtual disk', BootCode.FAILURE,
      'Reported capacity is zero (browser refused to grant storage)', ms);
  }
  const usedPct = u.used / u.capacity;
  if (u.free <= 0) {
    return mkResult('disk', 'Virtual disk', BootCode.DISK_FULL,
      `Disk is 100% full (${formatBytes(u.used)} used of ${formatBytes(u.capacity)}) — new files cannot be saved`, ms);
  }
  if (u.free < 50 * 1024 ** 2) {
    return mkResult('disk', 'Virtual disk', BootCode.DISK_FULL,
      `Only ${formatBytes(u.free)} left (${(usedPct * 100).toFixed(1)}% used) — saving large files may fail`, ms);
  }
  return mkResult('disk', 'Virtual disk', BootCode.OK,
    `${formatBytes(u.free)} free of ${formatBytes(u.capacity)}`, ms);
}

/** seed() resolves. Its side effects are the point. */
export async function checkSeed(seedFn) {
  const t0 = performance.now();
  try {
    await seedFn();
    return mkResult('seed', 'System files', BootCode.OK,
      'Seed data present', performance.now() - t0);
  } catch (e) {
    return mkResult('seed', 'System files', BootCode.FAILURE,
      String(e?.message || e), performance.now() - t0);
  }
}

/** Every app object registered in the OS has the shape the WM needs. */
export function checkApps(apps) {
  const t0 = performance.now();
  const problems = [];
  const seen = new Set();
  for (const app of apps) {
    const id = app?.id;
    if (!id) { problems.push('an app has no id'); continue; }
    if (seen.has(id)) problems.push(`duplicate id “${id}”`);
    else seen.add(id);
    if (!app.name) problems.push(`“${id}” has no name`);
    if (!app.icon) problems.push(`“${id}” has no icon`);
    if (typeof app.launch !== 'function') problems.push(`“${id}” has no launch()`);
  }
  const ms = performance.now() - t0;
  if (problems.length) {
    const head = problems.slice(0, 3).join('; ');
    const tail = problems.length > 3 ? `…and ${problems.length - 3} more` : '';
    return mkResult('apps', 'App registry', BootCode.FAILURE,
      `${problems.length} problem${problems.length > 1 ? 's' : ''}: ${head}${tail}`, ms);
  }
  return mkResult('apps', 'App registry', BootCode.OK,
    `${apps.length} app${apps.length === 1 ? '' : 's'} registered`, ms);
}

/**
 * Ensure /home/user/SYSTEM APPS exists (protected) and holds one entry per
 * registered app. Populates missing entries; leaves stale entries alone —
 * they're harmless (opening one explains the app is gone) and removing them
 * would need a force-delete path that isn't worth adding for a corner case.
 */
export async function checkSystemApps(vfs, apps) {
  const t0 = performance.now();
  try {
    if (!(await vfs.exists(SYSTEM_APPS_DIR))) {
      await vfs.mkdir(SYSTEM_APPS_DIR, { protected: true });
    } else {
      const st = await vfs.stat(SYSTEM_APPS_DIR);
      if (st.kind !== 'dir') {
        return mkResult('sysapps', 'System apps', BootCode.FAILURE,
          `${SYSTEM_APPS_DIR} exists but is not a folder`, performance.now() - t0);
      }
    }

    for (const app of apps) {
      if (!app?.id || !app?.name) continue;
      await vfs.writeApp(`${SYSTEM_APPS_DIR}/${app.name}`, app.id, { protected: true });
    }

    const entries = await vfs.list(SYSTEM_APPS_DIR);
    const presentIds = new Set(entries.filter((e) => e.kind === 'app').map((e) => e.appId));
    const missing = apps.filter((a) => a?.id && !presentIds.has(a.id));
    if (missing.length) {
      return mkResult('sysapps', 'System apps', BootCode.FAILURE,
        `${missing.length} app${missing.length === 1 ? '' : 's'} missing from SYSTEM APPS: ` +
        missing.slice(0, 3).map((a) => a.name).join(', ') + (missing.length > 3 ? '…' : ''),
        performance.now() - t0);
    }

    return mkResult('sysapps', 'System apps', BootCode.OK,
      `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in SYSTEM APPS`, performance.now() - t0);
  } catch (e) {
    return mkResult('sysapps', 'System apps', BootCode.FAILURE,
      String(e?.message || e), performance.now() - t0);
  }
}

/** The shell (panel + desktop) actually built. `initFn` registers apps, runs initPanel(), awaits initDesktop(). */
export async function checkShell(initFn) {
  const t0 = performance.now();
  try {
    await initFn();
  } catch (e) {
    return mkResult('shell', 'Desktop shell', BootCode.FAILURE,
      String(e?.message || e), performance.now() - t0);
  }
  const appsGrid = document.querySelector('#apps-grid');
  const deskIcons = document.querySelector('#desktop-icons');
  if (!appsGrid?.children.length) {
    return mkResult('shell', 'Desktop shell', BootCode.FAILURE,
      'Apps menu did not populate', performance.now() - t0);
  }
  if (!deskIcons?.children.length) {
    return mkResult('shell', 'Desktop shell', BootCode.FAILURE,
      'Desktop icons did not render', performance.now() - t0);
  }
  return mkResult('shell', 'Desktop shell', BootCode.OK,
    `${appsGrid.children.length} apps in menu, ${deskIcons.children.length} desktop icons`,
    performance.now() - t0);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return parseFloat((bytes / 1024 ** i).toFixed(1)) + ' ' + units[i];
}
