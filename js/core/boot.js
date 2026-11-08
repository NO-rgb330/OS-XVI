import { initPython } from './python-runtime.js';

export async function runBootSequence() {
  return new Promise(async (resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';
    overlay.id = 'boot-screen';
    
    const log = document.createElement('div');
    log.style.flex = '1';
    log.style.width = '100%';
    overlay.appendChild(log);
    
    const barWrap = document.createElement('div');
    barWrap.className = 'boot-bar-container';
    barWrap.innerHTML = '<div class="boot-bar-fill" id="boot-fill"></div>';
    overlay.appendChild(barWrap);

    document.body.appendChild(overlay);
    const fill = overlay.querySelector('#boot-fill');

    const print = (text, cls = '') => {
      const line = document.createElement('div');
      line.className = `boot-log ${cls}`;
      line.textContent = text;
      log.appendChild(line);
      overlay.scrollTop = overlay.scrollHeight;
    };

    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const randHex = (len) => Array.from({length: len}, () => Math.floor(Math.random()*16).toString(16)).join('');
    
    // Start loading Python in the background
    print('[    1.000000] Starting Python WASM Runtime...', 'boot-warn');
    const pyPromise = initPython().then(() => {
      print('[    1.200000] Python runtime loaded successfully.', 'boot-ok');
    }).catch(err => {
      print(`[    1.200000] Failed to load Python: ${err.message}`, 'boot-warn');
    });

    const steps = [
      { t: '[    0.000000] Booting Kernel', d: 200, c: 'boot-ok' },
      { t: '[    0.120512] Initializing OPFS', d: 400 },
      { t: '[    0.451223] Mounting root filesystem on /dev/vopfs0', d: 300, c: 'boot-ok' },
      { t: `[    0.512111] EXT4-fs (vopfs0): mounted filesystem with ordered data mode. Opts: (null)`, d: 150 },
      { t: `[    0.812111] random: crng init done`, d: 100 },
      { t: `[    1.104511] systemd[1]: System time before build time, advancing clock.`, d: 200 },
      { t: `[    1.231111] systemd[1]: Detected architecture x86-64.`, d: 150 },
      { t: `[    1.412412] systemd[1]: Set hostname to <blank>.`, d: 100 },
      { t: `[    2.001511] systemd[1]: Started Journal Service.`, d: 250, c: 'boot-ok' },
      { t: `[    2.112111] systemd[1]: Starting Load Kernel Modules...`, d: 200 },
      { t: `[    2.451111] systemd[1]: Started Load Kernel Modules.`, d: 100, c: 'boot-ok' },
      { t: `[    3.001511] systemd[1]: Mounting /home...`, d: 300 },
      { t: `[    3.351111] systemd[1]: Mounted /home.`, d: 100, c: 'boot-ok' },
      { t: `[    4.112111] systemd[1]: Starting Window Manager...`, d: 400 },
      { t: `[    4.555511] systemd[1]: Started Window Manager.`, d: 200, c: 'boot-ok' },
      { t: `[    5.110000] systemd[1]: Starting VFS Cache Service...`, d: 250 },
      { t: `[    5.123511] [drm] Initialized i915 1.6.0 20201103 for 0000:00:02.0 on minor 0`, d: 150 },
      { t: `[    5.551111] systemd[1]: Started VFS Cache Service.`, d: 100, c: 'boot-ok' },
      { t: `[    6.112111] random: crng init done`, d: 100 },
      { t: `[    6.512111] ip_tables: bad magic number: aborted`, d: 150 },
      { t: `[    7.001511] systemd[1]: Reached target Multi-User System.`, d: 300, c: 'boot-ok' },
      { t: `[    7.451111] systemd[1]: Reached target Graphical Interface.`, d: 200, c: 'boot-ok' },
      { t: `[    8.123111] starting version 250.5+`, d: 300 },
      { t: `[    8.512111] [  0.000000]  #${randHex(8)}  #${randHex(8)}  #${randHex(8)}  #${randHex(8)}`, d: 150, c: 'boot-warn' },
    ];

    let progress = 0;
    for (const s of steps) {
      print(s.t, s.c);
      progress = Math.min(90, progress + (100 / steps.length));
      fill.style.width = progress + '%';
      await wait(s.d);
    }
    
    // Wait for Python to finish loading before showing login
    print(`[    9.000000] Waiting for background services...`, 'boot-warn');
    await pyPromise;
    
    print(`[    9.111111] Starting Login Manager...`, 'boot-ok');
    fill.style.width = '100%';
    await wait(600);
    
    overlay.remove();
    resolve();
  });
}
