/* ============================================================
   Local AI engine — WebLLM (https://webllm.mlc.ai) running on WebGPU.

   · The runtime is downloaded from a CDN on first use (nothing is loaded at boot).
   · The model runs in a Web Worker; weights are cached by the browser after the first download.
   · One engine is shared system-wide: loading, streaming, stopping and unloading go through here.
   ============================================================ */

import { pickModels, memoryBudgetMB } from './llm-utils.js';

export const WEBLLM_VERSION = '0.2.79';
const SOURCES = [
  `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${WEBLLM_VERSION}/+esm`,
  `https://esm.run/@mlc-ai/web-llm@${WEBLLM_VERSION}`
];

let lib = null;
let libUrl = null;
let libPromise = null;

const state = { engine: null, worker: null, modelId: null, ctx: 0, loading: false, generating: false };
const subs = new Set();
const emit = () => { for (const cb of subs) { try { cb(getState()); } catch (e) { console.error(e); } } };

export const getState = () => ({ modelId: state.modelId, ctx: state.ctx, loading: state.loading, generating: state.generating, loaded: !!state.engine });
export const onChange = (cb) => { subs.add(cb); return () => subs.delete(cb); };
export const isLoaded = () => !!state.engine;

/** Download the WebLLM runtime (once). Tries each CDN in turn. */
export function loadLib() {
  libPromise ??= (async () => {
    let last;
    for (const url of SOURCES) {
      try { lib = await import(/* webpackIgnore: true */ url); libUrl = url; return lib; } catch (e) { last = e; }
    }
    throw new Error(`Could not download the AI runtime (are you online?). ${last?.message ?? ''}`.trim());
  })().catch((e) => { libPromise = null; throw e; });     // allow a retry after a failure
  return libPromise;
}

/** WebGPU availability + the one capability that decides which model builds work. */
export async function checkGpu() {
  if (!('gpu' in navigator)) {
    return { ok: false, reason: 'This browser has no WebGPU. Use a recent Chrome or Edge (113+), and make sure hardware acceleration is on.' };
  }
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter(); } catch { /* handled below */ }
  if (!adapter) return { ok: false, reason: 'WebGPU is present but no graphics adapter was found. Enable hardware acceleration in your browser settings, or update your graphics drivers.' };
  let name = '';
  try { name = (adapter.info ?? (await adapter.requestAdapterInfo?.()))?.description || ''; } catch { /* optional */ }
  return { ok: true, f16: adapter.features.has('shader-f16'), name, deviceMemory: navigator.deviceMemory || 0 };
}

/** The runtime's built-in model list plus the user's custom entries. */
export function buildAppConfig(custom = []) {
  const base = lib.prebuiltAppConfig;
  return { ...base, model_list: [...base.model_list, ...custom.map((c) => ({ ...c, custom: true }))] };
}

/** Models suited to this machine, best first. */
export function catalog({ gpu, custom = [], showAll = false }) {
  const cfg = buildAppConfig(custom);
  return pickModels(cfg.model_list, { f16: gpu?.f16 !== false, budgetMB: memoryBudgetMB(gpu?.deviceMemory), showAll });
}

export async function isCached(modelId, custom = []) {
  try { return await lib.hasModelInCache(modelId, buildAppConfig(custom)); } catch { return false; }
}
export async function deleteCached(modelId, custom = []) {
  await lib.deleteModelAllInfoInCache(modelId, buildAppConfig(custom));
}

function makeWorker() {
  try {
    return new Worker(`${new URL('./llm-worker.js', import.meta.url).href}?lib=${encodeURIComponent(libUrl)}`, { type: 'module' });
  } catch { return null; }          // e.g. opened from file:// — fall back to the main thread
}

/**
 * Download (first time) and load a model into GPU memory.
 * `onProgress({ progress: 0..1, text })` reports download / compile progress.
 */
export async function loadModel(modelId, { custom = [], onProgress, contextSize = 4096 } = {}) {
  if (state.loading) throw new Error('A model is already loading.');
  await loadLib();
  state.loading = true;
  emit();
  try {
    if (state.engine) await unloadModel();
    const engineConfig = {
      appConfig: buildAppConfig(custom),
      initProgressCallback: (r) => onProgress?.({ progress: r.progress ?? 0, text: r.text ?? '' })
    };

    const create = async (chatOpts) => {
      const worker = makeWorker();
      try {
        if (!worker) return { engine: await lib.CreateMLCEngine(modelId, engineConfig, chatOpts), worker: null };
        const crashed = new Promise((_, reject) =>
          worker.addEventListener('error', (e) => reject(new Error(e.message || 'The AI worker could not start.'))));
        const engine = await Promise.race([lib.CreateWebWorkerMLCEngine(worker, modelId, engineConfig, chatOpts), crashed]);
        return { engine, worker };
      } catch (e) { worker?.terminate(); throw e; }
    };

    let made, ctx = contextSize;
    try {
      made = await create({ context_window_size: contextSize });   // smaller KV cache = less memory
    } catch (e) {
      // Some builds use a sliding window and reject an explicit context size: retry with the model's own.
      if (!/sliding|context_window/i.test(e.message)) throw e;
      made = await create(undefined);
      ctx = 4096;
    }
    state.engine = made.engine;
    state.worker = made.worker;
    state.modelId = modelId;
    state.ctx = ctx;
  } finally {
    state.loading = false;
    emit();
  }
}

/** Free the model's GPU memory completely (the worker is terminated). */
export async function unloadModel() {
  const { engine, worker } = state;
  state.engine = state.worker = state.modelId = null;
  state.ctx = 0;
  state.generating = false;
  try { await engine?.unload(); } catch { /* already gone */ }
  worker?.terminate();
  emit();
}

export function stopGeneration() {
  try { state.engine?.interruptGenerate(); } catch { /* nothing running */ }
}

/**
 * Stream a reply. Yields { delta } text pieces, then a final { usage } with tokens/second.
 * Stop it with stopGeneration(); the partial text already yielded is still valid.
 */
export async function* streamChat(messages, { temperature = 0.7, top_p = 0.95, max_tokens = 1024 } = {}) {
  if (!state.engine) throw new Error('No model is loaded.');
  if (state.generating) throw new Error('Already generating.');
  state.generating = true;
  emit();
  try {
    const stream = await state.engine.chat.completions.create({
      messages, stream: true, stream_options: { include_usage: true }, temperature, top_p, max_tokens
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield { delta };
      if (chunk.usage) {
        yield { usage: { prompt: chunk.usage.prompt_tokens, completion: chunk.usage.completion_tokens, tps: chunk.usage.extra?.decode_tokens_per_s } };
      }
    }
  } finally {
    state.generating = false;
    emit();
  }
}
