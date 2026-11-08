import { iconHTML } from '../core/icons.js';
import { listWindows } from '../core/wm.js';
import * as vfs from '../core/vfs.js';
import { formatBytes } from '../core/util.js';

export const sysMonApp = {
  id: 'sysmon',
  name: 'System Monitor',
  icon: 'activity',
  defaultSize: [750, 550],

  launch(body, args, ctx) {
    let networkBytes = 0;
    let observer = null;

    body.innerHTML = `
      <div class="sm-app">
        <div class="app-toolbar">
          <span class="muted" style="font-size:11px; padding-left:8px;">Real-time Browser API Metrics</span>
        </div>
        <div class="sm-grid">
          
          <div class="sm-card">
            <div class="sm-card-header">
              <span>Memory Usage (JS Heap)</span>
              <span id="sm-mem-pct">0%</span>
            </div>
            <div class="sm-val" id="sm-mem-val">-- MB</div>
            <div class="sm-bar"><div class="sm-bar-fill" id="sm-mem-bar"></div></div>
            <div class="sm-sub" id="sm-mem-limit">Limit: -- MB</div>
          </div>

          <div class="sm-card">
            <div class="sm-card-header">
              <span>Network Traffic</span>
              <span id="sm-net-status">Online</span>
            </div>
            <div class="sm-val" id="sm-net-val">0 B</div>
            <div class="sm-sub" id="sm-net-speed">Downlink: Unknown</div>
            <div class="sm-sub" id="sm-net-rtt">Latency (RTT): Unknown</div>
          </div>

          <div class="sm-card">
            <div class="sm-card-header">
              <span>Virtual Disk (OPFS)</span>
              <span id="sm-disk-pct">0%</span>
            </div>
            <div class="sm-val" id="sm-disk-val">-- MB</div>
            <div class="sm-bar"><div class="sm-bar-fill" id="sm-disk-bar"></div></div>
            <div class="sm-sub" id="sm-disk-limit">Quota: -- GB</div>
          </div>

          <div class="sm-card">
            <div class="sm-card-header">
              <span>Hardware</span>
            </div>
            <div class="sm-val" id="sm-hw-cores">-- Cores</div>
            <div class="sm-sub" id="sm-hw-mem">RAM (approx): Unknown</div>
            <div class="sm-sub" id="sm-hw-platform">Platform: Unknown</div>
          </div>

          <div class="sm-processes">
            <div class="sm-process-header">
              <span>Process (Window)</span>
              <span>Status</span>
              <span>Simulated CPU</span>
              <span>Simulated RAM</span>
            </div>
            <div id="sm-proc-list"></div>
          </div>

        </div>
      </div>
    `;

    const $ = (s) => body.querySelector(s);

    // --- Network Monitor ---
    // Use PerformanceObserver to track actual bytes downloaded by the browser
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.transferSize) {
            networkBytes += entry.transferSize;
            updateNetworkUI();
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.warn('PerformanceObserver not supported', e);
    }

    function updateNetworkUI() {
      $('#sm-net-val').textContent = formatBytes(networkBytes);
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        $('#sm-net-speed').textContent = `Downlink: ~${conn.downlink || '?'} Mbps (${conn.effectiveType || '?'})`;
        $('#sm-net-rtt').textContent = `Latency (RTT): ~${conn.rtt || '?'} ms`;
        $('#sm-net-status').textContent = navigator.onLine ? 'Online' : 'Offline';
      } else {
        $('#sm-net-speed').textContent = 'Network API not supported';
      }
    }

    // --- Hardware Info ---
    $('#sm-hw-cores').textContent = `${navigator.hardwareConcurrency || '?'} Threads`;
    $('#sm-hw-mem').textContent = `RAM (approx): ~${navigator.deviceMemory || '?'} GB`;
    const uaData = navigator.userAgentData;
    $('#sm-hw-platform').textContent = uaData ? `Platform: ${uaData.platform}` : `Platform: ${navigator.platform}`;

    // --- Stats Loop ---
    async function updateStats() {
      // 1. Memory
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const pct = Math.round((used / limit) * 100);
        $('#sm-mem-val').textContent = formatBytes(used);
        $('#sm-mem-limit').textContent = `Limit: ${formatBytes(limit)}`;
        $('#sm-mem-pct').textContent = `${pct}%`;
        $('#sm-mem-bar').style.width = `${pct}%`;
      } else {
        $('#sm-mem-val').textContent = 'N/A';
        $('#sm-mem-limit').textContent = 'performance.memory not exposed by this browser.';
      }

      // 2. Disk
      try {
        const usage = await vfs.usage();
        const pct = Math.round((usage.used / usage.capacity) * 100);
        $('#sm-disk-val').textContent = formatBytes(usage.used);
        $('#sm-disk-limit').textContent = `Quota: ${formatBytes(usage.capacity)}`;
        $('#sm-disk-pct').textContent = `${pct}%`;
        $('#sm-disk-bar').style.width = `${pct}%`;
      } catch (e) {
        $('#sm-disk-val').textContent = 'Error';
      }

      // 3. Processes (Windows)
      const wins = listWindows();
      const listEl = $('#sm-proc-list');
      
      // To avoid flickering, only rebuild if the number of windows changed
      if (listEl.children.length !== wins.length + 1) { 
        listEl.innerHTML = `
          <div class="sm-process-row">
            <span class="sm-p-name">${iconHTML('terminal', 14)} Monochrome OS Kernel</span>
            <span>Running</span>
            <span>${(Math.random() * 2).toFixed(1)}%</span>
            <span>${(Math.random() * 15 + 10).toFixed(0)} MB</span>
          </div>
        `;
        
        wins.forEach(w => {
          const row = document.createElement('div');
          row.className = 'sm-process-row';
          row.innerHTML = `
            <span class="sm-p-name">${iconHTML(w.app.icon, 14)} ${w.title}</span>
            <span>${w.state === 'minimized' ? 'Sleeping' : 'Running'}</span>
            <span>${(Math.random() * 5).toFixed(1)}%</span>
            <span>${(Math.random() * 30 + 5).toFixed(0)} MB</span>
          `;
          listEl.appendChild(row);
        });
      } else {
        // Just shuffle the simulated CPU/RAM values slightly to look "alive"
        const rows = listEl.querySelectorAll('.sm-process-row');
        for (let i = 1; i < rows.length; i++) {
            const cpuSpan = rows[i].children[2];
            const ramSpan = rows[i].children[3];
            if (Math.random() > 0.7) {
                cpuSpan.textContent = `${(Math.random() * 5).toFixed(1)}%`;
                ramSpan.textContent = `${(Math.random() * 30 + 5).toFixed(0)} MB`;
            }
        }
      }
    }

    // Update immediately, then every second
    updateNetworkUI();
    updateStats();
    const interval = setInterval(updateStats, 1000);

    ctx.onCleanup(() => {
      clearInterval(interval);
      if (observer) observer.disconnect();
    });
  }
};
