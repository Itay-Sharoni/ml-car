import { Sim, defaults, DT, brainSizes } from './sim.js';
import { Brain } from './brain.js';
import { World } from './world.js';
import { UI, gearInfo, fmtTime, fmtGap } from './ui.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'mlcar.champion.v2';

const cfg = { ...defaults };
const view = { showSensors: true, hideDead: false, sound: false };
const state = { paused: true, speed: 2, driving: false, trainSpeed: 2 };

const sim = new Sim(cfg);
const world = new World($('scene'));
world.setTrack(sim.track);
window.mlcar = { sim, world, cfg, state }; // handy for poking around in the console

const ui = new UI(cfg, view, onChange, onAction);

// ---- settings changes -----------------------------------------------------
function onChange(item) {
  if (item.key === 'sound') return setSound(view.sound);
  if (item.kind === 'reset') {
    exitSolo();
    sim.reset();
    ui.drawChart(sim.history);
    ui.toast('Brain shape changed — learning restarted');
  } else if (item.kind === 'track') {
    newTrack(cfg.trackSeed);
  } else {
    sim.updatePar(); // car or race settings changed: the ideal time changes with them
  }
}

function newTrack(seed) {
  cfg.trackSeed = seed;
  sim.buildTrack();
  world.setTrack(sim.track);
  sim.restartGeneration();
  if (sim.solo) startSolo();
  focus = null;
}

function onAction(a) {
  if (a === 'save') {
    const keep = ['sensors', 'sensorRange', 'sensorFov', 'sensorFocus', 'hiddenLayers', 'hiddenSize'];
    localStorage.setItem(SAVE_KEY, JSON.stringify({ cfg: Object.fromEntries(keep.map((k) => [k, cfg[k]])), w: Array.from(sim.bestBrain().w) }));
    ui.toast('Champion brain saved in this browser');
  } else if (a === 'load') {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return ui.toast('No saved champion yet');
    const data = JSON.parse(raw);
    exitSolo();
    Object.assign(cfg, data.cfg);
    sim.reset(new Brain(brainSizes(cfg), Float32Array.from(data.w)));
    ui.refresh(); ui.drawChart(sim.history);
    ui.toast('Champion loaded — population seeded from it');
  } else if (a === 'defaults') {
    exitSolo();
    Object.assign(cfg, defaults);
    sim.buildTrack();
    world.setTrack(sim.track);
    sim.reset();
    focus = null;
    ui.refresh(); ui.drawChart(sim.history);
    ui.toast('Default settings restored — learning restarted');
  }
}

// ---- sim events -------------------------------------------------------------
sim.on('generation', () => { ui.drawChart(sim.history); focus = null; });
sim.on('track', () => { world.setTrack(sim.track); ui.toast('New road generated'); });
sim.on('milestone', (kind, car) => {
  if (kind === 'lap') ui.toast(`Generation ${sim.gen}: first full lap!`);
  if (kind === 'finish') {
    ui.toast(`Generation ${sim.gen}: ${cfg.lapsTarget} laps finished in ${fmtTime(car.time)} (par ${fmtTime(sim.par.total)}). Now make it faster!`, true);
    ui.confetti();
  }
  if (kind === 'record') ui.toast(`New record: ${fmtTime(car.time)}, ${fmtGap(car.time - sim.par.total)} vs par (generation ${sim.gen})`);
});
sim.on('humanCrash', () => ui.toast('You left the road — back to the start line'));

// ---- champion solo run --------------------------------------------------------
function renderSolo() {
  const s = sim.solo;
  if (!s) return;
  const best = Math.min(...s.laps);
  $('soloLaps').innerHTML = s.laps.map((t, i) => `<div class="${s.laps.length > 1 && t === best ? 'best' : ''}"><b>LAP ${i + 1}</b>${fmtTime(t)}</div>`).join('');
  $('soloState').textContent = s.done ? '' : `· generation ${sim.gen} brain`;
  if (!s.done) $('soloRes').textContent = s.laps.length ? '' : 'One car. The best brain so far. No second chances.';
  else if (s.ok) $('soloRes').innerHTML = `<b>${fmtTime(s.car.time)}</b> &nbsp;·&nbsp; ${fmtGap(s.car.time - sim.par.total)} vs par &nbsp;·&nbsp; top speed ${Math.round(s.top * 3.6)} km/h &nbsp;·&nbsp; peak ${s.maxG.toFixed(1)} g`;
  else $('soloRes').innerHTML = `${s.car.why === 'crashed' ? 'Crashed' : 'Stalled'} on lap ${s.laps.length + 1} after ${fmtTime(s.car.time)}. It needs more training.`;
}

function startSolo() {
  const entering = !sim.solo;
  sim.startSolo();
  if (entering) { state.trainSpeed = state.speed; setSpeed(1); }
  focus = null;
  document.body.classList.add('solo-on');
  $('solo').classList.remove('hidden');
  $('bSolo').textContent = 'Back to training';
  $('dashTitle').textContent = "Champion's dashboard";
  setPaused(false);
  renderSolo();
}

function exitSolo() {
  if (!sim.solo) return;
  sim.stopSolo();
  setSpeed(state.trainSpeed);
  focus = null;
  document.body.classList.remove('solo-on');
  $('solo').classList.add('hidden');
  $('bSolo').textContent = 'Run champion';
  $('dashTitle').textContent = "Leader's dashboard";
}

