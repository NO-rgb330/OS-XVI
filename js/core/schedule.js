/* Scheduling for UI that mirrors a busy background process (e.g. the disk meter during an upload).

   A trailing *debounce* ("run N ms after the last event") never fires while events keep arriving
   closer together than N ms, so the display freezes until the work is over. This scheduler instead:
     · onQuick  — cheap, live update: runs at most once per `quickEvery` ms, including during a burst
     · onFull   — exact (possibly expensive) recount: `settle` ms after activity stops, and also at
                  least every `fullEvery` ms while activity continues so it can't starve either
   Call poke() on every event; cancel() on teardown. */
export function activityScheduler({
  onQuick, onFull, quickEvery = 150, settle = 500, fullEvery = 4000,
  now = () => performance.now(), setT = setTimeout, clearT = clearTimeout
}) {
  let lastQuick = -Infinity, lastFull = now(), quickTimer = 0, fullTimer = 0;

  const runQuick = () => { quickTimer = 0; lastQuick = now(); onQuick(); };
  const runFull = () => { fullTimer = 0; lastFull = now(); onFull(); };

  return {
    poke() {
      const t = now();
      if (t - lastQuick >= quickEvery) { clearT(quickTimer); quickTimer = 0; runQuick(); }
      else if (!quickTimer) quickTimer = setT(runQuick, quickEvery - (t - lastQuick));   // trailing edge of the window

      clearT(fullTimer);
      fullTimer = setT(runFull, t - lastFull >= fullEvery ? 0 : settle);
    },
    cancel() { clearT(quickTimer); clearT(fullTimer); quickTimer = fullTimer = 0; }
  };
}
