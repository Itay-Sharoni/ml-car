// The simulation: car physics, distance sensors, fitness scoring and the
// genetic algorithm. No rendering in here, so it also runs headless in Node.
import { Brain } from './brain.js';
import { buildTrack } from './track.js';

export const DT = 1 / 60;

export const defaults = {
  // evolution
  population: 60,
  elites: 4,
  tournament: 3,
  mutationRate: 0.12,
  mutationStrength: 0.35,
  crossover: true,
  timeLimit: 180,
  lapsTarget: 3,
  // brain
  sensors: 7,
  sensorRange: 70,
  sensorFov: 180,
  hiddenLayers: 1,
  hiddenSize: 8,
  // car
  maxSpeed: 46,
  accel: 16,
  brake: 30,
  grip: 20,
  steerLock: 0.55,
  // track
  trackSeed: 7,
  trackPoints: 18,
  trackTwist: 0.5,
  trackWidth: 11,
  trackEvery: 0,
};

export function sensorAngle(cfg, k, n = cfg.sensors) {
  if (n <= 1) return 0;
  const f = (cfg.sensorFov * Math.PI) / 180;
  return -f / 2 + (f * k) / (n - 1);
}

export function brainSizes(cfg) {
  const s = [cfg.sensors + 1];
  for (let i = 0; i < cfg.hiddenLayers; i++) s.push(cfg.hiddenSize);
  s.push(2);
  return s;
}

