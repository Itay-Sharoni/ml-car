// Headless sanity check: does the default setup learn to finish the laps?
import { Sim, defaults } from '../src/sim.js';

const runs = Number(process.argv[2] || 5);
const over = JSON.parse(process.argv[3] || '{}');
const res = [];
for (let r = 0; r < runs; r++) {
  const sim = new Sim({ ...defaults, ...over });
  let lapGen = null, finGen = null, best = Infinity;
  sim.on('generation', (s) => {
    if (lapGen === null && s.laps >= 1) lapGen = s.gen;
    if (finGen === null && s.finished > 0) finGen = s.gen;
    if (s.bestTime < best) best = s.bestTime;
  });
  const t0 = Date.now();
  while (sim.gen <= 60 && (finGen === null || sim.gen < finGen + 15)) sim.step();
  res.push(finGen);
  console.log(`run ${r}: track n=${sim.track.n} len=${sim.track.length.toFixed(0)}m  firstLap@gen ${lapGen}  finished@gen ${finGen}  bestTime ${best.toFixed(1)}s  (${Date.now() - t0}ms)`);
}
if (res.some((g) => g === null)) { console.error('FAIL: some runs never finished'); process.exit(1); }
console.log('OK');
