// The simulation: sports-car physics, distance sensors, fitness scoring and the
// genetic algorithm. No rendering in here, so it also runs headless in Node.
import { Brain } from './brain.js';
import { buildTrack } from './track.js';

export const DT = 1 / 60;
const SUBSTEPS = 2;

// Car geometry (metres). Mass, power, grip etc. are tunable in cfg.
const WB = 2.6, CG_A = 1.3, CG_B = 1.3, CG_H = 0.46; // wheelbase, CG->front axle, CG->rear axle, CG height
const TIRE_B = 12;        // tyre stiffness: grip peaks at roughly 8 degrees of slip
const PEDAL_RATE = 8;     // how fast the pedals can move
export const SPEED_REF = 70; // m/s used to normalise the speed input
const G0 = 9.81;              // one "g"
const SLIP_PEAK = 0.144;      // slip angle (rad) where a tyre grips best
const LOOK_NEAR = 40, LOOK_FAR = 100; // how far ahead (m) the driver reads the road

// Six-speed gearbox and engine. Torque is fairly flat and falls away at high
// revs, so power peaks near 6700 rpm. In each gear the push at the wheels is
// torque x gear ratio: a low gear pushes hard but runs out of revs, a high gear
// is weak at low speed. Being in the wrong gear costs real acceleration.
// Gears have consequences: first runs out of revs at about 62 km/h, holding the
// engine on the rev limiter blows it up, and a gear that is too high for the
// speed bogs the engine down until it has almost no push at all.
const GEAR_TOP = [60, 100, 145, 195, 255, 340]; // km/h at 7500 rpm in each gear
export const GEARS = GEAR_TOP.length;
export const REDLINE = 7800, IDLE = 900;
const SHIFT_TIME = 0.25, SHIFT_CUT = 0.1; // a shift takes this long; the engine is disconnected for the first part
const torqueAt = (rpm) => 1 - 0.6 * ((rpm - 4500) / 4500) ** 2;
let TQ_PEAK = 0; // peak of torque x rpm, so that "power" means peak power
for (let r = IDLE; r <= REDLINE; r += 50) TQ_PEAK = Math.max(TQ_PEAK, torqueAt(r) * r);
const revsAt = (kmh, g) => Math.max(IDLE, (7500 * kmh) / GEAR_TOP[g]); // below idle the clutch slips
// Push at the driven wheels (N) at full throttle in gear g (0-based). Zero on the rev limiter.
function thrust(g, kmh, watts) {
  const raw = (7500 * kmh) / GEAR_TOP[g], rpm = raw < IDLE ? IDLE : raw;
  if (rpm > REDLINE) return 0;
  // Lugging: only first gear can pull away from rest (the clutch slips). In a
  // higher gear the engine bogs below about 2000 rpm and loses most of its push.
  const lug = g === 0 || raw >= 2000 ? 1 : Math.max(0.3, (raw - 500) / 1500);
  return (watts * torqueAt(rpm) * (27000 / GEAR_TOP[g]) * lug) / TQ_PEAK;
}
// The gear with the most usable push at this speed (ties go to the lower gear).
function bestGear(kmh, watts, cap) {
  let best = 0, bestF = -1;
  for (let g = 0; g < GEARS; g++) {
    const f = Math.min(cap, thrust(g, kmh, watts));
    if (f > bestF * 1.0001) { bestF = f; best = g; }
  }
  return best;
}
const CAR_R = 1.25; // cars are discs of this radius for car-to-car contact

