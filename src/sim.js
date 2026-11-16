// The simulation: sports-car physics, distance sensors, fitness scoring and the
// genetic algorithm. No rendering in here, so it also runs headless in Node.
import { Brain } from './brain.js';
import { buildTrack } from './track.js';

export const DT = 1 / 60;
const SUBSTEPS = 2;

// Car geometry (metres). Mass, power, grip etc. are tunable in cfg.
const WB = 2.6, CG_A = 1.3, CG_B = 1.3, CG_H = 0.46; // wheelbase, CG->front axle, CG->rear axle, CG height
const TIRE_B = 12;        // tyre stiffness: grip peaks at roughly 8 degrees of slip
const STEER_RATE = 5;     // how fast the steering wheel can move (full lock per 0.2 s)
const PEDAL_RATE = 8;     // how fast the pedals can move
export const SPEED_REF = 70; // m/s used to normalise the speed input
export const EXTRA_INPUTS = 3; // speed, sideways slip, yaw rate

export const defaults = {
  // evolution
  population: 80,
  elites: 3,
  tournament: 5,
  mutationRate: 0.12,
  mutationStrength: 0.25,
  crossover: true,
  speedWeight: 1, // how much pace counts in the score (0 = only distance matters)
  minPace: 0.4,     // cars slower than this fraction of par pace are eliminated
  timeLimit: 300,
  lapsTarget: 3,
  // brain
  sensors: 9,
  sensorRange: 120,
  sensorFov: 140,
  sensorFocus: 1,   // >1 packs more rays toward straight ahead
  hiddenLayers: 1,
  hiddenSize: 10,
  // car
  power: 420,      // hp
  mass: 1300,      // kg
  grip: 1.25,      // tyre friction coefficient
  downforce: 1.5,  // aero: more grip the faster you go
  brake: 1.6,      // max brake force in g
  gravity: 9.81,
  steerLock: 0.55, // rad
  drive: 'RWD',
  aids: true,      // ABS + traction control
  steerAssist: true,
  // track
  trackSeed: 7,
  trackSize: 200,
  trackPoints: 14,
  trackTwist: 0.5,
  trackWidth: 12,
  trackHills: 8,
  trackEvery: 0,
};

export function sensorAngle(cfg, k, n = cfg.sensors) {
  if (n <= 1) return 0;
  const f = (cfg.sensorFov * Math.PI) / 180;
  const t = (2 * k) / (n - 1) - 1; // -1 (right) .. 1 (left)
  return (t < 0 ? -1 : 1) * Math.pow(Math.abs(t), cfg.sensorFocus) * (f / 2);
}

export function brainSizes(cfg) {
  const s = [cfg.sensors + EXTRA_INPUTS];
  for (let i = 0; i < cfg.hiddenLayers; i++) s.push(cfg.hiddenSize);
  s.push(2);
  return s;
}

