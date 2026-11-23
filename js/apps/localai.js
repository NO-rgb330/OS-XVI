/* ============================================================
   Local AI — chat with a language model that runs entirely on this computer.

   Engine: WebLLM on WebGPU (see core/llm.js). Nothing you type leaves the
   machine; the only downloads are the runtime and the model weights, which
   the browser caches after the first time.

   Chats are saved as JSON in /home/user/AI Chats and can be exported to
   Markdown. Model list, system prompt and sampling options are all editable.
   ============================================================ */

import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import * as llm from '../core/llm.js';
import { iconHTML } from '../core/icons.js';
import { esc } from '../core/util.js';
import { uniqueName } from '../core/files.js';
import { renderMarkdown } from '../core/markdown.js';
import { defaultModel, sizeLabel, trimMessages, suggestForSpeed } from '../core/llm-utils.js';

const CHAT_DIR = '/home/user/AI Chats';
const SETTINGS_KEY = 'os16.ai.settings';
const CUSTOM_KEY = 'os16.ai.custom';
const BENCH_KEY = 'os16.ai.bench';
const TARGET_TPS = 20;           // what “comfortable” means: the app suggests a lighter model below this
const PAINT_MS = 70;             // streaming text is repainted at most ~14×/s (was: every frame, re-parsing all markdown)

const DEFAULTS = {
  model: '',
  system: 'You are a helpful, honest assistant running locally on the user\'s own computer. Be clear and concise.',
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 1024,
  ctx: 4096,
  showAll: false,
  keepLoaded: false,
  noThink: true            // Qwen3-style models: skip the long <think> phase (much faster answers)
};

const SUGGESTIONS = [
  'Explain how a hash table works, with a short example.',
  'Write a Python function that merges two sorted lists.',
  'Give me a 5-step plan to learn touch typing.'
];

const readJson = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

const shortName = (id) => id.replace(/-MLC(-1k)?$/i, '').replace(/-q(\d)f(16|32)(_\d)?/i, ' · q$1f$2');
const clean = (e) => String(e?.message ?? e).replace(/^E[A-Z]+: /, '');
const newId = () => 'chat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const blankChat = () => ({ id: newId(), title: '', created: Date.now(), updated: Date.now(), model: '', messages: [] });