// Everything the driver can sense besides the distance rays. Each group can be
// switched on or off in the UI, and each input is one neuron of the brain.
//   read(car, sim) -> the number fed to the network (roughly -1..1)
//   show(car, sim) -> the same thing in human units, for the telemetry panel
//   dir            -> a left/right quantity (the panel draws left to the left)
// Sign convention everywhere: positive = left.
const deg = (rad) => { const d = Math.round(rad * 57.3); return d === 0 ? 'straight' : (d > 0 ? 'left ' : 'right ') + Math.abs(d) + '°'; };
const gs = (a) => (a / G0).toFixed(2) + ' g';
const rise = (grade, dist) => { const m = grade * dist; return (m >= 0 ? '+' : '−') + Math.abs(m).toFixed(1) + ' m'; };
export const SENSES = [
  { key: 'senseMotion', title: 'Speed & balance', inputs: [
    { label: 'speed', read: (c) => c.v / SPEED_REF, show: (c) => Math.round(c.v * 3.6) + ' km/h' },
    { label: 'slide', dir: true, read: (c) => c.vy / 8, show: (c) => (c.v > 2 ? Math.abs(Math.round(Math.atan2(c.vy, c.vx) * 57.3)) : 0) + '° drift' },
    { label: 'spin', dir: true, read: (c) => c.r / 1.5, show: (c) => Math.abs(Math.round(c.r * 57.3)) + ' °/s' },
  ] },
  { key: 'senseG', title: 'G-forces', inputs: [
    { label: 'accel g', read: (c) => c.ax / 15, show: (c) => gs(c.ax) },
    { label: 'corner g', dir: true, read: (c) => c.ay / 15, show: (c) => gs(Math.abs(c.ay)) },
    { label: 'vertical g', read: (c) => (c.gz - 1) * 2, show: (c) => c.gz.toFixed(2) + ' g' },
  ] },
  { key: 'senseEngine', title: 'Engine', inputs: [
    { label: 'gear', read: (c) => c.gear / GEARS, show: (c) => String(c.gear) },
    { label: 'revs', read: (c) => c.rpm / REDLINE, show: (c) => Math.round(Math.min(c.rpm, REDLINE) / 100) * 100 + ' rpm' },
  ] },
  { key: 'senseHills', title: 'Depth: hills', inputs: [
    { label: 'slope', read: (c) => c.grade * 8, show: (c) => (c.grade >= 0 ? '+' : '−') + Math.abs(c.grade * 100).toFixed(0) + '%' },
    { label: `hill ${LOOK_NEAR}m`, read: (c, s) => s.look.hillN[c.seg] * 8, show: (c, s) => rise(s.look.hillN[c.seg], LOOK_NEAR) },
    { label: `hill ${LOOK_FAR}m`, read: (c, s) => s.look.hillF[c.seg] * 8, show: (c, s) => rise(s.look.hillF[c.seg], LOOK_FAR) },
  ] },
  { key: 'senseBends', title: 'Depth: bends', inputs: [
    { label: `bend ${LOOK_NEAR}m`, dir: true, read: (c, s) => (s.look.bendN[c.seg] + c.yawErr) / 0.8, show: (c, s) => deg(s.look.bendN[c.seg] + c.yawErr) },
    { label: `bend ${LOOK_FAR}m`, dir: true, read: (c, s) => (s.look.bendF[c.seg] + c.yawErr) / 1.2, show: (c, s) => deg(s.look.bendF[c.seg] + c.yawErr) },
  ] },
  { key: 'senseLane', title: 'Place on the road', inputs: [
    { label: 'lane', dir: true, read: (c, s) => c.side / s.track.hw, show: (c) => (Math.abs(c.side) < 0.25 ? 'centre' : Math.abs(c.side).toFixed(1) + ' m ' + (c.side > 0 ? 'left' : 'right')) },
    { label: 'heading', dir: true, read: (c) => c.yawErr / 0.6, show: (c) => deg(c.yawErr) },
  ] },
  { key: 'senseTyres', title: 'Tyre feel', inputs: [
    { label: 'front slip', dir: true, read: (c) => c.af / SLIP_PEAK, show: (c) => Math.abs(c.af * 57.3).toFixed(1) + '°' },
    { label: 'rear slip', dir: true, read: (c) => c.ar / SLIP_PEAK, show: (c) => Math.abs(c.ar * 57.3).toFixed(1) + '°' },
  ] },
  { key: 'senseControls', title: 'Hands & feet', inputs: [
    { label: 'wheel', dir: true, read: (c) => c.steer, show: (c, s) => Math.round(Math.abs(c.steer) * s.cfg.wheelTurns * 360) + '°' },
    { label: 'pedal', read: (c) => c.thr, show: (c) => (c.thr === 0 ? 'coasting' : (c.thr > 0 ? 'gas ' : 'brake ') + Math.round(Math.abs(c.thr) * 100) + '%') },
  ] },
];
export const SENSE_KEYS = SENSES.map((g) => g.key);

