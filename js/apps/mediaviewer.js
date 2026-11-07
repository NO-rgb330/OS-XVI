/* ============================================================
   Media Viewer — a standalone audio + video player.
   It opens files by itself (virtual-disk picker, upload from the
   computer, or drag & drop), builds a playlist from the folder the
   file lives in, and remembers volume / speed / loop / shuffle.

   One <video> element plays everything: for audio files the video
   surface is replaced by a cover panel.
   ============================================================ */

import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, baseName, extOf, mimeOf } from '../core/util.js';
import { MEDIA, isMedia, kindOf } from '../core/files.js';
import { hasPaths, hasFiles, readDragPaths, filesFromDrop } from '../core/dnd.js';
import { pickFiles, uploadFiles } from '../core/upload.js';

const MUSIC = '/home/user/Music';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PREFS_KEY = 'os16.mediaviewer.v1';
const IDLE_MS = 2500;

const DEFAULT_PREFS = { volume: 1, muted: false, rate: 1, loop: 'off', shuffle: false };

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    return {
      volume: typeof p?.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 1,
      muted: p?.muted === true,
      rate: SPEEDS.includes(p?.rate) ? p.rate : 1,
      loop: ['off', 'all', 'one'].includes(p?.loop) ? p.loop : 'off',
      shuffle: p?.shuffle === true
    };
  } catch { return { ...DEFAULT_PREFS }; }
}