export class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.handlers = {};
    this.human = null;
    this.buildTrack();
    this.reset();
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.handlers[ev] || []) fn(...a); }

  buildTrack() {
    const c = this.cfg;
    this.track = buildTrack({ seed: c.trackSeed, points: c.trackPoints, twist: c.trackTwist, width: c.trackWidth });
    if (this.human) this.human = this.makeCar(null, -1);
  }

  // Throw away all learning and start from random brains (or from a seed brain).
  reset(seed) {
    const c = this.cfg;
    const sizes = brainSizes(c);
    this.gen = 1;
    this.history = [];
    this.champion = seed || null;
    this.records = { lap: false, finish: false, bestTime: Infinity, bestFitness: 0 };
    const brains = [];
    for (let i = 0; i < c.population; i++) {
      if (!seed) brains.push(new Brain(sizes));
      else brains.push(i === 0 ? seed.clone() : Brain.breed(seed, null, c.mutationRate, c.mutationStrength));
    }
    this.spawn(brains);
  }

  // Same brains, fresh attempt (used when the track changes).
  restartGeneration() {
    this.spawn(this.cars.map((c) => c.brain));
  }

  spawn(brains) {
    this.cars = brains.map((b, i) => this.makeCar(b, i));
    this.time = 0;
    this.alive = this.cars.length;
  }

  makeCar(brain, id) {
    const T = this.track;
    const n = brain ? brain.sizes[0] - 1 : this.cfg.sensors;
    return {
      id, brain, gen: this.gen,
      x: T.cx[0], z: T.cz[0], h: Math.atan2(T.tx[0], T.tz[0]),
      v: 0, steer: 0, thr: 0, slip: false,
      seg: 0, prog: 0, bestProg: 0, stall: 0, lat: 0,
      alive: true, finished: false, why: '', time: 0, fitness: 0,
      rays: new Float32Array(n), inp: new Float32Array(n + 1),
    };
  }

  // Cast distance rays from the car to the road edges -> network inputs in 0..1
  sense(car) {
    const cfg = this.cfg, T = this.track, N = T.n;
    const n = car.rays.length, range = cfg.sensorRange;
    const half = (N >> 1) - 1;
    const fwd = Math.min(half, Math.ceil(range / T.segLen) + 4);
    const back = Math.min(half, cfg.sensorFov > 180 ? fwd : 12);
    const ox = car.x, oz = car.z;
    for (let k = 0; k < n; k++) {
      const a = car.h + sensorAngle(cfg, k, n);
      const dx = Math.sin(a), dz = Math.cos(a);
      let best = range;
      for (let j = -back; j <= fwd; j++) {
        const i = (((car.seg + j) % N) + N) % N, i2 = (i + 1) % N;
        for (let e = 0; e < 2; e++) {
          const ax = e ? T.rx[i] : T.lx[i], az = e ? T.rz[i] : T.lz[i];
          const bx = e ? T.rx[i2] : T.lx[i2], bz = e ? T.rz[i2] : T.lz[i2];
          const v1x = ox - ax, v1z = oz - az, v2x = bx - ax, v2z = bz - az;
          const den = v2x * dz - v2z * dx;
          if (den > -1e-9 && den < 1e-9) continue;
          const t = (v1x * v2z - v1z * v2x) / den;
          if (t < 0 || t >= best) continue;
          const u = (v1x * dz - v1z * dx) / den;
          if (u >= 0 && u <= 1) best = t;
        }
      }
      car.rays[k] = best;
      car.inp[k] = best / range;
    }
    car.inp[n] = car.v / cfg.maxSpeed;
  }

  // Physics: steer in -1..1 (positive = left), thr in -1..1 (negative = brake)
  move(car, steer, thr, dt) {
    const c = this.cfg, T = this.track, N = T.n;
    car.steer = steer; car.thr = thr;
    car.v += (thr > 0 ? thr * c.accel : thr * c.brake) * dt - (c.accel / c.maxSpeed) * car.v * dt;
    if (car.v < 0) car.v = 0;
    let yaw = (car.v * Math.tan(steer * c.steerLock)) / 2.6;
    const lim = c.grip / Math.max(car.v, 1); // tyres can only turn so hard at speed
    car.slip = Math.abs(yaw) > lim;
    if (yaw > lim) yaw = lim; else if (yaw < -lim) yaw = -lim;
    car.h += yaw * dt;
    car.x += Math.sin(car.h) * car.v * dt;
    car.z += Math.cos(car.h) * car.v * dt;

    // where are we along the track?
    let bestD = Infinity, bestJ = 0, bestU = 0;
    for (let j = -4; j <= 8; j++) {
      const i = (((car.seg + j) % N) + N) % N, i2 = (i + 1) % N;
      const sx = T.cx[i2] - T.cx[i], sz = T.cz[i2] - T.cz[i];
      let u = ((car.x - T.cx[i]) * sx + (car.z - T.cz[i]) * sz) / (sx * sx + sz * sz);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = car.x - (T.cx[i] + sx * u), ez = car.z - (T.cz[i] + sz * u);
      const d = ex * ex + ez * ez;
      if (d < bestD) { bestD = d; bestJ = j; bestU = u; }
    }
    car.segAbs = (car.segAbs || 0) + bestJ;
    car.seg = (((car.seg + bestJ) % N) + N) % N;
    car.prog = car.segAbs + bestU;
    car.lat = Math.sqrt(bestD);
    car.off = car.lat > T.hw - 0.8;
  }

  kill(car, why) {
    car.alive = false; car.why = why; car.v = 0;
    car.fitness = this.fitness(car);
    this.alive--;
  }

  // The score evolution tries to maximise: distance driven, plus a speed bonus for finishing.
  fitness(car) {
    const dist = Math.max(0, car.prog) * this.track.segLen;
    if (!car.finished) return dist;
    return dist * (1 + (2 * dist) / car.time / this.cfg.maxSpeed);
  }

  step() {
    const cfg = this.cfg, N = this.track.n;
    for (const car of this.cars) {
      if (!car.alive) continue;
      this.sense(car);
      const o = car.brain.forward(car.inp);
      this.move(car, o[0], o[1], DT);
      car.time += DT;
      if (car.off) { this.kill(car, 'crashed'); continue; }
      if (car.prog > car.bestProg + 0.25) { car.bestProg = car.prog; car.stall = 0; }
      else if ((car.stall += DT) > 3) { this.kill(car, 'stalled'); continue; }
      if (!this.records.lap && car.prog >= N) { this.records.lap = true; this.emit('milestone', 'lap', car); }
      if (car.prog >= cfg.lapsTarget * N) {
        car.finished = true;
        this.kill(car, 'finished');
        const first = !this.records.finish, record = car.time < this.records.bestTime;
        this.records.finish = true;
        if (record) this.records.bestTime = car.time;
        if (first || record) this.emit('milestone', first ? 'finish' : 'record', car);
      }
    }
    this.time += DT;
    if (this.alive === 0 || this.time >= cfg.timeLimit) this.evolve();
  }

  // Selection -> crossover -> mutation. This is where the learning happens.
  evolve() {
    const cfg = this.cfg, N = this.track.n;
    for (const c of this.cars) if (c.alive) c.fitness = this.fitness(c);
    const ranked = [...this.cars].sort((a, b) => b.fitness - a.fitness);
    const sum = ranked.reduce((s, c) => s + c.fitness, 0);
    const stats = {
      gen: this.gen,
      best: ranked[0].fitness,
      avg: sum / ranked.length,
      laps: Math.min(cfg.lapsTarget, Math.max(0, Math.floor(ranked.reduce((m, c) => Math.max(m, c.prog), 0) / N))),
      finished: ranked.filter((c) => c.finished).length,
      bestTime: ranked.reduce((m, c) => (c.finished ? Math.min(m, c.time) : m), Infinity),
    };
    this.history.push(stats);
    this.records.bestFitness = Math.max(this.records.bestFitness, stats.best);
    this.champion = ranked[0].brain;

    const P = cfg.population, E = Math.min(cfg.elites, P, ranked.length);
    const pick = () => {
      let best = null;
      for (let k = 0; k < cfg.tournament; k++) {
        const c = ranked[(Math.random() * ranked.length) | 0];
        if (!best || c.fitness > best.fitness) best = c;
      }
      return best.brain;
    };
    const next = [];
    for (let i = 0; i < E; i++) next.push(ranked[i].brain.clone());
    while (next.length < P) next.push(Brain.breed(pick(), cfg.crossover ? pick() : null, cfg.mutationRate, cfg.mutationStrength));

    this.gen++;
    if (cfg.trackEvery > 0 && (this.gen - 1) % cfg.trackEvery === 0) {
      cfg.trackSeed = (Math.random() * 1e9) | 0;
      this.buildTrack();
      this.emit('track');
    }
    this.spawn(next);
    this.emit('generation', stats);
  }

  // ---- drive-it-yourself car -------------------------------------------
  setHuman(on) { this.human = on ? this.makeCar(null, -1) : null; }

  stepHuman(steer, thr) {
    const h = this.human;
    if (!h) return;
    this.sense(h);
    this.move(h, steer, thr, DT);
    h.time += DT;
    if (h.off) { this.human = this.makeCar(null, -1); this.emit('humanCrash'); }
  }
}