// The non-ray inputs that are switched on, in network order. "quiet" inputs are
// fed to the brain at reduced strength (cfg.senseGain): every extra input adds
// connections a mutation can break, and a quiet input makes those breaks small,
// so evolution can lean on the new senses gradually instead of being thrown by them.
export function senseInputs(cfg) {
  const list = [];
  for (const g of SENSES) if (cfg[g.key]) for (const inp of g.inputs) list.push({ ...inp, group: g.title, quiet: g.key !== 'senseMotion' });
  return list;
}

export const defaults = {
  // evolution
  population: 80,
  elites: 3,
  tournament: 5,
  mutationRate: 0.08,
  mutationStrength: 0.25,
  crossover: true,
  speedWeight: 1, // how much pace counts in the score (0 = only distance matters)
  gearWeight: 0.3,  // manual gearbox: score bonus for the right gear, penalty for the wrong one
  driftWeight: 0,   // points for sliding sideways at speed (0 = drifting is not rewarded)
  minPace: 0.4,     // cars slower than this fraction of par pace are eliminated
  timeLimit: 300,
  lapsTarget: 3,
  // racing
  collide: false,   // cars bump into each other, start from a grid, and see each other
  raceCars: 1,      // how many of the best brains take part in the champion run
  // driver's controls
  gearbox: 'Manual', // 'Manual': the brain shifts gears itself. 'Auto': the car does it.
  handbrake: true,   // the brain can pull the handbrake, as hard as it likes
  revLimit: 2.5,     // seconds the engine survives on the rev limiter before it blows (0 = unbreakable)
  wheelTurns: 1.5,   // steering wheel turns from centre to full lock
  handSpeed: 900,    // how fast the driver can turn the wheel, degrees per second
  // brain
  sensors: 9,
  sensorRange: 120,
  sensorFov: 140,
  sensorFocus: 1,   // >1 packs more rays toward straight ahead
  senseGain: 0.2,      // how loudly the senses below (except speed & balance) speak to the brain
  senseMotion: true,   // speed, sideways slide, spin
  senseG: true,        // g-forces: accelerating/braking, cornering, light or heavy over hills
  senseEngine: true,   // gear and revs
  senseHills: true,    // slope here and the rise or fall of the road ahead
  senseBends: true,    // which way the road goes ahead
  senseLane: false,    // place across the road and angle to it
  senseTyres: false,   // front and rear tyre slip
  senseControls: false, // where the steering wheel and pedals are right now
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
  const s = [cfg.sensors + senseInputs(cfg).length];
  for (let i = 0; i < cfg.hiddenLayers; i++) s.push(cfg.hiddenSize);
  s.push(controlNames(cfg).length);
  return s;
}