const pad = (n) => String(n).padStart(2, '0');
function fmtTime(t) {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  t = Math.floor(t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const tb = (cmd, title, icon, label = '') =>
  `<button type="button" class="toolbar-btn" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${iconHTML(icon, 14)}${label ? `<span>${label}</span>` : ''}</button>`;
const cb = (cmd, title, icon, cls = '') =>
  `<button type="button" class="mv-btn ${cls}" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${iconHTML(icon, 18)}</button>`;

export const mediaViewerApp = {
  id: 'mediaviewer',
  name: 'Media Viewer',
  icon: 'media',
  defaultSize: [780, 520],

  async launch(body, args, ctx) {
    // ---------- State ----------
    let list = [];                 // playlist: { path, name, kind, broken? }
    let cur = -1;                  // index of the loaded item
    let url = null;                // object URL of the loaded item
    let prefs = loadPrefs();
    let scrubbing = false;
    let playSeq = 0;               // discards results of superseded loads
    let failStreak = 0;            // consecutive playback failures (stops auto-skip loops)
    let autoStarted = false;       // current item was started by auto-advance, not by the user
    let idleTimer = 0;
    let skipTimer = 0;
    const played = new Set();      // shuffle: indices already played this round
    const history = [];            // shuffle: back-stack for "previous"

    body.innerHTML = `
      <div class="mv-app" tabindex="0">
        <div class="app-toolbar mv-toolbar">
          ${tb('open', 'Open media… (O)', 'folder', 'Open')}
          ${tb('add', 'Add files to the playlist', 'plus', 'Add')}
          ${tb('upload', 'Upload from your computer (saved to UPLOADS)', 'upload')}
          <div class="toolbar-sep"></div>
          ${tb('playlist', 'Show / hide playlist', 'playlist', 'Playlist')}
        </div>
        <div class="mv-split">
          <div class="mv-stage">
            <video class="mv-video" playsinline preload="metadata"></video>
            <div class="mv-cover" hidden>
              ${iconHTML('file-audio', 64)}
              <div class="mv-cover-title"></div>
              <div class="mv-cover-sub">Audio</div>
            </div>
            <div class="mv-empty app-empty">
              ${iconHTML('media', 40)}
              <div>Nothing playing</div>
              <div class="mv-empty-actions">
                <button type="button" class="app-btn primary" data-cmd="open">Open Media…</button>
                <button type="button" class="app-btn" data-cmd="upload">Upload from computer…</button>
              </div>
              <div class="muted">…or drag audio / video files here</div>
            </div>
            <div class="mv-msg" hidden></div>
            <div class="mv-droptip" hidden>Drop to play</div>
          </div>
          <aside class="mv-playlist" aria-label="Playlist">
            <div class="mv-pl-head"><span>Playlist</span><button type="button" class="mv-pl-clear" data-cmd="clear" title="Clear playlist">Clear</button></div>
            <div class="mv-pl-list" role="listbox"></div>
          </aside>
        </div>
        <div class="mv-controls">
          <div class="mv-seekrow">
            <span class="mv-time mv-t-cur">0:00</span>
            <input type="range" class="mv-seek" min="0" max="1000" step="1" value="0" aria-label="Seek" disabled>
            <span class="mv-time mv-t-dur">0:00</span>
          </div>
          <div class="mv-btnrow">
            <div class="mv-group">
              ${cb('shuffle', 'Shuffle (S)', 'shuffle', 'mv-shuffle')}
              ${cb('prev', 'Previous (P)', 'prev')}
              ${cb('play', 'Play / Pause (Space)', 'play', 'mv-play')}
              ${cb('next', 'Next (N)', 'next')}
              ${cb('loop', 'Repeat: off (R)', 'repeat', 'mv-loop')}
            </div>
            <div class="mv-group mv-vol">
              ${cb('mute', 'Mute (M)', 'volume', 'mv-mute')}
              <input type="range" class="mv-volume" min="0" max="1" step="0.01" aria-label="Volume">
            </div>
            <div class="mv-group">
              <select class="mv-speed" aria-label="Playback speed" title="Playback speed">
                ${SPEEDS.map((r) => `<option value="${r}">${r}×</option>`).join('')}
              </select>
              ${cb('fs', 'Full screen (F)', 'fullscreen')}
            </div>
          </div>
        </div>
        <div class="app-statusbar">
          <div class="sb-cell grow mv-s-name">Nothing playing</div>
          <div class="sb-cell mv-s-info"></div>
          <div class="sb-cell mv-s-pos"></div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const elApp = $('.mv-app');
    const media = $('.mv-video');
    const stage = $('.mv-stage');
    const cover = $('.mv-cover');
    const empty = $('.mv-empty');
    const msg = $('.mv-msg');
    const droptip = $('.mv-droptip');
    const plList = $('.mv-pl-list');
    const seek = $('.mv-seek');
    const volume = $('.mv-volume');
    const speed = $('.mv-speed');
    const tCur = $('.mv-t-cur');
    const tDur = $('.mv-t-dur');
    const focusApp = () => elApp.focus({ preventScroll: true });
    const cmdBtn = (c) => body.querySelector(`.mv-btn[data-cmd="${c}"]`);
    const setIcon = (el, id, size = 18) => { el.innerHTML = iconHTML(id, size); };

    // ---------- Output state ----------
    media.volume = prefs.volume;
    media.muted = prefs.muted;
    media.defaultPlaybackRate = prefs.rate;   // survives load(); playbackRate alone resets on every new source
    media.playbackRate = prefs.rate;
    media.loop = prefs.loop === 'one';
    volume.value = String(prefs.muted ? 0 : prefs.volume);
    speed.value = String(prefs.rate);

    function savePrefs() {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
    }

    // ---------- UI sync ----------
    const item = () => list[cur] ?? null;

    function updateButtons() {
      const has = list.length > 0;
      for (const c of ['prev', 'play', 'next']) cmdBtn(c).disabled = !has;
      cmdBtn('fs').disabled = !has;
      const playing = has && !media.paused && !media.ended;
      setIcon(cmdBtn('play'), playing ? 'pause' : 'play', 20);
      cmdBtn('play').title = playing ? 'Pause (Space)' : 'Play (Space)';
      cmdBtn('shuffle').setAttribute('aria-pressed', String(prefs.shuffle));
      const loopLabel = { off: 'off', all: 'all', one: 'current item' }[prefs.loop];
      setIcon(cmdBtn('loop'), prefs.loop === 'one' ? 'repeat-one' : 'repeat');
      cmdBtn('loop').setAttribute('aria-pressed', String(prefs.loop !== 'off'));
      cmdBtn('loop').title = `Repeat: ${loopLabel} (R)`;
      const silent = media.muted || media.volume === 0;
      setIcon(cmdBtn('mute'), silent ? 'mute' : 'volume');
      cmdBtn('mute').setAttribute('aria-pressed', String(media.muted));
      body.querySelector('.mv-pl-clear').disabled = !has;
    }

    function updateTimes() {
      const d = media.duration;
      const finite = Number.isFinite(d) && d > 0;
      tCur.textContent = fmtTime(media.currentTime);
      tDur.textContent = finite ? fmtTime(d) : (d === Infinity ? 'live' : '0:00');
      seek.disabled = !finite;
      if (!scrubbing) seek.value = finite ? String(Math.round((media.currentTime / d) * 1000)) : '0';
    }

    function updateNowPlaying() {
      const it = item();
      const audioOnly = !!it && (it.kind === 'audio' || (media.readyState >= 1 && media.videoWidth === 0));
      stage.classList.toggle('is-audio', audioOnly);
      cover.hidden = !audioOnly;
      media.hidden = !it || audioOnly;
      empty.hidden = list.length > 0;
      $('.mv-cover-title').textContent = it ? it.name : '';
      $('.mv-s-name').textContent = it ? it.name : 'Nothing playing';
      const dims = it && media.videoWidth ? `${media.videoWidth} × ${media.videoHeight}` : '';
      $('.mv-s-info').textContent = it ? (audioOnly ? 'Audio' : (dims ? `Video · ${dims}` : 'Video')) : '';
      $('.mv-s-pos').textContent = list.length ? `${cur + 1} / ${list.length}` : '';
      ctx.setTitle(it ? `${it.name} — Media Viewer` : 'Media Viewer');
      try {
        if (it && 'mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: it.name });
      } catch { /* MediaMetadata unsupported */ }
    }

    function renderPlaylist() {
      plList.innerHTML = list.length ? list.map((it, i) => `
        <div class="mv-pl-item${i === cur ? ' current' : ''}${it.broken ? ' broken' : ''}" role="option" aria-selected="${i === cur}" tabindex="0" data-i="${i}" title="${esc(it.path)}">
          ${iconHTML(it.kind === 'audio' ? 'file-audio' : 'file-video', 14)}
          <span class="mv-pl-name">${esc(it.name)}</span>
          <button type="button" class="mv-pl-rm" data-rm="${i}" title="Remove from playlist" aria-label="Remove ${esc(it.name)}">${iconHTML('close', 12)}</button>
        </div>`).join('') : '<div class="mv-pl-empty muted">Playlist is empty</div>';
      plList.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
    }

    function showMessage(text) {
      msg.textContent = text || '';
      msg.hidden = !text;
    }

    function refreshAll() {
      updateButtons();
      updateTimes();
      updateNowPlaying();
      renderPlaylist();
    }

    // ---------- Playback ----------
    function releaseSource() {
      media.pause();
      media.removeAttribute('src');
      media.load();
      if (url) { URL.revokeObjectURL(url); url = null; }
    }

    function stopAll() {
      playSeq++;
      clearTimeout(skipTimer);
      releaseSource();
      cur = -1;
      showMessage('');
      refreshAll();
    }

    async function playIndex(i, { auto = false, autoplay = true } = {}) {
      if (i < 0 || i >= list.length) return;
      const seq = ++playSeq;
      clearTimeout(skipTimer);
      cur = i;
      autoStarted = auto;
      played.add(i);
      const it = list[i];
      it.broken = false;
      showMessage('');
      refreshAll();

      let blobUrl;
      try {
        const file = await vfs.read(it.path);
        if (seq !== playSeq) return;
        // Blobs from OPFS have no MIME type; setting one lets the browser pick the right demuxer.
        blobUrl = URL.createObjectURL(new Blob([file], { type: mimeOf(it.name) }));
      } catch (err) {
        if (seq === playSeq) onPlayFailure(`Can’t read “${it.name}”: ${err.message.replace(/^E[A-Z]+: /, '')}`);
        return;
      }
      const previous = url;
      url = blobUrl;
      media.src = url;
      media.load();
      if (previous) URL.revokeObjectURL(previous);
      if (autoplay) media.play().catch(() => { /* autoplay blocked or superseded: stay paused */ });
    }

    function onPlayFailure(text) {
      const it = item();
      if (it) it.broken = true;
      failStreak++;
      showMessage(text);
      refreshAll();
      // During automatic advance, skip over unplayable items — but never loop forever.
      if (autoStarted && list.length > 1 && failStreak < list.length) {
        skipTimer = setTimeout(() => next(true), 900);
      }
    }

    function togglePlay() {
      if (!list.length) return;
      if (cur < 0) { playIndex(0); return; }
      if (media.ended) media.currentTime = 0;
      if (media.paused) media.play().catch(() => {}); else media.pause();
    }

    const seekBy = (sec) => {
      if (cur < 0 || !Number.isFinite(media.duration)) return;
      media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + sec));
    };

    const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

    /** Next index in shuffle order, or -1 when the round is over and repeat is off. */
    function shuffleNext(auto) {
      const others = list.map((_, i) => i).filter((i) => i !== cur);
      const fresh = others.filter((i) => !played.has(i));
      if (fresh.length) return randomOf(fresh);
      if (auto && prefs.loop !== 'all') return -1;
      played.clear();
      return others.length ? randomOf(others) : cur;
    }

    function next(auto = false) {
      if (!list.length) return;
      let n;
      if (prefs.shuffle && list.length > 1) {
        n = shuffleNext(auto);
        if (n < 0) { media.pause(); updateButtons(); return; }
        history.push(cur);
        if (history.length > 200) history.shift();
      } else {
        n = cur + 1;
        if (n >= list.length) {
          if (auto && prefs.loop !== 'all') { media.pause(); updateButtons(); return; }   // end of the list
          n = 0;
        }
      }
      playIndex(n, { auto });
    }

    function prev() {
      if (!list.length) return;
      if (media.currentTime > 3 || list.length === 1) { media.currentTime = 0; return; }
      if (prefs.shuffle && history.length) { playIndex(history.pop()); return; }
      playIndex((cur - 1 + list.length) % list.length);
    }

    function onEnded() {
      updateButtons();
      next(true);
    }

    // ---------- Playlist management ----------
    const entryFor = (path) => ({ path, name: baseName(path), kind: kindOf(baseName(path)) });

    async function scanFolder(d) {
      return (await vfs.list(d)).filter((it) => it.kind === 'file' && isMedia(it.name)).map((it) => entryFor(joinPath(d, it.name)));
    }

    function resetOrder() { played.clear(); history.length = 0; failStreak = 0; }

    /** Replace the playlist with the file's folder and start playing the file. */
    async function openPath(path) {
      const name = baseName(path);
      if (!isMedia(name)) { dialogs.toast(`“${name}” isn’t an audio or video file.`, { danger: true }); return; }
      try {
        const siblings = await scanFolder(parentPath(path));
        const i = siblings.findIndex((s) => s.path === path);
        if (i < 0) throw new Error('ENOENT: ' + path);
        list = siblings;
        resetOrder();
        await playIndex(i);
        focusApp();
      } catch (err) {
        dialogs.alert('Media Viewer', `Could not open “${name}”: ${err.message.replace(/^E[A-Z]+: /, '')}`);
      }
    }

    /** Append files to the playlist (skipping duplicates) and play the first one added. */
    async function addPaths(paths, { play = true } = {}) {
      const fresh = [];
      for (const p of paths) {
        if (!isMedia(baseName(p))) continue;
        if (list.some((it) => it.path === p) || fresh.some((it) => it.path === p)) continue;
        fresh.push(entryFor(p));
      }
      if (!fresh.length) {
        if (paths.length) dialogs.toast('Nothing to add: not audio / video, or already in the playlist.', { danger: true });
        return;
      }
      const firstNew = list.length;
      list = list.concat(fresh);
      if (play || cur < 0) await playIndex(firstNew); else refreshAll();
    }

    function removeAt(i) {
      if (i < 0 || i >= list.length) return;
      const wasCurrent = i === cur;
      list.splice(i, 1);
      history.length = 0;
      played.clear();
      if (!list.length) { stopAll(); return; }
      if (wasCurrent) playIndex(Math.min(i, list.length - 1));
      else { if (i < cur) cur--; refreshAll(); }
    }

    function clearList() {
      list = [];
      resetOrder();
      stopAll();
    }

    // ---------- Open / add / upload ----------
    const exitFs = () => { if (document.fullscreenElement === elApp) Promise.resolve(document.exitFullscreen?.()).catch(() => {}); };

    async function openDialog() {
      exitFs();
      const path = await dialogs.filePicker('Open Media', 'open', item() ? parentPath(item().path) : MUSIC, '', MEDIA);
      if (path) await openPath(path);
    }
    async function addDialog() {
      exitFs();
      const path = await dialogs.filePicker('Add to Playlist', 'open', item() ? parentPath(item().path) : MUSIC, '', MEDIA);
      if (path) await addPaths([path], { play: cur < 0 });
    }
    async function uploadAndPlay() {
      exitFs();
      const picked = await pickFiles({ accept: 'audio/*,video/*' });
      if (!picked.length) return;
      const { saved } = await uploadFiles(picked);
      await addPaths(saved.map((f) => f.path));
    }

    // ---------- Commands ----------
    function cycleLoop() {
      prefs.loop = { off: 'all', all: 'one', one: 'off' }[prefs.loop];
      media.loop = prefs.loop === 'one';
      savePrefs();
      updateButtons();
    }
    function toggleShuffle() {
      prefs.shuffle = !prefs.shuffle;
      played.clear();
      if (cur >= 0) played.add(cur);
      history.length = 0;
      savePrefs();
      updateButtons();
    }
    function toggleMute() { media.muted = !media.muted; }
    function stepSpeed(dir) {
      const i = SPEEDS.indexOf(prefs.rate);
      const n = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + dir))];
      media.defaultPlaybackRate = media.playbackRate = n;
    }
    function setVolume(v) {
      media.volume = Math.max(0, Math.min(1, v));
      if (media.volume > 0) media.muted = false;
    }
    function toggleFullscreen() {
      if (document.fullscreenElement === elApp) exitFs();
      else Promise.resolve(elApp.requestFullscreen?.()).catch(() => dialogs.toast('Full screen isn’t available here.'));
    }

    const COMMANDS = {
      open: openDialog, add: addDialog, upload: uploadAndPlay,
      playlist: () => elApp.classList.toggle('no-playlist'),
      clear: clearList,
      play: togglePlay, prev, next: () => next(false),
      shuffle: toggleShuffle, loop: cycleLoop, mute: toggleMute, fs: toggleFullscreen
    };

    elApp.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { removeAt(Number(rm.dataset.rm)); e.stopPropagation(); return; }
      const row = e.target.closest('.mv-pl-item');
      if (row) { playIndex(Number(row.dataset.i)); return; }
      const b = e.target.closest('[data-cmd]');
      if (b) { COMMANDS[b.dataset.cmd]?.(); focusApp(); }
    });

    // Click the picture to play / pause; double-click for full screen.
    const onSurface = (e) => !!e.target.closest('.mv-video, .mv-cover');
    stage.addEventListener('click', (e) => { if (onSurface(e)) togglePlay(); });
    stage.addEventListener('dblclick', (e) => { if (onSurface(e) && list.length) toggleFullscreen(); });

    // Seek & volume sliders
    seek.addEventListener('pointerdown', () => { scrubbing = true; });
    seek.addEventListener('input', () => {
      if (!Number.isFinite(media.duration)) return;
      media.currentTime = (Number(seek.value) / 1000) * media.duration;
      tCur.textContent = fmtTime(media.currentTime);
    });
    seek.addEventListener('change', () => { scrubbing = false; focusApp(); });
    seek.addEventListener('blur', () => { scrubbing = false; });
    volume.addEventListener('input', () => setVolume(Number(volume.value)));
    volume.addEventListener('change', focusApp);
    speed.addEventListener('change', () => {
      media.defaultPlaybackRate = media.playbackRate = Number(speed.value);
      focusApp();
    });

    plList.addEventListener('keydown', (e) => {
      const row = e.target.closest('.mv-pl-item');
      if (!row || e.target !== row) return;
      if (e.key === 'Enter' || e.key === ' ') { playIndex(Number(row.dataset.i)); e.preventDefault(); }
      else if (e.key === 'Delete') { removeAt(Number(row.dataset.i)); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { row.nextElementSibling?.focus?.(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { row.previousElementSibling?.focus?.(); e.preventDefault(); }
    });

    elApp.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t.matches?.('input, select') || t.closest?.('.mv-pl-item')) return;  // native handling there
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      switch (e.key) {
        case ' ': if (t.tagName === 'BUTTON') return; togglePlay(); break;
        case 'k': case 'K': togglePlay(); break;
        case 'ArrowLeft': seekBy(-5); break;
        case 'ArrowRight': seekBy(5); break;
        case 'j': case 'J': seekBy(-10); break;
        case 'l': case 'L': seekBy(10); break;
        case 'ArrowUp': setVolume(media.volume + 0.05); break;
        case 'ArrowDown': setVolume(media.volume - 0.05); break;
        case 'm': case 'M': toggleMute(); break;
        case 'n': case 'N': next(false); break;
        case 'p': case 'P': prev(); break;
        case 'f': case 'F': if (list.length) toggleFullscreen(); break;
        case 'r': case 'R': cycleLoop(); break;
        case 's': case 'S': toggleShuffle(); break;
        case 'o': case 'O': openDialog(); break;
        case '<': stepSpeed(-1); break;
        case '>': stepSpeed(1); break;
        case 'Home': if (cur >= 0) media.currentTime = 0; break;
        default:
          if (/^[0-9]$/.test(e.key) && Number.isFinite(media.duration)) media.currentTime = media.duration * (Number(e.key) / 10);
          else handled = false;
      }
      if (handled) e.preventDefault();
    });

    // ---------- Media element events ----------
    media.addEventListener('loadedmetadata', () => { failStreak = 0; updateTimes(); updateNowPlaying(); renderPlaylist(); });
    media.addEventListener('durationchange', updateTimes);
    media.addEventListener('timeupdate', updateTimes);
    media.addEventListener('play', updateButtons);
    media.addEventListener('pause', updateButtons);
    media.addEventListener('playing', () => { failStreak = 0; showMessage(''); updateButtons(); });
    media.addEventListener('ended', onEnded);
    media.addEventListener('volumechange', () => {
      prefs.volume = media.volume;
      prefs.muted = media.muted;
      volume.value = String(media.muted ? 0 : media.volume);
      savePrefs();
      updateButtons();
    });
    media.addEventListener('ratechange', () => {
      const r = media.playbackRate;
      if (SPEEDS.includes(r)) { prefs.rate = r; speed.value = String(r); savePrefs(); }
    });
    media.addEventListener('error', () => {
      if (!media.getAttribute('src')) return;             // we cleared the source ourselves
      const it = item();
      const code = media.error?.code;
      const ext = it ? extOf(it.name).toUpperCase() : '';
      const reason = code === 4 ? `Your browser can’t play ${ext || 'this'} files.`
        : code === 3 ? 'The file is damaged or uses an unsupported codec.'
        : code === 2 ? 'A read error interrupted playback.'
        : 'Playback was interrupted.';
      onPlayFailure(`Can’t play “${it?.name ?? 'this file'}”.\n${reason}`);
    });

    // ---------- Full-screen chrome: hide controls while idle ----------
    function wake() {
      elApp.classList.remove('idle');
      clearTimeout(idleTimer);
      if (document.fullscreenElement === elApp && !media.paused) {
        idleTimer = setTimeout(() => elApp.classList.add('idle'), IDLE_MS);
      }
    }
    elApp.addEventListener('pointermove', wake);
    elApp.addEventListener('keydown', wake);
    media.addEventListener('pause', wake);
    media.addEventListener('play', wake);
    const onFsChange = () => { wake(); if (!document.fullscreenElement) elApp.classList.remove('idle'); };
    document.addEventListener('fullscreenchange', onFsChange);

    // ---------- Drop to play ----------
    let dropDepth = 0;
    const endDrop = () => { dropDepth = 0; droptip.hidden = true; };
    elApp.addEventListener('dragenter', (e) => { if (hasFiles(e) || hasPaths(e)) { dropDepth++; droptip.hidden = false; } });
    elApp.addEventListener('dragleave', (e) => {
      if ((hasFiles(e) || hasPaths(e)) && --dropDepth <= 0) endDrop();
    });
    elApp.addEventListener('dragover', (e) => {
      if (!hasFiles(e) && !hasPaths(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    elApp.addEventListener('drop', async (e) => {
      if (!hasFiles(e) && !hasPaths(e)) return;
      e.preventDefault();
      const internal = hasPaths(e) ? readDragPaths(e) : null;
      const external = !internal && hasFiles(e) ? filesFromDrop(e) : null;
      endDrop();
      if (internal) await addPaths(internal.names.map((n) => joinPath(internal.dir, n)));
      else if (external) {
        const { saved } = await uploadFiles(external.files, { skippedFolders: external.skippedFolders });
        await addPaths(saved.map((f) => f.path));
      }
    });

    // ---------- Hardware media keys ----------
    function setSessionHandlers(on) {
      if (!('mediaSession' in navigator)) return;
      const handlers = {
        play: () => media.play().catch(() => {}), pause: () => media.pause(),
        previoustrack: () => prev(), nexttrack: () => next(false)
      };
      for (const [action, fn] of Object.entries(handlers)) {
        try { navigator.mediaSession.setActionHandler(action, on ? fn : null); } catch { /* action unsupported */ }
      }
    }
    media.addEventListener('play', () => setSessionHandlers(true));

    // ---------- Lifecycle ----------
    ctx.onFocus(focusApp);
    ctx.onCleanup(() => {
      playSeq++;
      clearTimeout(idleTimer);
      clearTimeout(skipTimer);
      document.removeEventListener('fullscreenchange', onFsChange);
      releaseSource();
      exitFs();
      try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; } catch { /* ignore */ }
      setSessionHandlers(false);
    });

    refreshAll();
    if (args.path) await openPath(args.path);
    focusApp();
  }
};
