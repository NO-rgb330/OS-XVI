/* ============================================================
   Local AI engine — WebLLM (https://webllm.mlc.ai) running on WebGPU.

   · The runtime is downloaded from a CDN on first use (nothing is loaded at boot).
   · The model runs in a Web Worker; weights are cached by the browser after the first download.
   · One engine is shared system-wide: loading, streaming, stopping and unloading go through here.
   ============================================================ */

import { pickModels, memoryBudgetMB, thinksByDefault } from './llm-utils.js';

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

/** WebGPU availability + the capabilities that decide which model builds work and how fast they run. */
export async function checkGpu() {
  if (!('gpu' in navigator)) {
    return { ok: false, reason: 'This browser has no WebGPU. Use a recent Chrome or Edge (113+), and make sure hardware acceleration is on.' };
  }
  // Ask for the same adapter the runtime will use. A bare requestAdapter() can return the integrated GPU on
  // laptops that also have a discrete one, which gave a wrong shader-f16 answer and a wrong name.
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); } catch { /* handled below */ }
  if (!adapter) { try { adapter = await navigator.gpu.requestAdapter(); } catch { /* handled below */ } }
  if (!adapter) return { ok: false, reason: 'WebGPU is present but no graphics adapter was found. Enable hardware acceleration in your browser settings, or update your graphics drivers.' };
  let info = null;
  try { info = adapter.info ?? (await adapter.requestAdapterInfo?.()) ?? null; } catch { /* optional */ }
  const name = [info?.vendor, info?.description || info?.architecture].filter(Boolean).join(' ').trim();
  // A software rasteriser (SwiftShader / "fallback adapter") runs models at 1–3 tokens/s. Say so instead of crawling.
  if (adapter.isFallbackAdapter || info?.isFallbackAdapter) {
    return { ok: false, reason: 'Your browser is using a software graphics renderer, which is far too slow for AI models. Turn on hardware acceleration (Settings → System), update your graphics driver, and check chrome://gpu.' };
  }
  const lim = adapter.limits ?? {};
  return {
    ok: true, f16: adapter.features.has('shader-f16'), name, deviceMemory: navigator.deviceMemory || 0,
    maxBufferMB: Math.round((lim.maxBufferSize || 0) / 1048576)
  };
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
export async function* streamChat(messages, { temperature = 0.7, top_p = 0.95, max_tokens = 1024, think = true } = {}) {
  if (!state.engine) throw new Error('No model is loaded.');
  if (state.generating) throw new Error('Already generating.');
  state.generating = true;
  emit();
  try {
    const req = { messages, stream: true, stream_options: { include_usage: true }, temperature, top_p, max_tokens };
    // Qwen3 reasons inside <think> for hundreds of tokens before answering; skipping that is the biggest
    // "speed-up" the user can feel, and it stops the reply from being cut off by max_tokens mid-thought.
    if (!think && thinksByDefault(state.modelId)) req.extra_body = { enable_thinking: false };
    const stream = await state.engine.chat.completions.create(req);
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

/**
 * Warm up the GPU pipelines (shaders compile lazily on first use, which makes the first reply slow) and measure
 * steady-state decode speed. Costs about 2–4 seconds. → tokens/second, or 0 if it could not be measured.
 */
export async function benchmark() {
  if (!state.engine || state.generating) return 0;
  state.generating = true;
  emit();
  const run = async (maxTokens) => {
    const req = {
      messages: [{ role: 'user', content: 'Count from 1 to 60, separated by commas.' }],
      stream: true, stream_options: { include_usage: true }, temperature: 0, max_tokens: maxTokens
    };
    if (thinksByDefault(state.modelId)) req.extra_body = { enable_thinking: false };
    let tps = 0;
    for await (const chunk of await state.engine.chat.completions.create(req)) {
      if (chunk.usage) tps = chunk.usage.extra?.decode_tokens_per_s || 0;
    }
    return tps;
  };
  try {
    await run(12);                 // compile pipelines, touch every weight buffer once
    const tps = await run(64);     // the real measurement
    try { await state.engine.resetChat(); } catch { /* not critical */ }
    return tps;
  } catch { return 0; }
  finally { state.generating = false; emit(); }
}