// What the brain controls: one output neuron each.
export function controlNames(cfg) {
  const out = ['steer', 'pedal'];
  if (cfg.gearbox === 'Manual') out.push('shift');
  if (cfg.handbrake) out.push('handbrake');
  return out;
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
    // what a driver sees looking down the road: how much it turns and climbs
    // over the next LOOK_NEAR and LOOK_FAR metres, for every point of the track
    const T = this.track, N = T.n;
    const head = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      head[i + 1] = head[i] + Math.atan2(T.tx[i] * T.tz[j] - T.tz[i] * T.tx[j], T.tx[i] * T.tx[j] + T.tz[i] * T.tz[j]);
    }
    const look = (dist) => {
      const k = Math.min(N - 1, Math.max(1, Math.round(dist / T.segLen)));
      const bend = new Float32Array(N), hill = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const j = i + k;
        bend[i] = j < N ? head[j] - head[i] : head[N] + head[j - N] - head[i];
        hill[i] = (T.cy[j % N] - T.cy[i]) / (k * T.segLen);
      }
      return { bend, hill };
    };
    const near = look(LOOK_NEAR), far = look(LOOK_FAR);
    this.look = { bendN: near.bend, hillN: near.hill, bendF: far.bend, hillF: far.hill };
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
    const traction = mu * g * (c.drive === 'AWD' ? 1 : 0.55), watts = c.power * 745.7;
    const braking = Math.min(c.brake * 9.81, mu * g);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) { // accelerate out of corners
        const j = (i + 1) % N;
        const kmh = v[i] * 3.6;
        const a = Math.min(traction, thrust(bestGear(kmh, watts, 1e9), kmh, watts) / m) - (0.372 * v[i] * v[i]) / m - g * T.slope[i];
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
    this.inputs = senseInputs(c);
    this.controls = controlNames(c);
    this.top = []; // best brains of the last generation, for the champion run
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
    // with collisions on, cars line up on a grid instead of starting on top of each other
    this.cars = brains.map((b, i) => this.makeCar(b, i, this.cfg.collide ? i : -1));
    this.time = 0;
    this.alive = this.cars.length;
  }

  // slot >= 0 puts the car on the starting grid: two columns, rows 8 m apart,
  // behind the line. Everyone still drives the same distance: laps are counted
  // from the car's own grid slot.
  makeCar(brain, id, slot = -1) {
    const T = this.track, N = T.n;
    let i = 0, off = 0;
    if (slot >= 0) {
      i = (((-2 - (slot >> 1) * 4 - (slot & 1) * 2) % N) + N) % N;
      off = (slot & 1 ? -1 : 1) * Math.min(T.hw - 2, Math.max(1.6, T.hw * 0.4));
    }
    const extra = this.inputs.length;
    const n = brain ? brain.sizes[0] - extra : this.cfg.sensors;
    return {
      id, brain, gen: this.gen,
      x: T.cx[i] + T.nx[i] * off, y: T.cy[i], z: T.cz[i] + T.nz[i] * off, h: Math.atan2(T.tx[i], T.tz[i]), pitch: 0,
      vx: 0, vy: 0, r: 0, v: 0, ax: 0, ay: 0,   // body-frame velocity, yaw rate, speed, accelerations
      gz: this.cfg.gravity / G0, af: 0, ar: 0,  // vertical g, front and rear tyre slip angles
      gear: 1, rpm: IDLE, shiftT: 0, grade: 0,  // gearbox, slope under the car
      heat: 0,                                  // seconds of engine abuse on the rev limiter
      gearOk: 1, gearSum: 0, drift: 0, hits: 0, // right-gear score (now and summed), drift points, contacts
      steer: 0, thr: 0, hand: 0, slip: false,   // steering wheel, pedal (+gas / -brake), handbrake
      seg: i, segAbs: 0, prog: 0, bestProg: 0, stall: 0, lat: 0, side: 0, yawErr: 0, off: false,
      alive: true, finished: false, why: '', time: 0, fitness: 0,
      rays: new Float32Array(n), inp: new Float32Array(n + extra),
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
    const near = this.near || (this.near = []);
    let seen = 0;
    if (cfg.collide && car.id >= 0) {
      const lim = (range + CAR_R) * (range + CAR_R);
      for (const o of this.field()) {
        if (o === car || !o.alive) continue;
        const ex = o.x - ox, ez = o.z - oz;
        if (ex * ex + ez * ez < lim) near[seen++] = o;
      }
    }
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
      // eyes also see other cars when collisions are on
      for (let q = 0; q < seen; q++) {
        const o = near[q], cx = ox - o.x, cz = oz - o.z;
        const b = cx * dx + cz * dz, disc = b * b - (cx * cx + cz * cz - CAR_R * CAR_R);
        if (disc <= 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < best) best = t;
      }
      car.rays[k] = best;
      car.inp[k] = best / range;
    }
    // everything else the driver feels: speed, g-forces, revs, the road ahead...
    const S = this.inputs;
    for (let j = 0; j < S.length; j++) {
      const x = S[j].read(car, this);
      car.inp[n + j] = (x > 2 ? 2 : x < -2 ? -2 : x) * (S[j].quiet ? cfg.senseGain : 1);
    }
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
    car.gz = gN / G0;

    // vertical load on each axle: static weight + weight transfer + aero downforce
    const v2 = car.vx * car.vx + car.vy * car.vy, v = Math.sqrt(v2);
    const down = 0.6 * c.downforce * v2;
    const shift = (m * car.ax * CG_H) / WB;
    const Wf = Math.max(150, (m * gN * CG_B) / WB - shift + 0.4 * down);
    const Wr = Math.max(150, (m * gN * CG_A) / WB + shift + 0.6 * down);

    // engine through the gearbox, engine braking when off the gas, brakes
    let Fxf = 0, Fxr = 0, Fd = 0;
    const gi = car.gear - 1, over = (7500 * v * 3.6) / GEAR_TOP[gi] - REDLINE; // v = the speed the dashboard shows
    if (over > 0) {
      // Past the red line the wheels are driving the engine, not the other way
      // round. Whatever the pedal is doing, the engine holds the car back, harder
      // the further over it is, so no gear can run faster than its top speed.
      Fd = -m * 9.81 * Math.min(1, over / 300);
    } else if (car.thr > 0) {
      if (car.shiftT <= SHIFT_TIME - SHIFT_CUT) Fd = car.thr * Math.min(1.15 * m * 9.81, thrust(gi, v * 3.6, c.power * 745.7));
    } else if (car.vx > 2) {
      Fd = -0.12 * m * 9.81 * (GEAR_TOP[0] / GEAR_TOP[gi]) * Math.min(1, car.rpm / REDLINE); // strongest in a low gear at high revs
    }
    if (c.drive === 'RWD') Fxr = Fd; else if (c.drive === 'FWD') Fxf = Fd; else { Fxf = 0.4 * Fd; Fxr = 0.6 * Fd; }
    if (car.thr < 0 && car.vx > 0.2) {
      const F = car.thr * c.brake * m * 9.81;
      Fxf += 0.62 * F; Fxr += 0.38 * F;
    }

    // friction circle: what is spent on drive/brake is not available for cornering
    const capF = c.grip * Wf, capR = c.grip * 1.06 * Wr;
    // handbrake: brakes the rear wheels only, and ABS cannot save you. Pull it
    // hard enough and the rears lock, lose their sideways grip, and the tail steps out.
    let yank = false;
    if (car.hand > 0 && car.vx > 0.2) { Fxr -= car.hand * 1.2 * capR; yank = Fxr < -capR * 0.96; }
    let latF, latR, lim = capF * 0.96;
    car.slip = false;
    if (Fxf > lim || Fxf < -lim) {
      const s = Fxf > 0 ? 1 : -1; car.slip = true;
      if (c.aids) { Fxf = s * lim; latF = capF * 0.28; } else { Fxf = s * capF * 0.78; latF = capF * 0.1; } // locked/spinning wheels barely steer
    } else latF = Math.sqrt(capF * capF - Fxf * Fxf);
    lim = capR * 0.96;
    if (Fxr > lim || Fxr < -lim) {
      const s = Fxr > 0 ? 1 : -1; car.slip = true;
      if (c.aids && !yank) { Fxr = s * lim; latR = capR * 0.28; } else { Fxr = s * capR * 0.78; latR = capR * 0.1; }
    } else latR = Math.sqrt(capR * capR - Fxr * Fxr);

    // tyre slip angles -> sideways forces (simplified Pacejka "magic formula")
    const vxs = Math.max(car.vx, 3);
    const delta = car.steer * c.steerLock;
    const af = Math.atan2(car.vy + CG_A * car.r, vxs) - delta;
    const ar = Math.atan2(car.vy - CG_B * car.r, vxs);
    const Fyf = -latF * Math.sin(1.5 * Math.atan(TIRE_B * af));
    const Fyr = -latR * Math.sin(1.5 * Math.atan(TIRE_B * ar));
    if (af > 0.16 || af < -0.16 || ar > 0.16 || ar < -0.16) car.slip = true;
    car.af = af; car.ar = ar;

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

  // Sequential shift, like paddles: one gear up or down. The gearbox refuses a
  // downshift that would send the engine past the red line.
  shift(car, dir) {
    const g = car.gear + dir;
    if (car.shiftT > 0 || g < 1 || g > GEARS) return;
    if (dir < 0 && (7500 * car.v * 3.6) / GEAR_TOP[g - 1] > REDLINE) return;
    car.gear = g; car.shiftT = SHIFT_TIME;
  }

  // steerCmd in -1..1 (positive = left), thrCmd in -1..1 (negative = brake, 0 = coast), handCmd 0..1
  move(car, steerCmd, thrCmd, dt, handCmd = 0) {
    const cfg = this.cfg, T = this.track, N = T.n;
    // The steering wheel turns wheelTurns each way and hands are only so fast,
    // so more turns means finer control but slower lock to lock. Pedals and the
    // handbrake lever take time to move too.
    let d = steerCmd - car.steer, mx = (cfg.handSpeed / (cfg.wheelTurns * 360)) * dt;
    car.steer += d > mx ? mx : d < -mx ? -mx : d;
    d = thrCmd - car.thr; mx = PEDAL_RATE * dt;
    car.thr += d > mx ? mx : d < -mx ? -mx : d;
    d = handCmd - car.hand; mx = 5 * dt;
    car.hand += d > mx ? mx : d < -mx ? -mx : d;
    if (car.shiftT > 0) car.shiftT -= dt;

    for (let k = 0; k < SUBSTEPS; k++) this.physics(car, dt / SUBSTEPS);
    car.v = Math.hypot(car.vx, car.vy);
    // gearbox: is this the right gear? +1 = all the push the engine could give
    // at this speed, 0 = half of it, -1 = none (bogged down or on the limiter)
    const kmh = car.v * 3.6, watts = cfg.power * 745.7, cap = 1.15 * cfg.mass * 9.81;
    const ideal = bestGear(kmh, watts, cap), bestF = Math.min(cap, thrust(ideal, kmh, watts));
    const have = () => Math.min(cap, thrust(car.gear - 1, kmh, watts));
    if (cfg.gearbox !== 'Manual' && ideal !== car.gear - 1 && car.shiftT <= 0 && bestF > have() * 1.04) { car.gear = ideal + 1; car.shiftT = SHIFT_TIME; }
    car.rpm = Math.min(REDLINE + 300, revsAt(kmh, car.gear - 1));
    // bouncing off the rev limiter cooks the engine; it recovers at half the rate
    car.heat = car.rpm >= REDLINE - 150 ? car.heat + dt : Math.max(0, car.heat - dt / 2);
    car.gearOk = bestF > 0 ? (2 * have()) / bestF - 1 : 1;
    car.gearSum += car.gearOk * dt;
    // drift points: metres travelled sideways-ish, weighted by the slide angle
    if (car.v > 8) { const beta = Math.abs(Math.atan2(car.vy, car.vx)); if (beta > 0.17) car.drift += Math.min(beta, 0.8) * car.v * dt; }

    // where are we along the track?
    let bestD = Infinity, bestJ = 0, bestU = 0, offX = 0, offZ = 0;
    for (let j = -4; j <= 8; j++) {
      const i = (((car.seg + j) % N) + N) % N, i2 = (i + 1) % N;
      const sx = T.cx[i2] - T.cx[i], sz = T.cz[i2] - T.cz[i];
      let u = ((car.x - T.cx[i]) * sx + (car.z - T.cz[i]) * sz) / (sx * sx + sz * sz);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = car.x - (T.cx[i] + sx * u), ez = car.z - (T.cz[i] + sz * u);
      const dd = ex * ex + ez * ez;
      if (dd < bestD) { bestD = dd; bestJ = j; bestU = u; offX = ex; offZ = ez; }
    }
    car.segAbs += bestJ;
    car.seg = (((car.seg + bestJ) % N) + N) % N;
    car.prog = car.segAbs + bestU;
    car.lat = Math.sqrt(bestD);
    car.off = car.lat > T.hw - 0.5;
    const i = car.seg, i2 = (i + 1) % N;
    car.y = T.cy[i] + (T.cy[i2] - T.cy[i]) * bestU;
    // where the road points relative to the nose, and where we sit across it (positive = left)
    const sh = Math.sin(car.h), ch = Math.cos(car.h);
    const along = T.tx[i] * sh + T.tz[i] * ch;
    car.yawErr = Math.atan2(T.tx[i] * ch - T.tz[i] * sh, along);
    car.side = offX * T.nx[i] + offZ * T.nz[i];
    car.grade = T.slope[i] * along;
    car.pitch = Math.atan(car.grade);
  }

  drive(car) {
    this.sense(car);
    const o = car.brain.forward(car.inp), cfg = this.cfg;
    // one right foot: on the gas, on the brake, or lifted (coasting) in between
    const p = o[1], pedal = p > 0.1 ? (p - 0.1) / 0.9 : p < -0.1 ? (p + 0.1) / 0.9 : 0;
    let k = 2, hand = 0;
    if (cfg.gearbox === 'Manual' && k < o.length) { const g = o[k++]; if (g > 0.5) this.shift(car, 1); else if (g < -0.5) this.shift(car, -1); }
    if (cfg.handbrake && k < o.length) { const h = o[k++]; if (h > 0.3) hand = (h - 0.3) / 0.7; } // released unless pulled on purpose
    // speed-sensitive steering: the same wheel input turns the tyres less at speed
    this.move(car, cfg.steerAssist ? o[0] / (1 + car.v / 16) : o[0], pedal, DT, hand);
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
  //  - manual gearbox: time in the right gear multiplies the score up, the wrong gear down
  //  - optional: points for drifting
  fitness(car) {
    const cfg = this.cfg, dist = Math.max(0, car.prog) * this.track.segLen;
    const speed = Math.max(0.2, 1 + cfg.speedWeight * (Math.min(1.6, this.pace(car)) - 0.5));
    const gear = cfg.gearbox === 'Manual' ? Math.max(0.1, 1 + cfg.gearWeight * this.gearScore(car)) : 1;
    return (dist * speed + (car.finished ? dist : 0)) * gear + cfg.driftWeight * car.drift;
  }

  // Average right-gear score over the run so far: +1 always in the best gear, -1 always useless.
  gearScore(car) { return car.time > 0 ? car.gearSum / car.time : 1; }

  // The cars that can touch and see each other right now.
  field() { return this.solo ? this.solo.all : this.cars; }

  // Car-to-car contact: push overlapping cars apart and bounce their velocities
  // along the line between them. Wrecks and finishers are ghosts.
  collide(cars) {
    const D = 2 * CAR_R;
    for (let a = 0; a < cars.length; a++) {
      const A = cars[a];
      if (!A.alive) continue;
      for (let b = a + 1; b < cars.length; b++) {
        const B = cars[b];
        if (!B.alive) continue;
        const dx = B.x - A.x, dz = B.z - A.z;
        if (dx > D || dx < -D || dz > D || dz < -D) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= D * D || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = (D - d) / 2;
        A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
        const sa = Math.sin(A.h), ca = Math.cos(A.h), sb = Math.sin(B.h), cb = Math.cos(B.h);
        let ax = sa * A.vx + ca * A.vy, az = ca * A.vx - sa * A.vy; // world velocities
        let bx = sb * B.vx + cb * B.vy, bz = cb * B.vx - sb * B.vy;
        const rel = (bx - ax) * nx + (bz - az) * nz;
        if (rel >= 0) continue; // already separating
        const j = (-1.3 * rel) / 2;
        ax -= j * nx; az -= j * nz; bx += j * nx; bz += j * nz;
        A.vx = Math.max(0, ax * sa + az * ca); A.vy = ax * ca - az * sa;
        B.vx = Math.max(0, bx * sb + bz * cb); B.vy = bx * cb - bz * sb;
        A.hits++; B.hits++;
      }
    }
  }

  step() {
    if (this.solo) return this.stepSolo();
    const cfg = this.cfg, N = this.track.n, segLen = this.track.segLen;
    const minSpeed = cfg.minPace * this.par.pace;
    for (const car of this.cars) {
      if (!car.alive) continue;
      this.drive(car);
      if (car.off) { this.kill(car, 'crashed'); continue; }
      if (cfg.revLimit > 0 && car.heat > cfg.revLimit) { this.kill(car, 'blew its engine'); continue; }
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
    if (cfg.collide) this.collide(this.cars);
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
    this.top = ranked.slice(0, 20).map((c) => c.brain);

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

  // The champion (on pole) plus, if "raceCars" > 1, the next-best brains of the
  // last generation as rivals. With collisions on they can hit each other.
  startSolo() {
    const n = Math.max(1, this.cfg.raceCars | 0);
    let pool = this.top;
    if (!pool.length) pool = [...this.cars].sort((a, b) => b.prog - a.prog).map((c) => c.brain);
    const brains = [this.bestBrain(), ...pool.filter((b) => b !== this.bestBrain())].slice(0, n);
    const grid = brains.length > 1 || this.cfg.collide;
    const all = brains.map((b, i) => this.makeCar(b.clone(), i, grid ? i : -1));
    this.solo = { car: all[0], all, laps: [], lapStart: 0, top: 0, maxG: 0, done: false, ok: false, pos: 0 };
  }

  stopSolo() { this.solo = null; }

  stepSolo() {
    const s = this.solo, car = s.car, N = this.track.n, laps = this.cfg.lapsTarget;
    if (s.done) return;
    // rivals first: same rules as in training, nobody is scored
    for (let i = 1; i < s.all.length; i++) {
      const r = s.all[i];
      if (!r.alive) continue;
      this.drive(r);
      const out = (why) => { r.alive = false; r.why = why; r.vx = r.vy = r.r = r.v = 0; };
      if (r.off) out('crashed');
      else if (this.cfg.revLimit > 0 && r.heat > this.cfg.revLimit) out('blew its engine');
      else if (r.prog > r.bestProg + 0.25) { r.bestProg = r.prog; r.stall = 0; }
      else if ((r.stall += DT) > 3) out('stalled');
      if (r.alive && r.prog >= laps * N) { r.finished = true; out('finished'); }
    }
    this.drive(car);
    if (this.cfg.collide) this.collide(s.all);
    s.top = Math.max(s.top, car.v);
    s.maxG = Math.max(s.maxG, Math.hypot(car.ax, car.ay) / 9.81);
    const end = (why, ok) => {
      car.alive = false; car.why = why; car.finished = ok; car.vx = car.vy = car.r = car.v = 0;
      s.done = true; s.ok = ok;
      s.pos = 1 + s.all.filter((r) => r !== car && r.finished).length; // rivals that got home first
      this.emit('soloEnd', s);
    };
    if (car.off) return end('crashed', false);
    if (this.cfg.revLimit > 0 && car.heat > this.cfg.revLimit) return end('blew its engine', false);
    if (car.prog > car.bestProg + 0.25) { car.bestProg = car.prog; car.stall = 0; }
    else if ((car.stall += DT) > 3) return end('stalled', false);
    if (Math.floor(car.prog / N) > s.laps.length) {
      s.laps.push(car.time - s.lapStart);
      s.lapStart = car.time;
      this.emit('soloLap', s);
      if (s.laps.length >= laps) end('finished', true);
    }
  }

  // ---- drive-it-yourself car -------------------------------------------
  setHuman(on) { this.human = on ? this.makeCar(null, -1) : null; }

  stepHuman(steer, thr, shift = 0, hand = 0) {
    const h = this.human;
    if (!h) return;
    this.sense(h);
    if (shift && this.cfg.gearbox === 'Manual') this.shift(h, shift);
    this.move(h, steer / (1 + h.v / 16), thr, DT, hand); // keyboard steering gets gentler with speed
    h.time += DT;
    const blown = this.cfg.revLimit > 0 && h.heat > this.cfg.revLimit;
    if (h.off || blown) { this.human = this.makeCar(null, -1); this.emit('humanCrash', blown ? 'engine' : 'road'); }
  }
}
