// Headless sanity check: do the default settings learn to finish the laps,
// and does the champion solo run reproduce it?
// usage: node test/headless.mjs [runs] ['{"population":80}']
import { Sim, defaults } from '../src/sim.js';

const runs = Number(process.argv[2] || 3);
const over = JSON.parse(process.argv[3] || '{}');
const MAX_GENS = 80;
let failed = false;

for (let r = 0; r < runs; r++) {
  const sim = new Sim({ ...defaults, ...over });
  let lapGen = null, finGen = null, best = Infinity;
  sim.on('generation', (s) => {
    if (lapGen === null && s.laps >= 1) lapGen = s.gen;
    if (finGen === null && s.finished > 0) finGen = s.gen;
    if (s.bestTime < best) best = s.bestTime;
  });
  const t0 = Date.now();
  while (sim.gen <= MAX_GENS && (finGen === null || sim.gen < finGen + 10)) sim.step();

  // champion run: one car with the best brain should finish too
  sim.startSolo();
  while (!sim.solo.done) sim.step();
  const s = sim.solo;
  console.log(
    `run ${r}: track ${sim.track.length.toFixed(0)}m  first lap @gen ${lapGen}  finished @gen ${finGen}  best ${best.toFixed(1)}s` +
    `  | champion: ${s.ok ? 'finished' : s.car.why} ${s.car.time.toFixed(1)}s, laps ${s.laps.map((t) => t.toFixed(1)).join('/')}, top ${(s.top * 3.6).toFixed(0)} km/h, ${s.maxG.toFixed(2)} g  (${Date.now() - t0}ms)`
  );
  if (finGen === null || !s.ok) failed = true;
}
if (failed) { console.error('FAIL: a run never finished, or its champion did not'); process.exit(1); }
console.log('OK');