export class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.handlers = {};
    this.human = null;
    this.solo = null;
    this.buildTrack();
    this.reset();
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.handlers[ev] || []) fn(...a); }

  buildTrack() {
    const c = this.cfg;
    this.track = buildTrack({ seed: c.trackSeed, points: c.trackPoints, twist: c.trackTwist, width: c.trackWidth, radius: c.trackSize, hills: c.trackHills });
    if (this.human) this.human = this.makeCar(null, -1);
    this.updatePar();
  }

  // "Par": the lap time of an ideal driver who follows the centre line at the
  // limit of grip, power and brakes of the current car. It is the yardstick the
  // score uses to decide whether a car is fast or slow. (Cars can beat it by
  // cutting corners on a proper racing line.)
  updatePar() {
    const c = this.cfg, T = this.track, N = T.n, ds = T.segLen, m = c.mass, g = c.gravity, mu = c.grip;
    const v = new Float64Array(N), aero = (mu * 0.6 * c.downforce) / m, VMAX = 95;
    for (let i = 0; i < N; i++) {
      const den = Math.abs(T.curv[i]) - aero;
      v[i] = den > 1e-4 ? Math.min(VMAX, Math.sqrt((mu * g) / den)) : VMAX; // cornering limit
    }
    const traction = mu * g * (c.drive === 'AWD' ? 1 : 0.55);
    const braking = Math.min(c.brake * 9.81, mu * g);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) { // accelerate out of corners
        const j = (i + 1) % N;
        const a = Math.min(traction, (c.power * 745.7) / m / Math.max(v[i], 4)) - (0.372 * v[i] * v[i]) / m - g * T.slope[i];
        v[j] = Math.min(v[j], Math.sqrt(Math.max(9, v[i] * v[i] + 2 * a * ds)));
      }
      for (let i = N - 1; i >= 0; i--) { // brake in time for the next one
        const j = (i + 1) % N;
        const b = braking + (0.372 * v[j] * v[j]) / m + g * T.slope[i];
        v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * Math.max(1, b) * ds));
      }
    }
    let t = 0;
    for (let i = 0; i < N; i++) t += ds / v[i];
    this.par = { lap: t, total: t * c.lapsTarget, pace: T.length / t };
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
    this.updatePar(); // car settings may have changed since the last generation
    this.cars = brains.map((b, i) => this.makeCar(b, i));
    this.time = 0;
    this.alive = this.cars.length;
  }

  makeCar(brain, id) {
    const T = this.track;
    const n = brain ? brain.sizes[0] - EXTRA_INPUTS : this.cfg.sensors;
    return {
      id, brain, gen: this.gen,
      x: T.cx[0], y: T.cy[0], z: T.cz[0], h: Math.atan2(T.tx[0], T.tz[0]), pitch: 0,
      vx: 0, vy: 0, r: 0, v: 0, ax: 0, ay: 0,   // body-frame velocity, yaw rate, speed, accelerations
      steer: 0, thr: 0, slip: false,
      seg: 0, segAbs: 0, prog: 0, bestProg: 0, stall: 0, lat: 0, off: false,
      alive: true, finished: false, why: '', time: 0, fitness: 0,
      rays: new Float32Array(n), inp: new Float32Array(n + EXTRA_INPUTS),
    };
  }

  // Cast distance rays from the car to the road edges -> network inputs
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
    car.inp[n] = car.v / SPEED_REF;   // how fast am I going
    car.inp[n + 1] = car.vy / 8;      // am I sliding sideways
    car.inp[n + 2] = car.r / 1.5;     // how fast am I rotating
  }

  // One physics sub-step: a "dynamic bicycle" model, the standard simplified
  // model of a real car. Tyres make sideways force from slip angle, load shifts
  // between axles under braking/acceleration, and each tyre has a grip budget
  // shared between turning and accelerating/braking (the friction circle).
  physics(car, dt) {
    const c = this.cfg, T = this.track, i = car.seg;
    const m = c.mass, Iz = m * 1.55, g = c.gravity;
    const sh = Math.sin(car.h), ch = Math.cos(car.h); // forward = (sh, ch), left = (ch, -sh)

    // gravity on the slope + load change over crests and through dips
    const along = T.tx[i] * sh + T.tz[i] * ch, side = T.tx[i] * ch - T.tz[i] * sh;
    const sl = T.slope[i], cosS = 1 / Math.sqrt(1 + sl * sl);
    const va = car.vx * along;
    const gN = Math.max(0.15 * g, g * cosS + va * va * T.curvV[i]);
    const gx = -g * sl * cosS * along, gy = -g * sl * cosS * side;

    // vertical load on each axle: static weight + weight transfer + aero downforce
    const v2 = car.vx * car.vx + car.vy * car.vy, v = Math.sqrt(v2);
    const down = 0.6 * c.downforce * v2;
    const shift = (m * car.ax * CG_H) / WB;
    const Wf = Math.max(150, (m * gN * CG_B) / WB - shift + 0.4 * down);
    const Wr = Math.max(150, (m * gN * CG_A) / WB + shift + 0.6 * down);

    // engine (power-limited) or brakes
    let Fxf = 0, Fxr = 0;
    if (car.thr > 0) {
      const F = car.thr * Math.min(1.15 * m * 9.81, (c.power * 745.7) / Math.max(car.vx, 4));
      if (c.drive === 'RWD') Fxr = F; else if (c.drive === 'FWD') Fxf = F; else { Fxf = 0.4 * F; Fxr = 0.6 * F; }
    } else if (car.vx > 0.2) {
      const F = car.thr * c.brake * m * 9.81;
      Fxf = 0.62 * F; Fxr = 0.38 * F;
    }

    // friction circle: what is spent on drive/brake is not available for cornering
    const capF = c.grip * Wf, capR = c.grip * 1.06 * Wr;
    let latF, latR, lim = capF * 0.96;
    car.slip = false;
    if (Fxf > lim || Fxf < -lim) {
      const s = Fxf > 0 ? 1 : -1; car.slip = true;
      if (c.aids) { Fxf = s * lim; latF = capF * 0.28; } else { Fxf = s * capF * 0.78; latF = capF * 0.1; } // locked/spinning wheels barely steer
    } else latF = Math.sqrt(capF * capF - Fxf * Fxf);
    lim = capR * 0.96;
    if (Fxr > lim || Fxr < -lim) {
      const s = Fxr > 0 ? 1 : -1; car.slip = true;
      if (c.aids) { Fxr = s * lim; latR = capR * 0.28; } else { Fxr = s * capR * 0.78; latR = capR * 0.1; }
    } else latR = Math.sqrt(capR * capR - Fxr * Fxr);

    // tyre slip angles -> sideways forces (simplified Pacejka "magic formula")
    const vxs = Math.max(car.vx, 3);
    const delta = car.steer * c.steerLock;
    const af = Math.atan2(car.vy + CG_A * car.r, vxs) - delta;
    const ar = Math.atan2(car.vy - CG_B * car.r, vxs);
    const Fyf = -latF * Math.sin(1.5 * Math.atan(TIRE_B * af));
    const Fyr = -latR * Math.sin(1.5 * Math.atan(TIRE_B * ar));
    if (af > 0.16 || af < -0.16 || ar > 0.16 || ar < -0.16) car.slip = true;

    // Newton: forces -> accelerations in the car's own frame
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const fx = (Fxf * cd - Fyf * sd + Fxr - 0.372 * v * car.vx - (car.vx > 0.1 ? 0.015 * m * gN : 0)) / m;
    const fy = (Fyf * cd + Fxf * sd + Fyr - 0.372 * v * car.vy) / m;
    const rd = (CG_A * (Fyf * cd + Fxf * sd) - CG_B * Fyr) / Iz;
    const vx0 = car.vx;
    car.vx += (fx + gx + car.vy * car.r) * dt;
    car.vy += (fy + gy - vx0 * car.r) * dt;
    car.r += rd * dt;
    if (car.vx < 0) car.vx = 0;
    // at parking speeds tyres simply roll where they point
    const s = car.vx <= 1 ? 0 : car.vx >= 5 ? 1 : (car.vx - 1) / 4;
    if (s < 1) { car.r = car.r * s + ((1 - s) * car.vx * Math.tan(delta)) / WB; car.vy *= s; }

    car.h += car.r * dt;
    car.x += (sh * car.vx + ch * car.vy) * dt;
    car.z += (ch * car.vx - sh * car.vy) * dt;
    car.ax += (fx - car.ax) * 0.25;
    car.ay += (fy - car.ay) * 0.25;
  }

  // steerCmd in -1..1 (positive = left), thrCmd in -1..1 (negative = brake)
  move(car, steerCmd, thrCmd, dt) {
    const T = this.track, N = T.n;
    // steering wheel and pedals take time to move
    let d = steerCmd - car.steer, mx = STEER_RATE * dt;
    car.steer += d > mx ? mx : d < -mx ? -mx : d;
    d = thrCmd - car.thr; mx = PEDAL_RATE * dt;
    car.thr += d > mx ? mx : d < -mx ? -mx : d;

    for (let k = 0; k < SUBSTEPS; k++) this.physics(car, dt / SUBSTEPS);
    car.v = Math.hypot(car.vx, car.vy);

    // where are we along the track?
    let bestD = Infinity, bestJ = 0, bestU = 0;
    for (let j = -4; j <= 8; j++) {
      const i = (((car.seg + j) % N) + N) % N, i2 = (i + 1) % N;
      const sx = T.cx[i2] - T.cx[i], sz = T.cz[i2] - T.cz[i];
      let u = ((car.x - T.cx[i]) * sx + (car.z - T.cz[i]) * sz) / (sx * sx + sz * sz);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = car.x - (T.cx[i] + sx * u), ez = car.z - (T.cz[i] + sz * u);
      const dd = ex * ex + ez * ez;
      if (dd < bestD) { bestD = dd; bestJ = j; bestU = u; }
    }
    car.segAbs += bestJ;
    car.seg = (((car.seg + bestJ) % N) + N) % N;
    car.prog = car.segAbs + bestU;
    car.lat = Math.sqrt(bestD);
    car.off = car.lat > T.hw - 0.5;
    const i = car.seg, i2 = (i + 1) % N;
    car.y = T.cy[i] + (T.cy[i2] - T.cy[i]) * bestU;
    car.pitch = Math.atan(T.slope[i] * (T.tx[i] * Math.sin(car.h) + T.tz[i] * Math.cos(car.h)));
  }

  drive(car) {
    this.sense(car);
    const o = car.brain.forward(car.inp);
    // speed-sensitive steering: the same wheel input turns the tyres less at speed
    this.move(car, this.cfg.steerAssist ? o[0] / (1 + car.v / 16) : o[0], o[1], DT);
    car.time += DT;
  }

  kill(car, why) {
    car.alive = false; car.why = why; car.vx = car.vy = car.r = car.v = 0;
    car.fitness = this.fitness(car);
    this.alive--;
  }

  // How fast a car is going compared with par: 1 = ideal centre-line pace.
  pace(car) {
    return car.time > 0 ? (Math.max(0, car.prog) * this.track.segLen) / car.time / this.par.pace : 0;
  }

  // The score evolution tries to maximise. It is a time attack:
  //  - distance is the base (you have to stay on the road to score at all)
  //  - pace multiplies it: faster than half of par pace earns a bonus, slower costs points
  //  - finishing adds a full extra race distance, so finishers always beat non-finishers
  //    and among finishers the quickest time wins
  fitness(car) {
    const dist = Math.max(0, car.prog) * this.track.segLen;
    const speed = Math.max(0.2, 1 + this.cfg.speedWeight * (Math.min(1.6, this.pace(car)) - 0.5));
    return dist * speed + (car.finished ? dist : 0);
  }

  step() {
    if (this.solo) return this.stepSolo();
    const cfg = this.cfg, N = this.track.n, segLen = this.track.segLen;
    const minSpeed = cfg.minPace * this.par.pace;
    for (const car of this.cars) {
      if (!car.alive) continue;
      this.drive(car);
      if (car.off) { this.kill(car, 'crashed'); continue; }
      if (car.prog > car.bestProg + 0.25) { car.bestProg = car.prog; car.stall = 0; }
      else if ((car.stall += DT) > 3) { this.kill(car, 'stalled'); continue; }
      // the clock is running: fall too far behind the minimum pace and you are out
      if (car.time > 8 && car.prog * segLen < minSpeed * (car.time - 8)) { this.kill(car, 'too slow'); continue; }
      if (!this.records.lap && car.prog >= N) { this.records.lap = true; this.emit('milestone', 'lap', car); }
      if (car.prog >= cfg.lapsTarget * N) {
        car.finished = true;
        const t = car.time;
        this.kill(car, 'finished');
        const first = !this.records.finish, record = t < this.records.bestTime;
        this.records.finish = true;
        if (record) this.records.bestTime = t;
        if (first || record) this.emit('milestone', first ? 'finish' : 'record', car);
      }
    }
    this.time += DT;
    if (this.alive === 0 || this.time >= cfg.timeLimit) this.evolve();
  }

  // Selection -> crossover -> mutation. This is where the learning happens.
  evolve() {
    if (this.solo) return;
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
      par: this.par.total,
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

  // ---- champion solo run: one car, the best brain so far, timed ---------------
  bestBrain() {
    if (this.champion) return this.champion;
    let best = this.cars[0];
    for (const c of this.cars) if (c.prog > best.prog) best = c;
    return best.brain;
  }

  startSolo() {
    const car = this.makeCar(this.bestBrain().clone(), 0);
    this.solo = { car, laps: [], lapStart: 0, top: 0, maxG: 0, done: false, ok: false };
  }

  stopSolo() { this.solo = null; }

  stepSolo() {
    const s = this.solo, car = s.car, N = this.track.n;
    if (s.done) return;
    this.drive(car);
    s.top = Math.max(s.top, car.v);
    s.maxG = Math.max(s.maxG, Math.hypot(car.ax, car.ay) / 9.81);
    const end = (why, ok) => {
      car.alive = false; car.why = why; car.finished = ok; car.vx = car.vy = car.r = car.v = 0;
      s.done = true; s.ok = ok;
      this.emit('soloEnd', s);
    };
    if (car.off) return end('crashed', false);
    if (car.prog > car.bestProg + 0.25) { car.bestProg = car.prog; car.stall = 0; }
    else if ((car.stall += DT) > 3) return end('stalled', false);
    if (Math.floor(car.prog / N) > s.laps.length) {
      s.laps.push(car.time - s.lapStart);
      s.lapStart = car.time;
      this.emit('soloLap', s);
      if (s.laps.length >= this.cfg.lapsTarget) end('finished', true);
    }
  }

  // ---- drive-it-yourself car -------------------------------------------
  setHuman(on) { this.human = on ? this.makeCar(null, -1) : null; }

  stepHuman(steer, thr) {
    const h = this.human;
    if (!h) return;
    this.sense(h);
    this.move(h, steer / (1 + h.v / 16), thr, DT); // keyboard steering gets gentler with speed
    h.time += DT;
    if (h.off) { this.human = this.makeCar(null, -1); this.emit('humanCrash'); }
  }
}
