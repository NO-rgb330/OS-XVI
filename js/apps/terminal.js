import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { joinPath, parentPath, baseName, formatBytes } from '../core/util.js';
import { openWindow, listWindows, closeWindow } from '../core/wm.js';

const HOME = '/home/user';

function normPath(p) {
  if (!p) return '/';
  const parts = p.split('/').filter(Boolean);
  const stack = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

function resolvePath(input, cwd) {
  if (!input) return cwd;
  if (input.startsWith('~')) return normPath(HOME + input.slice(1));
  if (input.startsWith('/')) return normPath(input);
  return normPath(cwd + '/' + input);
}

export const terminalApp = {
  id: 'terminal',
  name: 'Terminal',
  icon: 'terminal',
  defaultSize: [720, 440],

  async launch(body, args, ctx) {
    let cwd = args.cwd || HOME;
    let history = [];
    let historyIndex = -1;
    let isBusy = false;

    body.innerHTML = `
      <div class="term-app" tabindex="0">
        <div class="term-output"></div>
        <div class="term-input-line">
          <span class="term-prompt"></span>
          <input type="text" class="term-input" spellcheck="false" autocomplete="off" autocapitalize="off" />
        </div>
      </div>
    `;

    const $ = (s) => body.querySelector(s);
    const appEl = $('.term-app');
    const outputEl = $('.term-output');
    const promptEl = $('.term-prompt');
    const inputEl = $('.term-input');

    const print = (text, type = 'stdout') => {
      const div = document.createElement('div');
      div.className = `term-line term-${type}`;
      div.textContent = text;
      outputEl.appendChild(div);
      outputEl.scrollTop = outputEl.scrollHeight;
    };

    const updatePrompt = () => {
      const displayPath = cwd.replace(HOME, '~');
      promptEl.textContent = `user@monochrome:${displayPath}$`;
    };

    const focusInput = () => {
      appEl.classList.add('focused');
      inputEl.focus();
    };
    appEl.addEventListener('click', (e) => {
      if (window.getSelection().toString()) return;
      focusInput();
    });
    appEl.addEventListener('focusout', () => appEl.classList.remove('focused'));

    // ---- Command Engine ----

    const commands = {
      help: async (args, io) => {
        io.out(
`Available commands:
  Navigation:  pwd, ls, cd, mkdir, touch, rm, cp, mv
  View/Edit:   cat, less, head, tail, grep, sed, nano, vim
  System:      ps, top, kill, df, du, free, date, whoami
  Hardware:    sysinfo
  Network:     ping, curl, wget, ssh
  Utils:       echo, man, clear, history, sudo, chmod
  Easter Egg:  neofetch`
        );
      },

      clear: async (args, io) => {
        outputEl.innerHTML = '';
      },

      pwd: async (args, io) => {
        io.out(cwd);
      },

      whoami: async (args, io) => {
        io.out('user');
      },

      date: async (args, io) => {
        io.out(new Date().toString());
      },

      echo: async (args, io) => {
        io.out(args.join(' '));
      },

      history: async (args, io) => {
        history.forEach((cmd, i) => io.out(`  ${i + 1}  ${cmd}`));
      },

      ls: async (args, io) => {
        let targetPath = cwd;
        let showHidden = false;
        for (const arg of args) {
          if (arg === '-a') showHidden = true;
          else if (arg !== '-l' && arg !== '-la' && arg !== '-al') targetPath = resolvePath(arg, cwd);
        }
        try {
          const items = await vfs.list(targetPath);
          const output = items
            .filter(it => showHidden || !it.name.startsWith('.'))
            .map(it => it.kind === 'dir' ? `${it.name}/` : it.name)
            .join('  ');
          if (output) io.out(output);
        } catch (e) { io.err(e.message); }
      },

      cd: async (args, io) => {
        let target = args[0] || '~';
        if (target === '-') target = '~';
        const path = resolvePath(target, cwd);
        try {
          const stat = await vfs.stat(path);
          if (stat.kind !== 'dir') throw new Error(`Not a directory: ${target}`);
          cwd = path;
          updatePrompt();
        } catch (e) { io.err(`cd: ${target}: No such directory`); }
      },

      mkdir: async (args, io) => {
        if (!args[0]) return io.err('mkdir: missing operand');
        try { await vfs.mkdir(resolvePath(args[0], cwd)); } catch (e) { io.err(e.message); }
      },

      touch: async (args, io) => {
        if (!args[0]) return io.err('touch: missing file operand');
        const path = resolvePath(args[0], cwd);
        if (await vfs.exists(path)) {
          const blob = await vfs.read(path);
          await vfs.write(path, blob);
        } else {
          await vfs.write(path, '');
        }
      },

      rm: async (args, io) => {
        const recursive = args.includes('-r') || args.includes('-rf');
        const targets = args.filter(a => !a.startsWith('-'));
        if (!targets.length) return io.err('rm: missing operand');
        for (const t of targets) {
          const p = resolvePath(t, cwd);
          try {
            const stat = await vfs.stat(p);
            if (stat.kind === 'dir' && !recursive) {
              io.err(`rm: cannot remove '${t}': Is a directory`);
            } else {
              await vfs.rm(p);
            }
          } catch (e) { io.err(e.message); }
        }
      },

      cp: async (args, io) => {
        const targets = args.filter(a => !a.startsWith('-'));
        if (targets.length < 2) return io.err('cp: missing destination file operand');
        const src = resolvePath(targets[0], cwd);
        const dst = resolvePath(targets[1], cwd);
        try { await vfs.cp(src, dst); } catch (e) { io.err(e.message); }
      },

      mv: async (args, io) => {
        const targets = args.filter(a => !a.startsWith('-'));
        if (targets.length < 2) return io.err('mv: missing destination file operand');
        const src = resolvePath(targets[0], cwd);
        const dst = resolvePath(targets[1], cwd);
        try { await vfs.mv(src, dst); } catch (e) { io.err(e.message); }
      },

      cat: async (args, io, stdin) => {
        if (stdin) return io.out(stdin);
        if (!args[0]) return io.err('cat: missing file operand');
        try {
          const blob = await vfs.read(resolvePath(args[0], cwd));
          io.out(await blob.text());
        } catch (e) { io.err(e.message); }
      },

      less: async (args, io, stdin) => {
        // Simplified less: just prints the whole thing (cat)
        if (stdin) return io.out(stdin);
        if (!args[0]) return io.err('less: missing file operand');
        try {
          const blob = await vfs.read(resolvePath(args[0], cwd));
          io.out(await blob.text());
        } catch (e) { io.err(e.message); }
      },

      head: async (args, io, stdin) => {
        const text = stdin || await (await vfs.read(resolvePath(args[0], cwd))).text();
        const lines = text.split('\n');
        io.out(lines.slice(0, 10).join('\n'));
      },

      tail: async (args, io, stdin) => {
        const text = stdin || await (await vfs.read(resolvePath(args[0], cwd))).text();
        const lines = text.split('\n');
        io.out(lines.slice(-10).join('\n'));
      },

      grep: async (args, io, stdin) => {
        if (!args[0]) return io.err('grep: missing pattern');
        const pattern = args[0].toLowerCase();
        let text = stdin;
        if (!text && args[1]) {
          try { text = await (await vfs.read(resolvePath(args[1], cwd))).text(); }
          catch (e) { return io.err(e.message); }
        }
        if (!text) return io.err('grep: missing input');
        const matches = text.split('\n').filter(l => l.toLowerCase().includes(pattern));
        if (matches.length) io.out(matches.join('\n'));
      },

      sed: async (args, io, stdin) => {
        if (args[0] === '-i' && args[1] && args[2]) {
          // sed -i 's/old/new/g' file
          const match = args[1].match(/^s\/(.*?)\/(.*?)\/g?$/);
          if (!match) return io.err('sed: invalid expression');
          const path = resolvePath(args[2], cwd);
          try {
            const text = await (await vfs.read(path)).text();
            const regex = new RegExp(match[1], 'g');
            await vfs.write(path, text.replace(regex, match[2]));
          } catch (e) { io.err(e.message); }
        } else {
          io.err('sed: only supports in-place substitution (-i \'s/old/new/g\' file) in this environment');
        }
      },

      nano: async (args, io) => {
        if (!args[0]) return io.err('nano: missing file operand');
        const path = resolvePath(args[0], cwd);
        if (!(await vfs.exists(path))) await vfs.write(path, '');
        openWindow('notepad', { path });
        io.out(`Opening ${args[0]} in Notepad...`);
      },

      vim: async (args, io) => commands.nano(args, io),

      df: async (args, io) => {
        try {
          const u = await vfs.usage();
          io.out(`Filesystem     1K-blocks      Used Available Use% Mounted on`);
          const total = Math.floor(u.capacity / 1024);
          const used = Math.floor(u.used / 1024);
          const free = Math.floor(u.free / 1024);
          const pct = Math.round((u.used / u.capacity) * 100);
          io.out(`virtual_disk    ${total.toString().padStart(9)} ${used.toString().padStart(9)} ${free.toString().padStart(9)} ${pct}% /`);
        } catch (e) { io.err(e.message); }
      },

      du: async (args, io) => {
        try {
          const b = await vfs.breakdown(cwd);
          for (const item of b) {
            io.out(`${(item.size / 1024).toFixed(1).padStart(8)}K\t${item.name}`);
          }
        } catch (e) { io.err(e.message); }
      },

      free: async (args, io) => {
        let mem = 'N/A';
        if (performance.memory) {
          mem = Math.floor(performance.memory.usedJSHeapSize / 1024 / 1024) + 'M';
        }
        io.out(`               total        used        free`);
        io.out(`Mem:           N/A         ${mem.padStart(10)}        N/A`);
        io.out(`Swap:          0B          0B          0B`);
      },

      ps: async (args, io) => {
        io.out(`  PID TTY          TIME CMD`);
        io.out(`    1 ?        00:00:00 init`);
        listWindows().forEach((w, i) => {
          io.out(`${(i + 2).toString().padStart(5)} ?        00:00:00 ${w.title.substring(0, 15)}`);
        });
      },

      top: async (args, io) => {
        io.out(`Tasks: ${listWindows().length + 1} total, 1 running`);
        io.out(`%Cpu(s):  1.0 us,  0.5 sy, 98.5 id`);
        io.out(`  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND`);
        io.out(`    1 root      20   0  100000  10000   5000 S   0.0   0.1   0:00.01 init`);
        listWindows().forEach((w, i) => {
          io.out(`${(i + 2).toString().padStart(5)} user      20   0  200000  50000  10000 S   0.1   0.5   0:00.05 ${w.title.substring(0, 10)}`);
        });
        io.out(`\n(Press Ctrl+C to exit top)`);
      },

      kill: async (args, io) => {
        const pid = parseInt(args[0]);
        if (isNaN(pid)) return io.err('kill: usage: kill [pid]');
        if (pid === 1) return io.err('kill: cannot kill init');
        const wins = listWindows();
        if (pid - 2 < wins.length) {
          closeWindow(wins[pid - 2].id);
          io.out(`Process ${pid} terminated.`);
        } else {
          io.err(`kill: (${pid}) - No such process`);
        }
      },

      ping: async (args, io) => {
        const host = args[0] || 'localhost';
        io.out(`PING ${host} (127.0.0.1) 56(84) bytes of data.`);
        for (let i = 0; i < 3; i++) {
          await new Promise(r => setTimeout(r, 400));
          io.out(`64 bytes from 127.0.0.1: icmp_seq=${i+1} ttl=64 time=0.0${Math.floor(Math.random()*9)+1} ms`);
        }
        io.out(`\n--- ${host} ping statistics ---`);
        io.out(`3 packets transmitted, 3 received, 0% packet loss, time 2002ms`);
      },

      curl: async (args, io) => io.err('curl: Network access is disabled in this sandbox.'),
      wget: async (args, io) => io.err('wget: Network access is disabled in this sandbox.'),
      ssh: async (args, io) => io.err('ssh: Network access is disabled in this sandbox.'),

      sudo: async (args, io) => {
        io.out(`[sudo] password for user: ********`);
        io.err(`user is not in the sudoers file. This incident will be reported.`);
      },

      chmod: async (args, io) => {
        io.out(`chmod: changing permissions is simulated (VFS does not enforce them).`);
      },

      man: async (args, io) => {
        if (!args[0]) return io.err('What manual page do you want?');
        if (commands[args[0]]) {
          io.out(`NAME\n    ${args[0]} - ${args[0]} command\n\nSYNOPSIS\n    ${args[0]} [OPTIONS]\n\nDESCRIPTION\n    Standard ${args[0]} utility.`);
        } else {
          io.err(`No manual entry for ${args[0]}`);
        }
      },

      sysinfo: async (args, io) => {
        const row = (k, v) => io.out(`  ${k.padEnd(18)}${v}`);

        // 1. Gather Browser Hardware Data
        const cores = navigator.hardwareConcurrency || 'Unknown';
        const mem = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'Restricted by browser';
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        // 2. Gather OS Data
        const uaData = navigator.userAgentData;
        const platform = uaData ? uaData.platform : (navigator.platform || 'Unknown');
        const userAgent = navigator.userAgent;
        const isMobile = uaData ? uaData.mobile : /Mobi|Android/i.test(userAgent);
        
        // 3. Screen Details
        const screenRes = `${window.screen.width}x${window.screen.height} @ ${window.screen.colorDepth}-bit`;
        const winRes = `${window.innerWidth}x${window.innerHeight}`;

        // 4. Disk Usage
        let diskUsed = '0 B', diskQuota = 'Unknown';
        try {
          const u = await vfs.usage();
          diskUsed = formatBytes(u.used);
          diskQuota = formatBytes(u.capacity);
        } catch (e) {}

        io.out('System Information (Browser Sandbox)');
        io.out('--------------------------------------');
        row('OS / Platform:', platform);
        row('Device Type:', isMobile ? 'Mobile / Tablet' : 'Desktop');
        row('Browser Engine:', uaData?.brands?.map(b => `${b.brand} v${b.version}`).join(', ') || 'Unknown');
        row('Processor Threads:', `${cores} logical cores`);
        row('Memory (Est.):', mem);
        io.out('');
        row('Screen Resolution:', screenRes);
        row('Window Size:', winRes);
        row('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        row('Language:', navigator.language);
        io.out('');
        row('Disk Used:', diskUsed);
        row('Disk Quota:', diskQuota);
        row('Network Status:', navigator.onLine ? 'Online' : 'Offline');
        
        if (conn) {
          row('Network Speed:', `~${conn.downlink || '?'} Mbps (${conn.effectiveType || '?'})`);
          row('Network Latency:', `~${conn.rtt || '?'} ms`);
        }

        io.out('\nNote: Exact CPU model, total RAM, and laptop model are');
        io.out('blocked by web browser privacy policies.');
      },

      neofetch: async (args, io) => {
        io.out(`
   .--.       user@monochrome
  |o_o |      ----------------
  |:_/ |      OS: Monochrome OS 1.0
 //   \\ \\     Kernel: WebKit/Blink
(|     | )    Uptime: ${Math.floor(performance.now() / 60000)} mins
/'\\_   _/\`\\   Shell: os-sh
\\___)=(___/   Resolution: ${window.innerWidth}x${window.innerHeight}
               Disk: ${(await vfs.usage()).used > 0 ? 'Used' : 'Empty'}
               Font: Segoe UI / Mono
        `);
      }
    };

    // ---- Parser & Executor ----

    function tokenize(str) {
      const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
      const tokens = [];
      let match;
      while ((match = regex.exec(str)) !== null) {
        tokens.push(match[1] || match[2] || match[0]);
      }
      return tokens;
    }

    async function execute(input) {
      if (!input.trim()) return;
      history.push(input);
      if (history.length > 100) history.shift();
      historyIndex = -1;

      print(`${promptEl.textContent} ${input}`, 'cmd-echo');

      // Handle pipes and redirection
      const pipeline = input.split('|').map(s => s.trim());
      
      let pipedInput = null;
      let currentRedirect = null;
      let currentTarget = null;

      for (let i = 0; i < pipeline.length; i++) {
        let cmdStr = pipeline[i];
        
        // Check for redirection
        let redirectMatch = cmdStr.match(/(>>|>)\s*([^\s]+)$/);
        if (redirectMatch) {
          currentRedirect = redirectMatch[1];
          currentTarget = resolvePath(redirectMatch[2], cwd);
          cmdStr = cmdStr.replace(/(>>|>)\s*([^\s]+)$/, '').trim();
        } else {
          currentRedirect = null;
          currentTarget = null;
        }

        const tokens = tokenize(cmdStr);
        if (!tokens.length) continue;

        const cmdName = tokens[0];
        const args = tokens.slice(1);

        if (!commands[cmdName]) {
          print(`bash: ${cmdName}: command not found`, 'stderr');
          pipedInput = null;
          continue;
        }

        let outputBuffer = '';

        const io = {
          out: (text) => {
            outputBuffer += text + '\n';
            if (pipeline.length === 1 && !currentRedirect) print(text, 'stdout');
          },
          err: (text) => {
            print(text, 'stderr');
          }
        };

        try {
          await commands[cmdName](args, io, pipedInput);
          
          if (currentRedirect) {
            const existing = (await vfs.exists(currentTarget)) ? await (await vfs.read(currentTarget)).text() : '';
            const toWrite = currentRedirect === '>>' && existing ? existing + outputBuffer : outputBuffer;
            await vfs.write(currentTarget, toWrite.trimEnd());
            outputBuffer = ''; // Consumed by redirect
          }

          pipedInput = outputBuffer.trimEnd();
        } catch (e) {
          io.err(e.message);
          pipedInput = null;
        }
      }
    }

    // ---- Input Handling ----

    inputEl.addEventListener('keydown', async (e) => {
      if (isBusy) {
        if (e.key === 'c' && e.ctrlKey) {
          isBusy = false;
          print('^C', 'stderr');
          inputEl.value = '';
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputEl.value;
        inputEl.value = '';
        isBusy = true;
        await execute(val);
        isBusy = false;
        focusInput();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          historyIndex++;
          inputEl.value = history[history.length - 1 - historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          inputEl.value = history[history.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
          historyIndex = -1;
          inputEl.value = '';
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        outputEl.innerHTML = '';
      }
    });

    ctx.onFocus(() => focusInput());
    ctx.onCleanup(() => { /* cleanup */ });

    updatePrompt();
    print('Welcome to Monochrome OS Terminal (os-sh)', 'stdout');
    print('Type "help" for a list of commands.\n', 'stdout');
    focusInput();
  }
};