export const localAiApp = {
  id: 'localai',
  name: 'Local AI',
  icon: 'ai',
  defaultSize: [980, 640],
  singleton: true,

  async launch(body, args, ctx) {
    // ---------- State ----------
    const settings = { ...DEFAULTS, ...readJson(SETTINGS_KEY, {}) };
    let custom = readJson(CUSTOM_KEY, []);
    let gpu = null;
    let models = [];
    let cached = new Set();
    let chats = [];
    let chat = blankChat();
    let progress = null;            // { progress, text } while a model downloads / loads
    let runtimeError = '';
    let usage = null;               // last { tps, completion }
    let notice = '';                // e.g. "Older messages were left out"
    let stick = true;               // keep the view pinned to the newest text
    let saveTimer = 0;
    let raf = 0;
    let paintTimer = 0;
    let lastPaint = 0;
    let tuning = false;             // warming up / measuring right after a model loads
    let bench = readJson(BENCH_KEY, {});
    let closed = false;

    const saveSettings = () => writeJson(SETTINGS_KEY, settings);

    body.innerHTML = `
      <div class="ai-app">
        <aside class="ai-side">
          <button type="button" class="app-btn primary ai-new">${iconHTML('plus', 14)} New chat</button>
          <div class="ai-chats" role="listbox" aria-label="Chats"></div>
        </aside>

        <section class="ai-main">
          <div class="app-toolbar ai-top">
            <button type="button" class="toolbar-btn ai-side-toggle" title="Show / hide chats" aria-label="Chats">${iconHTML('list', 14)}</button>
            <div class="ai-chip" title="Current model"><span class="ai-dot"></span><span class="ai-chip-name">Starting…</span></div>
            <div class="ai-spacer"></div>
            <button type="button" class="toolbar-btn ai-export" title="Save this chat as a Markdown file in Documents" disabled>${iconHTML('download', 14)} Export</button>
            <button type="button" class="toolbar-btn ai-settings-btn" aria-pressed="false" title="Models and settings">${iconHTML('settings', 14)} Settings</button>
          </div>

          <div class="ai-body">
            <div class="ai-messages" aria-live="polite"></div>

            <aside class="ai-settings" hidden>
              <section class="ai-sec">
                <div class="ai-sec-title">Model</div>
                <p class="ai-hint ai-gpu"></p>
                <div class="ai-model-list" role="radiogroup" aria-label="Models"></div>
                <label class="ai-check"><input type="checkbox" class="ai-showall"> Show models that may not fit in memory</label>
                <div class="ai-progress" hidden><div class="ai-progress-bar"><div class="ai-progress-fill"></div></div><div class="ai-progress-text"></div></div>
                <div class="ai-model-actions"></div>
              </section>

              <section class="ai-sec">
                <div class="ai-sec-title">Generation</div>
                <label class="ai-row"><span>Creativity <b class="v-temp"></b></span><input type="range" class="s-temp" min="0" max="1.5" step="0.05"></label>
                <label class="ai-row"><span>Top-p <b class="v-topp"></b></span><input type="range" class="s-topp" min="0.1" max="1" step="0.05"></label>
                <label class="ai-row"><span>Max reply length</span>
                  <select class="s-max"><option value="256">256 tokens</option><option value="512">512 tokens</option><option value="1024">1024 tokens</option><option value="2048">2048 tokens</option></select></label>
                <label class="ai-row"><span>Memory window (applies on next load)</span>
                  <select class="s-ctx"><option value="2048">2048 — lightest</option><option value="4096">4096 — balanced</option><option value="8192">8192 — more memory</option></select></label>
              </section>

              <section class="ai-sec">
                <div class="ai-sec-title">System prompt</div>
                <textarea class="s-system" rows="5" spellcheck="false"></textarea>
                <div class="ai-hint">Sets the assistant's role and tone. It's sent at the start of every chat.</div>
              </section>

              <section class="ai-sec">
                <div class="ai-sec-title">Add your own model</div>
                <p class="ai-hint">WebLLM runs MLC-format models. Paste a Hugging Face repo that has been converted to MLC (for example a community “abliterated” build) and pick an existing model with the same architecture to borrow its compiled library from.</p>
                <input type="text" class="c-name" placeholder="Name, e.g. My-Llama-3.2-3B-MLC" spellcheck="false">
                <input type="text" class="c-repo" placeholder="https://huggingface.co/user/repo-MLC" spellcheck="false">
                <select class="c-lib"></select>
                <button type="button" class="app-btn c-add">Add model</button>
                <div class="ai-custom-list"></div>
              </section>

              <section class="ai-sec">
                <label class="ai-check"><input type="checkbox" class="s-keep"> Keep the model in memory after closing this window</label>
                <label class="ai-check"><input type="checkbox" class="s-nothink"> Skip “thinking” on Qwen3 models (much faster answers; turn off for hard maths or logic)</label>
              </section>
            </aside>
          </div>

          <div class="ai-composer">
            <textarea class="ai-input" rows="1" placeholder="Message the model…  (Enter to send, Shift+Enter for a new line)" spellcheck="true"></textarea>
            <button type="button" class="app-btn primary ai-send" title="Send">${iconHTML('next', 14)}</button>
            <button type="button" class="app-btn ai-stop" title="Stop generating (Esc)" hidden>${iconHTML('pause', 14)} Stop</button>
          </div>

          <div class="app-statusbar">
            <div class="sb-cell grow ai-s-state">Starting…</div>
            <div class="sb-cell ai-s-speed"></div>
            <div class="sb-cell ai-s-ctx"></div>
          </div>
        </section>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const elApp = $('.ai-app');
    const elChats = $('.ai-chats');
    const elMsgs = $('.ai-messages');
    const elSettings = $('.ai-settings');
    const elInput = $('.ai-input');
    const elSend = $('.ai-send');
    const elStop = $('.ai-stop');
    const elModelList = $('.ai-model-list');
    const elModelActions = $('.ai-model-actions');
    const elProgress = $('.ai-progress');
    const elExport = $('.ai-export');

    // ---------- Persistence of chats ----------
    async function ensureDir() { if (!(await vfs.exists(CHAT_DIR))) await vfs.mkdir(CHAT_DIR); }

    async function loadChatList() {
      try {
        await ensureDir();
        const files = (await vfs.list(CHAT_DIR)).filter((f) => f.kind === 'file' && f.name.endsWith('.json'));
        const out = [];
        for (const f of files.slice(0, 300)) {
          try {
            const c = JSON.parse(await (await vfs.read(`${CHAT_DIR}/${f.name}`)).text());
            if (c?.id) out.push({ id: c.id, title: c.title || 'New chat', updated: c.updated || f.mtime || 0 });
          } catch { /* skip unreadable file */ }
        }
        chats = out.sort((a, b) => b.updated - a.updated);
      } catch (e) { console.error(e); chats = []; }
      renderChats();
    }

    async function saveChat() {
      if (!chat.messages.length) return;
      chat.updated = Date.now();
      try {
        await ensureDir();
        await vfs.write(`${CHAT_DIR}/${chat.id}.json`, JSON.stringify(chat));
        const i = chats.findIndex((c) => c.id === chat.id);
        const meta = { id: chat.id, title: chat.title || 'New chat', updated: chat.updated };
        if (i >= 0) chats[i] = meta; else chats.unshift(meta);
        chats.sort((a, b) => b.updated - a.updated);
        renderChats();
      } catch (e) {
        dialogs.toast(`Couldn't save the chat: ${clean(e)}`, { danger: true });
      }
    }
    const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveChat, 600); };

    async function openChat(id) {
      if (llm.getState().generating) return;
      try {
        const c = JSON.parse(await (await vfs.read(`${CHAT_DIR}/${id}.json`)).text());
        if (!Array.isArray(c.messages)) throw new Error('Invalid chat file');
        chat = c;
        usage = null;
        notice = '';
        renderMessages(true);
        renderChats();
        updateUi();
      } catch (e) {
        dialogs.toast(`Couldn't open that chat: ${clean(e)}`, { danger: true });
        loadChatList();
      }
    }

    function newChat() {
      if (llm.getState().generating) return;
      chat = blankChat();
      usage = null;
      notice = '';
      renderMessages(true);
      renderChats();
      updateUi();
      elInput.focus();
    }

    async function deleteChat(id) {
      if (!(await dialogs.confirm('Delete chat', 'Delete this conversation permanently?', 'Delete'))) return;
      try { await vfs.rm(`${CHAT_DIR}/${id}.json`); } catch (e) { console.error(e); }
      chats = chats.filter((c) => c.id !== id);
      if (chat.id === id) newChat(); else renderChats();
    }

    async function renameChat(id) {
      const meta = chats.find((c) => c.id === id);
      if (!meta) return;
      const title = await dialogs.prompt('Rename chat', 'Title:', meta.title);
      if (!title?.trim()) return;
      try {
        if (chat.id === id) { chat.title = title.trim(); await saveChat(); return; }
        const path = `${CHAT_DIR}/${id}.json`;
        const c = JSON.parse(await (await vfs.read(path)).text());
        c.title = title.trim();
        await vfs.write(path, JSON.stringify(c));
        meta.title = c.title;
        renderChats();
      } catch (e) { dialogs.toast(clean(e), { danger: true }); }
    }

    async function exportChat() {
      if (!chat.messages.length) return;
      const title = chat.title || 'AI chat';
      const md = `# ${title}\n\n_Model: ${chat.model || 'unknown'} · ${new Date(chat.updated).toLocaleString()}_\n\n` +
        chat.messages.map((m) => `**${m.role === 'user' ? 'You' : 'Assistant'}**\n\n${m.content}\n`).join('\n---\n\n');
      try {
        const safe = title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'AI chat';
        const name = await uniqueName('/home/user/Documents', `${safe}.md`);
        await vfs.write(`/home/user/Documents/${name}`, md);
        dialogs.toast(`Saved “${name}” to Documents`);
      } catch (e) { dialogs.toast(`Export failed: ${clean(e)}`, { danger: true }); }
    }

    // ---------- Rendering ----------
    function renderChats() {
      elChats.innerHTML = chats.length
        ? chats.map((c) => `
          <div class="ai-chat${c.id === chat.id ? ' active' : ''}" role="option" aria-selected="${c.id === chat.id}" tabindex="0" data-id="${esc(c.id)}" title="${esc(c.title)} — double-click to rename">
            <span class="ai-chat-title">${esc(c.title)}</span>
            <button type="button" class="ai-chat-del" data-del="${esc(c.id)}" title="Delete" aria-label="Delete chat">${iconHTML('close', 12)}</button>
          </div>`).join('')
        : '<div class="ai-hint ai-nochats">Your chats will appear here.</div>';
    }

    const selectedModel = () => models.find((m) => m.id === settings.model) ?? null;

    function onboardingHtml() {
      const st = llm.getState();
      if (runtimeError) {
        return `<div class="ai-empty"><div class="ai-empty-icon">${iconHTML('warning', 32)}</div><h3>The AI runtime couldn’t start</h3><p>${esc(runtimeError)}</p>
          <button type="button" class="app-btn primary" data-act="retry">Try again</button></div>`;
      }
      if (!gpu) {
        return `<div class="ai-empty"><div class="ai-empty-icon">${iconHTML('ai', 32)}</div><h3>Preparing the AI runtime…</h3><p>Downloading the engine (a few MB, cached afterwards).</p></div>`;
      }
      if (!gpu.ok) {
        return `<div class="ai-empty"><div class="ai-empty-icon">${iconHTML('warning', 32)}</div><h3>This device can’t run local models</h3><p>${esc(gpu.reason)}</p></div>`;
      }
      if (!st.loaded) {
        const m = selectedModel();
        const busy = st.loading;
        return `<div class="ai-empty"><div class="ai-empty-icon">${iconHTML('ai', 32)}</div>
          <h3>Run an AI on your own computer</h3>
          <p>Private and offline after the first download. ${m ? `Suggested for this machine: <b>${esc(shortName(m.id))}</b> (needs about ${esc(sizeLabel(m.vram))} of GPU memory${cached.has(m.id) ? '; already downloaded' : ''}).` : 'Open Settings to pick a model.'}</p>
          ${busy ? `<div class="ai-progress-inline"><div class="ai-progress-bar"><div class="ai-progress-fill" style="width:${Math.round((progress?.progress ?? 0) * 100)}%"></div></div><div class="ai-progress-text">${esc(progress?.text || 'Starting…')}</div></div>`
            : `<div class="ai-empty-actions"><button type="button" class="app-btn primary" data-act="load" ${m ? '' : 'disabled'}>${cached.has(m?.id) ? 'Load model' : 'Download & load'}</button>
               <button type="button" class="app-btn" data-act="settings">Choose another model</button></div>`}
        </div>`;
      }
      return `<div class="ai-empty"><div class="ai-empty-icon">${iconHTML('ai', 32)}</div><h3>${esc(shortName(st.modelId))} is ready</h3>
        <p>Ask anything. Everything stays on this computer.</p>
        <div class="ai-suggest">${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    }

    function msgHtml(m, i, last) {
      const isUser = m.role === 'user';
      const content = isUser ? `<div class="ai-text">${esc(m.content)}</div>` : `<div class="ai-text ai-md">${renderMarkdown(m.content)}</div>`;
      const err = m.error ? `<div class="ai-err">${esc(m.error)}</div>` : '';
      const actions = isUser ? '' : `<div class="ai-actions">
          <button type="button" data-act="copy" data-i="${i}">Copy</button>
          ${last && !llm.getState().generating ? '<button type="button" data-act="regen">Regenerate</button>' : ''}
        </div>`;
      return `<div class="ai-msg ${isUser ? 'user' : 'assistant'}" data-i="${i}">
        <div class="ai-role">${isUser ? 'You' : 'Assistant'}</div>${content}${err}${actions}</div>`;
    }

    function renderMessages(forceBottom = false) {
      if (!chat.messages.length) {
        elMsgs.innerHTML = onboardingHtml();
        return;
      }
      const lastIdx = chat.messages.length - 1;
      elMsgs.innerHTML = chat.messages.map((m, i) => msgHtml(m, i, i === lastIdx && m.role === 'assistant')).join('') +
        (notice ? `<div class="ai-note">${esc(notice)}</div>` : '');
      if (forceBottom || stick) elMsgs.scrollTop = elMsgs.scrollHeight;
    }

    /** During streaming only the newest assistant bubble is touched (cheap, no flicker). */
    function paintLast() {
      const i = chat.messages.length - 1;
      const el = elMsgs.querySelector(`.ai-msg[data-i="${i}"] .ai-text`);
      if (!el) { renderMessages(); return; }
      el.innerHTML = renderMarkdown(chat.messages[i].content);
      if (stick) elMsgs.scrollTop = elMsgs.scrollHeight;
    }
    const schedulePaint = () => {
      if (raf || paintTimer) return;
      const wait = Math.max(0, PAINT_MS - (performance.now() - lastPaint));
      paintTimer = setTimeout(() => {
        paintTimer = 0;
        raf = requestAnimationFrame(() => { raf = 0; lastPaint = performance.now(); paintLast(); });
      }, wait);
    };

    function renderModelList() {
      const st = llm.getState();
      if (!gpu?.ok) { elModelList.innerHTML = ''; elModelActions.innerHTML = ''; return; }
      elModelList.innerHTML = models.length ? models.map((m) => `
        <label class="ai-model${m.id === settings.model ? ' selected' : ''}">
          <input type="radio" name="aimodel" value="${esc(m.id)}" ${m.id === settings.model ? 'checked' : ''} ${st.loading ? 'disabled' : ''}>
          <span class="ai-model-main">
            <span class="ai-model-name">${esc(shortName(m.id))}</span>
            <span class="ai-model-meta">~${esc(sizeLabel(m.vram))} GPU memory${m.quant ? ' · ' + esc(m.quant) : ''}</span>
          </span>
          <span class="ai-badges">
            ${st.modelId === m.id ? '<span class="badge on">Loaded</span>' : cached.has(m.id) ? '<span class="badge">Downloaded</span>' : ''}
            ${m.lessFiltered ? '<span class="badge" title="Tuned to refuse less often. Not a guarantee.">Less filtered</span>' : ''}
            ${m.custom ? '<span class="badge">Custom</span>' : ''}
          </span>
        </label>`).join('') : '<div class="ai-hint">No models fit this machine’s memory. Tick “Show models that may not fit”.</div>';

      const sel = selectedModel();
      const loadedThis = !!sel && st.modelId === sel.id;
      elModelActions.innerHTML = `
        ${loadedThis
          ? '<button type="button" class="app-btn" data-act="unload">Unload (free GPU memory)</button>'
          : `<button type="button" class="app-btn primary" data-act="load" ${!sel || st.loading ? 'disabled' : ''}>${sel && cached.has(sel.id) ? 'Load model' : 'Download & load'}</button>`}
        ${sel && cached.has(sel.id) && !loadedThis && !st.loading ? '<button type="button" class="app-btn" data-act="uncache">Delete download</button>' : ''}`;

      elSettings.querySelector('.ai-gpu').textContent = gpu.ok
        ? `GPU: ${gpu.name || 'detected'}${gpu.f16 ? '' : ' (no 16-bit shaders: using compatible builds)'}. Models below are sized for this machine.`
        : '';
    }

    function renderCustomList() {
      $('.ai-custom-list').innerHTML = custom.map((c, i) => `
        <div class="ai-custom"><span class="truncate" title="${esc(c.model)}">${esc(c.model_id)}</span>
          <button type="button" class="ai-chat-del" data-rmcustom="${i}" title="Remove" aria-label="Remove ${esc(c.model_id)}">${iconHTML('close', 12)}</button></div>`).join('');
    }

    function renderLibChoices() {
      const opts = llm.buildAppConfig([]).model_list.filter((r) => r.model_lib && (r.model_type ?? 0) === 0);
      $('.c-lib').innerHTML = '<option value="">Borrow compiled library from…</option>' +
        opts.map((r) => `<option value="${esc(r.model_id)}">${esc(shortName(r.model_id))}</option>`).join('');
    }

    function renderProgress() {
      const st = llm.getState();
      elProgress.hidden = !st.loading;
      if (st.loading) {
        const pct = Math.round((progress?.progress ?? 0) * 100);
        elProgress.querySelector('.ai-progress-fill').style.width = pct + '%';
        elProgress.querySelector('.ai-progress-text').textContent = progress?.text || 'Starting…';
      }
      const inline = elMsgs.querySelector('.ai-progress-inline');
      if (inline) {
        inline.querySelector('.ai-progress-fill').style.width = Math.round((progress?.progress ?? 0) * 100) + '%';
        inline.querySelector('.ai-progress-text').textContent = progress?.text || 'Starting…';
      }
    }

    function updateUi() {
      const st = llm.getState();
      const chip = $('.ai-chip');
      chip.classList.toggle('on', st.loaded);
      chip.classList.toggle('busy', st.loading || st.generating);
      $('.ai-chip-name').textContent = st.loading ? 'Loading model…' : st.loaded ? shortName(st.modelId) : 'No model loaded';

      elSend.hidden = st.generating;
      elStop.hidden = !st.generating;
      elInput.disabled = !st.loaded;
      elInput.placeholder = st.loaded
        ? 'Message the model…  (Enter to send, Shift+Enter for a new line)'
        : 'Load a model to start chatting';
      elExport.disabled = !chat.messages.length;
      elSend.disabled = !st.loaded;

      $('.ai-s-state').textContent = runtimeError ? 'Runtime unavailable'
        : st.loading ? 'Loading model…'
        : tuning ? 'Warming up the GPU…'
        : st.generating ? 'Generating…'
        : st.loaded ? 'Ready' : gpu ? (gpu.ok ? 'No model loaded' : 'WebGPU unavailable') : 'Starting…';
      $('.ai-s-speed').textContent = usage?.tps ? `${usage.tps.toFixed(1)} tokens/s` : '';
      const used = trimMessages(promptMessages(), Infinity).tokens;
      $('.ai-s-ctx').textContent = st.loaded ? `~${used} / ${st.ctx} tokens` : '';

      renderModelList();
      renderProgress();
    }

    // ---------- Prompt building ----------
    function promptMessages() {
      const msgs = chat.messages.filter((m) => !(m.role === 'assistant' && !m.content)).map((m) => ({ role: m.role, content: m.content }));
      const sys = settings.system.trim();
      return sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
    }

    // ---------- Sending ----------
    async function generate() {
      const st = llm.getState();
      const budget = Math.max(512, (st.ctx || 4096) - Number(settings.maxTokens) - 64);
      const { messages, dropped } = trimMessages(promptMessages(), budget);
      notice = dropped ? `Older messages (${dropped}) were left out of the prompt to fit the model's memory window.` : '';

      const reply = { role: 'assistant', content: '' };
      chat.messages.push(reply);
      chat.model = st.modelId;
      stick = true;
      renderMessages(true);
      updateUi();

      try {
        for await (const part of llm.streamChat(messages, {
          temperature: Number(settings.temperature), top_p: Number(settings.topP), max_tokens: Number(settings.maxTokens),
          think: !settings.noThink
        })) {
          if (closed) break;
          if (part.delta) { reply.content += part.delta; schedulePaint(); }
          if (part.usage) usage = part.usage;
        }
      } catch (e) {
        const msg = clean(e);
        reply.error = /lost|out of memory|OOM|device/i.test(msg)
          ? `${msg}\nThe GPU ran out of memory. Unload the model and try a smaller one, or lower the memory window in Settings.`
          : msg;
      }
      if (!reply.content && !reply.error) reply.error = 'No response (generation was stopped).';
      if (closed) return;
      saveSoon();
      renderMessages();
      updateUi();
      elInput.focus();
    }

    async function send(text) {
      const st = llm.getState();
      text = String(text ?? '').trim();
      if (!text || st.generating) return;
      if (!st.loaded) { dialogs.toast('Load a model first.'); openSettings(true); return; }
      chat.messages.push({ role: 'user', content: text });
      if (!chat.title) chat.title = text.replace(/\s+/g, ' ').slice(0, 48);
      elInput.value = '';
      autosize();
      await generate();
    }

    async function regenerate() {
      if (llm.getState().generating) return;
      while (chat.messages.length && chat.messages.at(-1).role === 'assistant') chat.messages.pop();
      if (!chat.messages.length) return;
      await generate();
    }

    // ---------- Model actions ----------
    async function loadSelected() {
      const m = selectedModel();
      if (!m || llm.getState().loading) return;
      progress = { progress: 0, text: 'Starting…' };
      renderMessages();
      updateUi();
      try {
        await llm.loadModel(m.id, {
          custom, contextSize: Number(settings.ctx),
          onProgress: (p) => { progress = p; renderProgress(); }
        });
        cached.add(m.id);
        dialogs.toast(`${shortName(m.id)} is ready.`);
        await tune(m);
      } catch (e) {
        dialogs.alert('Couldn’t load the model', `${clean(e)}\n\nIf this is a memory error, pick a smaller model or lower the memory window in Settings.`);
      }
      progress = null;
      renderMessages();
      updateUi();
      elInput.focus();
    }

    /** Warm the GPU pipelines, measure real speed once per model + GPU, and say what would reach the target. */
    async function tune(m) {
      const key = `${gpu?.name || 'gpu'}|${m.id}`;
      let tps = bench[key]?.tps || 0;
      if (!tps) {
        tuning = true; updateUi();
        tps = await llm.benchmark();       // also compiles shaders, so the first real reply starts fast
        tuning = false;
        if (tps) { bench[key] = { tps, vram: m.vram, at: Date.now() }; writeJson(BENCH_KEY, bench); }
      }
      if (closed || !tps) { updateUi(); return; }
      usage = { tps };
      let onBattery = false;
      try { const b = await navigator.getBattery?.(); onBattery = !!b && !b.charging; } catch { /* unsupported */ }
      if (tps >= TARGET_TPS) {
        notice = '';
        dialogs.toast(`${shortName(m.id)}: ${tps.toFixed(0)} tokens/s on this GPU.`);
      } else {
        const s = suggestForSpeed(models, { tps, vram: m.vram }, TARGET_TPS);
        const tips = onBattery ? ' You are on battery: plugging in often gives a big speed-up on laptops.' : '';
        if (s?.meets && s.model.id !== m.id) {
          notice = `${shortName(m.id)} runs at about ${tps.toFixed(0)} tokens/s here. ${shortName(s.model.id)} should reach roughly ${Math.round(s.predicted)}.${tips}`;
        } else if (s && !s.meets) {
          notice = `This GPU manages about ${tps.toFixed(0)} tokens/s on ${shortName(m.id)}; even ${shortName(s.model.id)} is estimated at ${Math.round(s.predicted)}.${tips || ' Check that the browser uses your fastest GPU and is not in a power-saving mode.'}`;
        } else notice = '';
        if (notice) dialogs.toast(notice, { timeout: 12000 });
      }
      renderMessages();
      updateUi();
    }

    async function unloadNow() {
      llm.stopGeneration();
      await llm.unloadModel();
      renderMessages();
      updateUi();
    }

    async function refreshCache() {
      const set = new Set();
      for (const m of models) if (await llm.isCached(m.id, custom)) set.add(m.id);
      cached = set;
    }

    function rebuildModels() {
      models = llm.catalog({ gpu, custom, showAll: settings.showAll });
      if (!models.some((m) => m.id === settings.model)) {
        settings.model = (llm.getState().modelId && models.some((m) => m.id === llm.getState().modelId))
          ? llm.getState().modelId
          : (defaultModel(models)?.id ?? '');
      }
    }

    // ---------- Settings drawer ----------
    function openSettings(show = elSettings.hidden) {
      elSettings.hidden = !show;
      $('.ai-settings-btn').setAttribute('aria-pressed', String(show));
    }

    function bindSettings() {
      const sync = () => {
        $('.v-temp').textContent = Number(settings.temperature).toFixed(2);
        $('.v-topp').textContent = Number(settings.topP).toFixed(2);
      };
      $('.s-temp').value = settings.temperature;
      $('.s-topp').value = settings.topP;
      $('.s-max').value = String(settings.maxTokens);
      $('.s-ctx').value = String(settings.ctx);
      $('.s-system').value = settings.system;
      $('.s-keep').checked = settings.keepLoaded;
      $('.s-nothink').checked = settings.noThink;
      $('.ai-showall').checked = settings.showAll;
      sync();

      $('.s-temp').addEventListener('input', (e) => { settings.temperature = Number(e.target.value); sync(); saveSettings(); });
      $('.s-topp').addEventListener('input', (e) => { settings.topP = Number(e.target.value); sync(); saveSettings(); });
      $('.s-max').addEventListener('change', (e) => { settings.maxTokens = Number(e.target.value); saveSettings(); });
      $('.s-ctx').addEventListener('change', (e) => { settings.ctx = Number(e.target.value); saveSettings(); });
      $('.s-system').addEventListener('input', (e) => { settings.system = e.target.value; saveSettings(); });
      $('.s-keep').addEventListener('change', (e) => { settings.keepLoaded = e.target.checked; saveSettings(); });
      $('.s-nothink').addEventListener('change', (e) => { settings.noThink = e.target.checked; saveSettings(); });
      $('.ai-showall').addEventListener('change', async (e) => {
        settings.showAll = e.target.checked;
        saveSettings();
        rebuildModels();
        await refreshCache();
        updateUi();
      });

      elModelList.addEventListener('change', (e) => {
        if (e.target.name !== 'aimodel') return;
        settings.model = e.target.value;
        saveSettings();
        renderModelList();
        if (!llm.getState().loaded) renderMessages();
      });

      elSettings.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const rm = e.target.closest('[data-rmcustom]');
        if (act === 'load') loadSelected();
        else if (act === 'unload') unloadNow();
        else if (act === 'uncache') {
          const m = selectedModel();
          if (m && await dialogs.confirm('Delete download', `Remove the downloaded files for ${shortName(m.id)}? You can download it again later.`, 'Delete')) {
            try { await llm.deleteCached(m.id, custom); cached.delete(m.id); dialogs.toast('Download deleted.'); } catch (err) { dialogs.toast(clean(err), { danger: true }); }
            updateUi();
          }
        } else if (rm) {
          custom.splice(Number(rm.dataset.rmcustom), 1);
          writeJson(CUSTOM_KEY, custom);
          rebuildModels();
          renderCustomList();
          updateUi();
        }
      });

      $('.c-add').addEventListener('click', () => {
        if (!gpu?.ok) return dialogs.alert('Add model', 'The AI runtime isn\u2019t available yet, so models can\u2019t be added.');
        const name = $('.c-name').value.trim();
        const repo = $('.c-repo').value.trim().replace(/\/+$/, '');
        const borrow = $('.c-lib').value;
        const lib = llm.buildAppConfig([]).model_list.find((r) => r.model_id === borrow)?.model_lib;
        if (!/^[\w.\-]{3,80}$/.test(name)) return dialogs.alert('Add model', 'Give it a short name using letters, numbers, dots, dashes or underscores.');
        if (!/^https:\/\/huggingface\.co\/[\w.\-]+\/[\w.\-]+$/.test(repo)) return dialogs.alert('Add model', 'The repository must look like https://huggingface.co/user/repo');
        if (!lib) return dialogs.alert('Add model', 'Choose an existing model with the same architecture to borrow its compiled library from.');
        if (custom.some((c) => c.model_id === name) || llm.buildAppConfig([]).model_list.some((r) => r.model_id === name)) return dialogs.alert('Add model', 'That name is already in use.');
        custom.push({ model_id: name, model: repo, model_lib: lib, vram_required_MB: 3000, low_resource_required: true });
        writeJson(CUSTOM_KEY, custom);
        $('.c-name').value = $('.c-repo').value = '';
        settings.model = name;
        saveSettings();
        rebuildModels();
        renderCustomList();
        updateUi();
        dialogs.toast('Model added. Select it and press “Download & load”.');
      });
    }

    // ---------- Composer ----------
    function autosize() {
      elInput.style.height = 'auto';
      elInput.style.height = Math.min(elInput.scrollHeight, 160) + 'px';
    }
    elInput.addEventListener('input', autosize);
    elInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(elInput.value); }
    });
    elSend.addEventListener('click', () => send(elInput.value));
    elStop.addEventListener('click', () => llm.stopGeneration());
    elApp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && llm.getState().generating) { llm.stopGeneration(); e.preventDefault(); }
    });

    // ---------- Delegated clicks ----------
    elMsgs.addEventListener('scroll', () => { stick = elMsgs.scrollHeight - elMsgs.scrollTop - elMsgs.clientHeight < 80; });
    elMsgs.addEventListener('click', async (e) => {
      const copyCode = e.target.closest('[data-copy]');
      if (copyCode) {
        const text = copyCode.closest('.ai-code')?.querySelector('code')?.textContent ?? '';
        try { await navigator.clipboard.writeText(text); copyCode.textContent = 'Copied'; setTimeout(() => { copyCode.textContent = 'Copy'; }, 1200); } catch { dialogs.toast('Copy failed.', { danger: true }); }
        return;
      }
      const sug = e.target.closest('[data-suggest]');
      if (sug) { send(sug.dataset.suggest); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'copy') {
        try { await navigator.clipboard.writeText(chat.messages[Number(act.dataset.i)]?.content ?? ''); act.textContent = 'Copied'; setTimeout(() => { act.textContent = 'Copy'; }, 1200); } catch { dialogs.toast('Copy failed.', { danger: true }); }
      } else if (act.dataset.act === 'regen') regenerate();
      else if (act.dataset.act === 'load') loadSelected();
      else if (act.dataset.act === 'settings') openSettings(true);
      else if (act.dataset.act === 'retry') init();
    });

    $('.ai-new').addEventListener('click', newChat);
    $('.ai-side-toggle').addEventListener('click', () => elApp.classList.toggle('show-side'));
    $('.ai-settings-btn').addEventListener('click', () => openSettings());
    elExport.addEventListener('click', exportChat);
    elChats.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { deleteChat(del.dataset.del); return; }
      const row = e.target.closest('.ai-chat');
      if (row && row.dataset.id !== chat.id) openChat(row.dataset.id);
    });
    elChats.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.ai-chat');
      if (row && !e.target.closest('[data-del]')) renameChat(row.dataset.id);
    });
    elChats.addEventListener('keydown', (e) => {
      const row = e.target.closest('.ai-chat');
      if (row && e.key === 'Enter') openChat(row.dataset.id);
    });

    // ---------- Lifecycle ----------
    const unsub = llm.onChange(() => { if (!closed) { updateUi(); if (!chat.messages.length) renderMessages(); } });
    ctx.onFocus(() => { if (!elInput.disabled) elInput.focus({ preventScroll: true }); });
    ctx.onCleanup(() => {
      closed = true;
      unsub();
      cancelAnimationFrame(raf);
      clearTimeout(paintTimer);
      clearTimeout(saveTimer);
      if (chat.messages.length) saveChat();
      llm.stopGeneration();
      if (!settings.keepLoaded) llm.unloadModel();   // give the GPU memory back
    });

    async function init() {
      runtimeError = '';
      gpu = null;
      renderMessages();
      updateUi();
      try {
        const [g] = await Promise.all([llm.checkGpu(), llm.loadLib()]);
        gpu = g;
        if (gpu.ok) {
          renderLibChoices();
          rebuildModels();
          await refreshCache();
        }
      } catch (e) {
        runtimeError = clean(e);
      }
      renderCustomList();
      renderMessages();
      updateUi();
    }

    bindSettings();
    renderChats();
    await Promise.all([loadChatList(), init()]);
    if (!elInput.disabled) elInput.focus();
  }
};
