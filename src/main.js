import { Sim, defaults, DT, brainSizes } from './sim.js';
import { Brain } from './brain.js';
import { World } from './world.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'mlcar.champion.v1';

const cfg = { ...defaults };
const view = { showSensors: true, hideDead: false };
const state = { paused: true, speed: 2, driving: false };

const sim = new Sim(cfg);
const world = new World($('scene'));
world.setTrack(sim.track);
window.mlcar = { sim, world, cfg, state }; // handy for poking around in the console

const ui = new UI(cfg, view, onChange, onAction);

// ---- settings changes -----------------------------------------------------
function onChange(item) {
  if (item.kind === 'reset') {
    sim.reset();
    ui.drawChart(sim.history);
    ui.toast('Brain shape changed — learning restarted');
  } else if (item.kind === 'track') {
    newTrack(cfg.trackSeed);
  }
}

function newTrack(seed) {
  cfg.trackSeed = seed;
  sim.buildTrack();
  world.setTrack(sim.track);
  sim.restartGeneration();
  focus = null;
}

function onAction(a) {
  if (a === 'save') {
    const b = sim.champion || (focus && focus.brain);
    if (!b) return;
    const keep = ['sensors', 'sensorRange', 'sensorFov', 'hiddenLayers', 'hiddenSize'];
    localStorage.setItem(SAVE_KEY, JSON.stringify({ cfg: Object.fromEntries(keep.map((k) => [k, cfg[k]])), w: Array.from(b.w) }));
    ui.toast('Champion brain saved in this browser');
  } else if (a === 'load') {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return ui.toast('No saved champion yet');
    const data = JSON.parse(raw);
    Object.assign(cfg, data.cfg);
    sim.reset(new Brain(brainSizes(cfg), Float32Array.from(data.w)));
    ui.refresh(); ui.drawChart(sim.history);
    ui.toast('Champion loaded — population seeded from it');
  }
}

// ---- sim events -------------------------------------------------------------
sim.on('generation', (s) => {
  ui.drawChart(sim.history);
  focus = null;
});
sim.on('track', () => { world.setTrack(sim.track); ui.toast('New road generated'); });
sim.on('milestone', (kind, car) => {
  if (kind === 'lap') ui.toast(`Generation ${sim.gen}: first full lap!`);
  if (kind === 'finish') { ui.toast(`Generation ${sim.gen}: ${cfg.lapsTarget} laps finished in ${car.time.toFixed(1)}s`, true); ui.confetti(); }
  if (kind === 'record') ui.toast(`New record: ${car.time.toFixed(1)}s (generation ${sim.gen})`);
});
sim.on('humanCrash', () => ui.toast('You left the road — back to the start line'));

// ---- transport --------------------------------------------------------------
function setPaused(p) { state.paused = p; $('bPlay').textContent = p ? 'Play' : 'Pause'; }
$('bPlay').onclick = () => setPaused(!state.paused);
$('speed').oninput = (e) => { state.speed = Number(e.target.value); $('speedV').textContent = state.speed + '×'; };
$('bSkip').onclick = () => sim.evolve();
$('bTrack').onclick = () => { newTrack((Math.random() * 1e9) | 0); ui.toast('New road generated'); };
$('bReset').onclick = () => { sim.reset(); ui.drawChart(sim.history); focus = null; ui.toast('Fresh random brains'); };
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

// ---- which car does the camera follow? ---------------------------------------
let focus = null;
function pickFocus() {
  let best = null;
  for (const c of sim.cars) if (c.alive && (!best || c.prog > best.prog)) best = c;
  if (!best) {
    if (focus && focus.gen === sim.gen && sim.cars[focus.id] === focus) return focus;
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
  world.render(sim, f, view, dt, simDt);
  ui.hud(sim, f, state.driving);
  if (frame % 2 === 0) ui.drawNet(f && f.brain);
  if (frame % 3 === 0) ui.drawMap(sim, f);
  frame++;
  requestAnimationFrame(loop);
}
ui.drawChart(sim.history);
requestAnimationFrame(loop);
