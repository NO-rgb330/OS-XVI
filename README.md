# OS-XVI

A monochrome desktop operating system that runs entirely inside a browser tab. No server, no accounts, no installation. Files, apps, and settings persist in the browser's own storage.

Everything is client-side. The whole OS is a set of static HTML, CSS, and JavaScript files that a static web server can deliver. Opening the site is functionally the same as booting a computer.

---

## Contents

- [Requirements](#requirements)
- [Running locally](#running-locally)
- [First boot](#first-boot)
- [Desktop and shell](#desktop-and-shell)
- [Applications](#applications)
- [Virtual file system](#virtual-file-system)
- [Drag and drop](#drag-and-drop)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Boot error codes](#boot-error-codes)
- [Privacy](#privacy)
- [Architecture notes](#architecture-notes)
- [Project structure](#project-structure)
- [Credits and licences](#credits-and-licences)

---

## Requirements

- A modern Chromium-based browser is strongly recommended (Chrome, Edge, Brave, Arc, Chromium). Firefox and Safari work for most features but with degraded behaviour (see below).
- The browser must support:
  - **IndexedDB** — for file system metadata
  - **OPFS** (Origin Private File System) — for file contents. Safari 15+ and Firefox 111+ have partial support; Chrome 86+ has full support.
  - **ES modules** — for the module-based application code
  - **WebAssembly** — for the Python runtime (Serpent)
- **WebGPU** (Chrome/Edge 113+, or Firefox Nightly) is required for **Local AI**. Other apps work without it.
- **Web Workers** and **CompressionStream** are used for streaming ZIP creation and are available in all current browsers.

A minimum of 4 GB of RAM is assumed. **Local AI** additionally needs a GPU with 2–4 GB of free VRAM to load a model at usable speed.

Firefox and Safari limitations:

| Feature | Chromium | Firefox | Safari |
|---|---|---|---|
| Virtual file system (OPFS) | Full | Partial (in Worker only) | Full |
| WebGPU for Local AI | Yes | Nightly only | 17+ with feature flag |
| Battery indicator in panel | Yes | No (API unavailable) | No |
| Persistent storage request | Yes | Yes (may deny silently) | Limited |
| Streaming ZIP | Yes | Yes | Yes |

Everything else works identically across browsers.

---

## Running locally

A static file server is required. Opening `index.html` directly via `file://` will not work — ES modules, OPFS, and fetch requests are blocked under that origin.

Any static server works. Examples:

```bash
# Python (installed by default on most systems)
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000/` in a Chromium-based browser.

The first request to `index.html` triggers the boot sequence. No build step is required — the source files are what the browser runs.

---

## First boot

On first launch the OS runs a three-step setup wizard:

1. **Storage allocation** — choose the maximum virtual disk size (1 GB, 5 GB, 10 GB, 25 GB, or 50 GB). The browser may grant less than requested; the Files app's Storage view reports the actual capacity once the disk is mounted. This size is a soft limit the OS enforces; the browser's own quota is the hard limit.
2. **Account** — a display name and a password. The password is stored in `localStorage` and gates the login screen. It is not encrypted, and this is not a security boundary — do not reuse a real password.
3. **Confirmation** — the wizard installs the system files and reboots into the login screen.

After setup completes, every subsequent visit to the site takes the user directly to login. The setup wizard is not shown again unless `localStorage` is cleared.

The login screen also serves as the lock screen. The lock button in the panel re-invokes it without closing open windows.

---

## Desktop and shell

**Panel (bottom of the screen).** XFCE-style:

- **Applications** button — grid menu of every installed app. Right-click an icon in the menu to add it to or remove it from the desktop.
- **Tasklist** — one button per open window. Click to focus; click again to minimize. The focused window is highlighted.
- **Clock** — updates every minute, tooltip shows the full date.
- **Battery** — appears only on devices that report a battery via the Battery Status API (Chromium). Shows charge percentage, charging state, and estimated time remaining.
- **Lock** — shows the login screen. Requires the password to return.

**Desktop.**

- Grid of icons for apps and files. Apps appear automatically on first registration; removal from the desktop does not uninstall them.
- Click to select; Ctrl/Shift-click to toggle; drag a rubber band over empty desktop to select multiple.
- Drag selected icons to move them. Multi-select drags move as a group and preserve the arrangement.
- Double-click opens. Delete removes from the desktop (apps and shortcuts) or deletes the file (with confirmation).
- Right-click gives app-specific options (Open, Cut/Copy, Rename, Extract, Remove from Desktop).
- **Restore App Icons** in the desktop right-click menu restores any apps previously removed from the desktop.
- **Arrange Icons** resets all positions to the automatic grid layout.

**Windows.**

- Title bar shows the app icon, title, and Minimize / Maximize / Close buttons.
- Drag the title bar to move; drag any of the eight edges or corners to resize.
- Hover the Maximize button to see six snap-layout presets (two columns, left one / right two, left two / right one, four squares, three columns, top one / bottom two). Click a zone to snap the window into it.
- Double-click the title bar to maximize or restore.
- Windows that are already maximized or snapped will unsnap when dragged, and the drag continues from the pointer position.
- Each window is independent; the number of simultaneous windows is limited only by memory.

**Notifications.**

- Toast notifications appear at the bottom-right for short-lived status messages (upload complete, download failed, disk nearly full).
- Modal dialogs (alerts, confirmations, prompts, file pickers, progress with cancel) appear on top of windows and stack correctly.

---

## Applications

Fifteen apps are installed by default, plus any the user adds. Each runs inside its own window and can be open alongside the others.

### Files

A full file manager for the virtual disk.

**Navigation.**

- Address bar shows the current path as clickable breadcrumbs.
- Back / Forward / Up buttons, plus keyboard equivalents (Alt+←/→/↑, Backspace).
- Sidebar shortcuts to Home, Desktop, Documents, Pictures, Music, Videos, Downloads, UPLOADS, SYSTEM APPS, and the File System root.
- **Storage view** (toolbar disk button) shows total usage, free space, per-folder breakdown, and a **Request More Space** button that asks the browser for persistent storage.

**View modes.**

- List view (sortable columns: Name, Size, Modified) or grid view (icon tiles).
- Sort ascending/descending by clicking a column header.
- Responsive: sidebar and columns collapse automatically as the window narrows.

**Selection.**

- Click to select; Ctrl-click to toggle; Shift-click to select a range.
- Drag a marquee in the empty area below files (there is always space due to reserved padding).
- Autoscroll: dragging past the top or bottom edge scrolls the view and extends the selection.

**File operations.**

- Create folders and text files.
- Rename (F2), delete (Del), cut/copy/paste (Ctrl+X/C/V).
- Upload files or entire folders from the computer. Everything lands in `UPLOADS/`; folder structure is preserved.
- Download a single file directly, or download multiple files/folders as a streamed ZIP (see [Archiver](#archiver)).
- Extract `.zip` files into a new folder next to the archive, or directly into the current folder.
- Paste into any folder by right-clicking it and choosing "Paste Into".

**Drag and drop.**

- Drag files out to any other Files window, the desktop, the Image Viewer, or the Media Viewer.
- Drag files from the desktop back into Files to move them into a folder.
- Drag folders from the computer into Files to upload them.

**System Apps.**

The `SYSTEM APPS` folder in the sidebar contains one shortcut per installed app. Shortcuts are read-only (cannot be renamed, cut, or deleted), but can be copied out — dragging an app shortcut to the desktop or another folder creates a new launchable shortcut there. Opening a shortcut launches the corresponding app.

### Notepad

A two-mode text editor and viewer.

**Edit mode** is used for files up to **20 MB**. All standard textarea behaviour: undo/redo, cursor movement, selection. A "Large file" hint appears in the status bar above 5 MB.

**View mode** is used for files between **20 MB and 1 GB**. The file is streamed once to build a line index, then only the ~60 lines in the viewport are rendered at any moment. Scrolling is instant regardless of file size. Text selection is limited to what is currently visible — copying a short snippet works; selecting the whole file does not.

Files over 1 GB are refused with an explanation. This is a hard limit imposed by browser rendering pipelines.

Toolbar: Save, word-wrap toggle (edit mode only), font-size +/-.

Status bar: line and character count, cursor position, mode indicator.

### Terminal

A Unix-like shell over the virtual disk.

**Commands** (30+):

`help`, `clear`, `pwd`, `whoami`, `date`, `echo`, `history`, `ls`, `cd`, `mkdir`, `touch`, `rm`, `cp`, `mv`, `cat`, `less`, `head`, `tail`, `grep`, `sed`, `nano`, `vim`, `df`, `du`, `free`, `ps`, `top`, `kill`, `ping`, `curl`, `wget`, `ssh`, `sudo`, `chmod`, `man`, `sysinfo`, `neofetch`

**Features.**

- Pipes (`ls | grep txt`) and output redirection (`>`, `>>`).
- Command history (↑/↓), Ctrl+L to clear, Ctrl+C to interrupt.
- `nano` and `vim` open the file in Notepad.
- `sysinfo` reports processor threads, approximate memory, disk usage, network status, and browser engine.

Network commands (`curl`, `wget`, `ssh`) return "access disabled" because the sandbox has no direct network access. `ping` responds with synthetic latency for demonstration.

### Calculator

Standard calculator with keyboard support.

- Digits, decimal point, parentheses, percent, square root, exponent.
- Standard operators (+, −, ×, ÷, ^).
- Percent handling: `50 + 10%` is computed as `50 + 5`, like a desk calculator.
- Sign toggle (±).
- History panel (dropdown from the toolbar) with the last 50 calculations; clicking an entry restores it.
- Full keyboard support: digits, operators, `Enter` for equals, `Backspace`, `Escape` to clear.

### GraphCalc

Function grapher.

- Multiple equations plotted simultaneously, each with a distinct visual style.
- Enter expressions in `x`: `sin(x)`, `x^2 - 3`, `sqrt(abs(x))`, etc.
- Pan by dragging the canvas; zoom with the scroll wheel (cursor-anchored).
- Toolbar buttons for zoom in, zoom out, and reset view.

### Clock

Three tabs sharing one window.

- **World Clock** — eight preset cities with live local time, date, and offset from the system timezone. Additional cities via Intl.
- **Timer** — countdown timer with hour/minute/second inputs. Audio alarm on completion.
- **Stopwatch** — lap timer with millisecond precision.

### Code Scanner

Static analysis for common security issues.

**Python rules** include: dangerous eval/exec, OS command execution, SQL injection patterns, insecure deserialization (pickle, yaml, marshal), weak hashing (MD5, SHA1), hardcoded secrets, debug mode in Flask/Django, unsafe archive extraction, bare excepts, wildcard imports, mutable default arguments.

**Web rules** include: XSS via innerHTML/outerHTML/document.write, javascript: URIs, dangerous React/Vue/Angular patterns, eval and string-based setTimeout, unrestricted iframes, reverse tabnabbing, insecure HTTP, hardcoded secrets, prototype pollution risks, missing CSRF tokens.

Findings are sorted by severity (high, medium, low) with the source line number and snippet. Language selector switches between Python and Web rule sets.
