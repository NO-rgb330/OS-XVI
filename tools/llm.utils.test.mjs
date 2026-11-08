// Run:  node tools/llm-utils.test.mjs      (no dependencies)
import assert from 'node:assert/strict';
import { pickModels, defaultModel, predictTps, suggestForSpeed, baseName, thinksByDefault } from '../js/core/llm-utils.js';

// Synthetic records; vram_required_MB values are in the range of WebLLM's built-in list.
const R = (model_id, vram_required_MB) => ({ model_id, vram_required_MB, model_type: 0 });
const LIST = [
  R('Qwen3-4B-q4f16_1-MLC', 3431), R('Qwen3-4B-q4f32_1-MLC', 4327),
  R('Llama-3.2-3B-Instruct-q4f16_1-MLC', 2264), R('Llama-3.2-3B-Instruct-q4f32_1-MLC', 2951),
  R('Qwen3-1.7B-q4f16_1-MLC', 2037), R('Qwen3-1.7B-q4f32_1-MLC', 2635),
  R('Qwen3-0.6B-q4f16_1-MLC', 1404), R('SmolLM2-360M-Instruct-q0f16-MLC', 872),
  R('Qwen3-4B-q4f16_1-MLC-1k', 2800), { model_id: 'snowflake-arctic-embed-s-q0f32-MLC-b4', vram_required_MB: 239, model_type: 1 }
];

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('baseName strips quant + packaging', () => {
  assert.equal(baseName('Qwen3-4B-q4f16_1-MLC'), 'Qwen3-4B');
  assert.equal(baseName('Qwen3-4B-q4f32_1-MLC'), 'Qwen3-4B');
});

t('f16 GPU: slower q4f32 duplicates are hidden, embeddings and -1k builds excluded', () => {
  const ids = pickModels(LIST, { f16: true, budgetMB: 3600 }).map((m) => m.id);
  assert.ok(!ids.some((i) => /q4f32/.test(i)), ids.join());
  assert.ok(!ids.some((i) => /embed|-1k/i.test(i)));
  assert.ok(ids.includes('Qwen3-4B-q4f16_1-MLC'));
});

t('REGRESSION: old logic defaulted to a q4f32 build on an f16 GPU', () => {
  // Old pipeline: no dedupe, biggest-first, then "first model that fits in 2700 MB".
  const old = LIST.filter((r) => r.model_type === 0 && !/-1k$/.test(r.model_id) && r.vram_required_MB <= 3600)
    .sort((a, b) => b.vram_required_MB - a.vram_required_MB)
    .find((r) => r.vram_required_MB <= 2700);
  assert.equal(old.model_id, 'Qwen3-1.7B-q4f32_1-MLC');          // old: small *and* the slow f32 build
  const now = defaultModel(pickModels(LIST, { f16: true, budgetMB: 3600 }));
  assert.equal(now.id, 'Llama-3.2-3B-Instruct-q4f16_1-MLC');     // new: a bigger, faster-to-run f16 build
});

t('no-f16 GPU: only f32 builds are offered', () => {
  const ids = pickModels(LIST, { f16: false, budgetMB: 5000 }).map((m) => m.id);
  assert.ok(ids.length && ids.every((i) => !/q4f16|q0f16/.test(i)), ids.join());
});

t('showAll keeps the f32 builds reachable', () => {
  assert.ok(pickModels(LIST, { f16: true, showAll: true }).some((m) => /q4f32/.test(m.id)));
});

t('predictTps scales inversely with weight size', () => {
  const half = predictTps(20, 1400 + 600, 2800 + 600);        // weights 1400 → 2800 MB
  assert.ok(Math.abs(half - 10) < 0.01, half);
});

t('suggestForSpeed: fast GPU keeps the biggest model', () => {
  const models = pickModels(LIST, { f16: true, budgetMB: 3600 });
  const s = suggestForSpeed(models, { tps: 40, vram: 3431 }, 20);   // measured 40 tok/s on the 4B
  assert.equal(s.model.id, 'Qwen3-4B-q4f16_1-MLC'); assert.ok(s.meets);
});

t('suggestForSpeed: slow GPU steps down to a model predicted to reach 20', () => {
  const models = pickModels(LIST, { f16: true, budgetMB: 3600 });
  const s = suggestForSpeed(models, { tps: 14, vram: 3431 }, 20);   // 4B gives 14 → need ≥ 21 predicted
  assert.ok(s.meets && s.predicted >= 21, JSON.stringify(s.predicted));
  assert.notEqual(s.model.id, 'Qwen3-4B-q4f16_1-MLC');
  assert.equal(s.model.id, 'Llama-3.2-3B-Instruct-q4f16_1-MLC');    // largest that still clears the bar
});

t('suggestForSpeed: hopeless GPU → lightest model, meets=false', () => {
  const models = pickModels(LIST, { f16: true, budgetMB: 3600 });
  const s = suggestForSpeed(models, { tps: 2, vram: 3431 }, 20);
  assert.equal(s.meets, false); assert.equal(s.model.id, 'SmolLM2-360M-Instruct-q0f16-MLC');
});

t('thinksByDefault', () => { assert.ok(thinksByDefault('Qwen3-4B-q4f16_1-MLC')); assert.ok(!thinksByDefault('Llama-3.2-3B-Instruct-q4f16_1-MLC')); });

t('defaultModel still returns something sensible', () => {
  const m = defaultModel(pickModels(LIST, { f16: true, budgetMB: 3600 }));
  assert.match(m.id, /q4f16/); assert.ok(m.vram <= 2700);
});

console.log(`\n${n} passed`);
