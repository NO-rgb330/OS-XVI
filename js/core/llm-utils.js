/* Pure helpers for the Local AI app (no DOM, no network) so they can be unit-tested. */

/** Families that are tuned to refuse less. A hint only: no model is guaranteed to never refuse. */
export const LESS_FILTERED = /hermes|dolphin|abliterat|uncensor|lexi|wizard|openhermes|nous|samantha/i;

/** Rough GPU-memory budget (MB) for a model + KV cache, from the browser's coarse RAM report. */
export function memoryBudgetMB(deviceMemoryGB) {
  if (!deviceMemoryGB) return 3000;      // not reported (Firefox / Safari): assume a modest machine
  if (deviceMemoryGB >= 8) return 3600;  // Chrome reports 8 for "8 GB or more"
  if (deviceMemoryGB >= 4) return 2400;
  return 1500;
}

export const sizeLabel = (mb) => (mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);

/** Normalise one WebLLM model record. */
export function describe(rec) {
  const id = rec.model_id;
  return {
    id,
    vram: Number(rec.vram_required_MB) || 0,
    f16: /q\d+f16/i.test(id),
    quant: (id.match(/q\d+f(?:16|32)(?:_\d)?/i) || [''])[0],
    lessFiltered: LESS_FILTERED.test(id) || LESS_FILTERED.test(rec.model || ''),
    shortCtx: /-1k$/i.test(id),
    custom: !!rec.custom,
    rec
  };
}

/**
 * Models worth showing, best first.
 *  · text-only LLMs (no embedding / vision models)
 *  · without shader-f16 support, only the f32 builds work
 *  · within `budgetMB` unless `showAll`
 * Order: less-filtered families first, then larger (= more capable) models that still fit.
 */
export function pickModels(list, { f16 = true, budgetMB = 3000, showAll = false } = {}) {
  return list
    .filter((r) => r?.model_id && (r.model_type ?? 0) === 0 && !/embed/i.test(r.model_id))
    .map(describe)
    .filter((m) => f16 || !m.f16)
    .filter((m) => showAll || m.custom || (m.vram <= budgetMB && !m.shortCtx))
    .sort((a, b) =>
      (b.custom - a.custom) || (b.lessFiltered - a.lessFiltered) || (b.vram - a.vram) || a.id.localeCompare(b.id));
}

/** The model to suggest first: best-ranked one that is comfortably light (<= `lightMB`). */
export function defaultModel(models, lightMB = 2700) {
  return models.find((m) => m.vram && m.vram <= lightMB && !m.custom)
    ?? models.find((m) => m.vram)
    ?? models[0] ?? null;
}

const estTokens = (s) => Math.ceil(String(s).length / 3.6) + 4;

/**
 * Keep the system prompt and as many of the newest messages as fit `budgetTokens`.
 * The newest message is always kept (truncated from its start if it alone is too long).
 * → { messages, dropped, tokens }
 */
export function trimMessages(messages, budgetTokens) {
  const system = messages[0]?.role === 'system' ? messages[0] : null;
  const rest = system ? messages.slice(1) : messages.slice();
  let used = system ? estTokens(system.content) : 0;
  const kept = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    let m = rest[i];
    const cost = estTokens(m.content);
    if (kept.length && used + cost > budgetTokens) break;
    if (!kept.length && used + cost > budgetTokens) {          // newest message alone is too big
      const room = Math.max(200, budgetTokens - used);
      m = { ...m, content: '…' + m.content.slice(-Math.floor(room * 3.6)) };
    }
    used += estTokens(m.content);
    kept.unshift(m);
  }
  return { messages: system ? [system, ...kept] : kept, dropped: rest.length - kept.length, tokens: used };
}