sim.on('soloLap', (s) => { renderSolo(); ui.toast(`Lap ${s.laps.length}: ${fmtTime(s.laps[s.laps.length - 1])}`); });
sim.on('soloEnd', (s) => { renderSolo(); if (s.ok) ui.confetti(); });
$('bSolo').onclick = () => (sim.solo ? exitSolo() : startSolo());
$('bSoloAgain').onclick = startSolo;
$('bSoloExit').onclick = exitSolo;
$('bSoloNew').onclick = () => { newTrack((Math.random() * 1e9) | 0); ui.toast('A road this brain has never seen'); };

// ---- transport --------------------------------------------------------------
function setPaused(p) { state.paused = p; $('bPlay').textContent = p ? 'Play' : 'Pause'; }
function setSpeed(v) { state.speed = v; $('speed').value = v; $('speedV').textContent = v + '×'; }
$('bPlay').onclick = () => setPaused(!state.paused);
$('speed').oninput = (e) => setSpeed(Number(e.target.value));
$('bSkip').onclick = () => { if (sim.solo) ui.toast('Go back to training first'); else sim.evolve(); };
$('bTrack').onclick = () => { newTrack((Math.random() * 1e9) | 0); ui.toast('New road generated'); };
$('bReset').onclick = () => { exitSolo(); sim.reset(); ui.drawChart(sim.history); focus = null; ui.toast('Fresh random brains'); };
$('bHelp').onclick = () => $('help').classList.remove('hidden');
$('bStart').onclick = () => { $('help').classList.add('hidden'); setPaused(false); };
$('help').onclick = (e) => { if (e.target === $('help')) $('bStart').click(); };
$('cams').onclick = (e) => {
  const m = e.target.dataset.cam;
  if (!m) return;
  world.setMode(m);
  for (const b of $('cams').children) b.classList.toggle('on', b === e.target);
};
$('bDrive').onclick = () => {
  state.driving = !state.driving;
  sim.setHuman(state.driving);
  $('bDrive').classList.toggle('on', state.driving);
  $('bDrive').textContent = state.driving ? 'Stop driving' : 'Drive it yourself';
  if (state.driving) ui.toast('You have the blue car: arrows or WASD');
};

const keys = {};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if ($('help').classList.contains('hidden')) setPaused(!state.paused); }
  if (state.driving && e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => (keys[e.code] = false));

function resize() { world.resize(innerWidth, innerHeight); }
addEventListener('resize', resize);
resize();

// ---- engine sound (a simple synth that follows the revs) ---------------------
let audio = null;
function setSound(on) {
  if (on && !audio) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), gain = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    lp.type = 'lowpass'; lp.frequency.value = 700;
    gain.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    o1.start(); o2.start();
    audio = { ctx, o1, o2, lp, gain };
  }
  if (audio) (on ? audio.ctx.resume() : audio.ctx.suspend());
}
function updateSound(car) {
  if (!audio || !view.sound) return;
  const t = audio.ctx.currentTime, live = car && car.alive && !state.paused;
  const f = 40 + (gearInfo(car ? car.v : 0).rpm / 7800) * 170;
  audio.o1.frequency.setTargetAtTime(f, t, 0.04);
  audio.o2.frequency.setTargetAtTime(f / 2, t, 0.04);
  audio.lp.frequency.setTargetAtTime(500 + f * 5, t, 0.05);
  audio.gain.gain.setTargetAtTime(live ? 0.03 + 0.05 * Math.max(0, car.thr) : 0, t, 0.08);
}

// ---- which car does the camera follow? ---------------------------------------
let focus = null;
function pickFocus() {
  if (sim.solo) return (focus = sim.solo.car);
  let best = null;
  for (const c of sim.cars) if (c.alive && (!best || c.prog > best.prog)) best = c;
  if (!best) {
    if (focus && sim.cars[focus.id] === focus) return focus;
    for (const c of sim.cars) if (!best || c.prog > best.prog) best = c;
    return (focus = best);
  }
  // hysteresis so the camera does not flicker between cars that are neck and neck
  if (focus && focus.alive && sim.cars[focus.id] === focus && best.prog < focus.prog + 4) return focus;
  return (focus = best);
}

// ---- main loop ------------------------------------------------------------
let last = performance.now(), acc = 0, hacc = 0, frame = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let simDt = 0;
  if (!state.paused) {
    acc += (dt * state.speed) / DT;
    let steps = Math.floor(acc);
    acc -= steps;
    simDt = steps * DT;
    const t0 = performance.now();
    while (steps-- > 0) {
      sim.step();
      if (performance.now() - t0 > 22) { acc = 0; break; } // keep the UI smooth at high speeds
    }
    if (sim.human) {
      hacc += dt / DT;
      const steer = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0);
      const thr = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
      for (let n = Math.min(6, Math.floor(hacc)); n > 0; n--) sim.stepHuman(steer, thr);
      hacc -= Math.floor(hacc);
    }
  }
  const f = pickFocus();
  const cars = sim.solo ? [sim.solo.car] : sim.cars;
  const watched = sim.human || f; // the car whose dashboard we show
  world.render(sim, cars, f, view, dt, simDt);
  ui.hud(sim, watched, sim.human ? 'drive' : sim.solo ? 'solo' : 'train');
  ui.drawDash(watched);
  updateSound(watched);
  if (frame % 2 === 0) ui.drawNet(f && f.brain);
  if (frame % 3 === 0) ui.drawMap(sim, cars, f);
  frame++;
  requestAnimationFrame(loop);
}
ui.drawChart(sim.history);
requestAnimationFrame(loop);
