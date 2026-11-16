// Control panel (generated from SCHEMA), telemetry, charts, toasts, confetti.

// kind: live = takes effect instantly | next = from the next generation
//       track = rebuilds the road      | reset = brain shape changes, learning restarts
export const SCHEMA = [
  {
    title: 'Evolution', open: true, hint: 'How one generation turns into the next. This is the learning algorithm.',
    items: [
      { key: 'population', label: 'Population', min: 10, max: 300, step: 10, kind: 'next', hint: 'Cars per generation. More cars test more ideas at once, but simulate slower.' },
      { key: 'elites', label: 'Elites', min: 0, max: 20, step: 1, kind: 'next', hint: 'Top cars copied unchanged into the next generation, so the best brain is never lost.' },
      { key: 'tournament', label: 'Selection pressure', min: 2, max: 10, step: 1, kind: 'next', hint: 'Each parent is the best of this many random cars. Higher = greedier, less variety.' },
      { key: 'mutationRate', label: 'Mutation rate', min: 0, max: 0.6, step: 0.01, kind: 'next', hint: 'Chance that each connection in a child brain gets randomly nudged.' },
      { key: 'mutationStrength', label: 'Mutation strength', min: 0.02, max: 1.5, step: 0.01, kind: 'next', hint: 'How big each nudge is. Big = wild exploration. Small = careful fine-tuning.' },
      { key: 'crossover', label: 'Crossover (two parents)', type: 'toggle', kind: 'next', hint: 'Children mix the weights of two parents instead of cloning one.' },
      { key: 'speedWeight', label: 'Speed reward', min: 0, max: 3, step: 0.1, kind: 'next', hint: 'How much pace counts in the score. 0 = only distance matters, so slow and safe wins. Higher pushes cars to be fast, at the price of more crashes.' },
      { key: 'gearWeight', label: 'Gear reward', min: 0, max: 1, step: 0.05, kind: 'next', hint: 'Manual gearbox only. Time spent in the right gear multiplies the score up, the wrong gear (engine bogged down or bouncing off the limiter) multiplies it down. 0 = no gear points: only the lap time tells them.' },
      { key: 'driftWeight', label: 'Drift reward', min: 0, max: 5, step: 0.1, kind: 'next', zero: 'off', hint: 'Points for sliding sideways at speed. Off by default: sliding is slow. Turn it up and evolution starts showing off.' },
      { key: 'minPace', label: 'Minimum pace', pct: true, min: 0, max: 0.9, step: 0.05, kind: 'live', zero: 'off', hint: 'Cars that fall behind this share of par pace are eliminated for being too slow.' },
      { key: 'lapsTarget', label: 'Laps to finish', min: 1, max: 10, step: 1, kind: 'live', hint: 'How many laps count as finishing the race.' },
      { key: 'timeLimit', label: 'Time limit', unit: 's', min: 30, max: 600, step: 10, kind: 'live', hint: 'A generation ends when every car has crashed or finished, or after this long.' },
    ],
  },
  {
    title: 'Racing', hint: 'Cars against each other, not just against the clock.',
    items: [
      { key: 'collide', label: 'Car collisions', type: 'toggle', kind: 'next', hint: 'Cars bump into each other instead of driving through one another, line up on a starting grid, and their eyes see other cars. Applies to training and to the champion run. A brain trained without it has never seen another car, so train with it on before racing.' },
      { key: 'raceCars', label: 'Cars in the champion run', min: 1, max: 20, step: 1, kind: 'live', hint: 'Run champion sends out this many of the best brains of the last generation, from a grid. The champion starts on pole.' },
    ],
  },
  {
    title: "Driver's controls", hint: 'What the driver has in their hands and under their feet. Each control is an output neuron of the brain.',
    items: [
      { key: 'gearbox', label: 'Gearbox', type: 'select', options: ['Manual', 'Auto'], kind: 'reset', hint: 'Manual: the brain shifts up and down itself, like paddle shifters, and has to learn when. Auto: the car always picks the best gear.' },
      { key: 'handbrake', label: 'Handbrake', type: 'toggle', kind: 'reset', hint: 'The brain can pull the handbrake as hard as it likes. It brakes only the rear wheels: pull hard and they lock, the tail steps out and the car drifts.' },
      { key: 'revLimit', label: 'Engine survives the limiter for', unit: ' s', min: 0, max: 10, step: 0.5, kind: 'live', zero: 'forever', hint: 'Hold the engine on the rev limiter longer than this and it blows up: the car is out. This is what stops a car from screaming round the whole lap in first gear.' },
      { key: 'wheelTurns', label: 'Steering wheel turns', unit: ' turns', min: 0.5, max: 2.5, step: 0.25, kind: 'live', hint: 'Turns of the wheel from centre to full lock. 1.5 is a road car. More turns = finer control but slower from lock to lock.' },
      { key: 'handSpeed', label: 'Hand speed', unit: '°/s', min: 200, max: 2000, step: 50, kind: 'live', hint: 'How fast the driver can spin the steering wheel. A quick racing driver manages about 900° per second.' },
    ],
  },
  {
    title: "Driver's senses", hint: 'What the driver can see and feel. Every sense adds input neurons to the brain: more to work with, but also more for evolution to figure out.',
    items: [
      { key: 'sensors', label: 'Eyes: distance rays', min: 3, max: 15, step: 1, kind: 'reset', hint: 'Number of rays measuring the distance to the road edge. Each one is an input neuron.' },
      { key: 'sensorRange', label: 'Sensor range', unit: 'm', min: 20, max: 250, step: 5, kind: 'live', hint: 'How far ahead the car can see. A fast car needs to see far to brake in time.' },
      { key: 'sensorFov', label: 'Field of view', unit: '°', min: 40, max: 300, step: 10, kind: 'live', hint: 'How wide the rays fan out around the nose.' },
      { key: 'sensorFocus', label: 'Forward focus', min: 1, max: 3, step: 0.1, kind: 'live', hint: '1 spreads rays evenly. Higher packs more of them toward straight ahead.' },
      { key: 'senseMotion', label: 'Speed & balance', type: 'toggle', kind: 'reset', hint: 'Speedometer, sideways slide and how fast the car is rotating. 3 inputs.' },
      { key: 'senseGain', label: 'Sense strength', pct: true, min: 0.05, max: 1, step: 0.05, kind: 'live', hint: 'How loudly the senses from G-forces down speak to the brain, compared with eyes and speed. Low keeps learning stable: evolution leans on them gradually. High lets them dominate, and mutations break more.' },
      { key: 'senseG', label: 'G-forces', type: 'toggle', kind: 'reset', hint: 'The seat of the pants: pushed back under power, thrown forward under braking, sideways in corners, light over crests and heavy in dips. 3 inputs.' },
      { key: 'senseEngine', label: 'Gear & revs', type: 'toggle', kind: 'reset', hint: 'Which gear the automatic gearbox is in, and the engine rpm. The engine pulls hardest near the top of the rev range. 2 inputs.' },
      { key: 'senseHills', label: 'Depth: hills', type: 'toggle', kind: 'reset', hint: 'The slope under the car, and how much the road rises or falls over the next 40 m and 100 m. 3 inputs.' },
      { key: 'senseBends', label: 'Depth: bends ahead', type: 'toggle', kind: 'reset', hint: 'Which way the road points 40 m and 100 m ahead of the nose: reading the corner before getting there. 2 inputs.' },
      { key: 'senseLane', label: 'Place on the road', type: 'toggle', kind: 'reset', hint: 'How far left or right of the centre line, and the angle to the road. 2 inputs.' },
      { key: 'senseTyres', label: 'Tyre feel', type: 'toggle', kind: 'reset', hint: 'Slip angle of the front and rear tyres: how close they are to letting go. 2 inputs.' },
      { key: 'senseControls', label: 'Hands & feet', type: 'toggle', kind: 'reset', hint: 'Where the steering wheel and the pedal are right now. They take time to move. 2 inputs.' },
    ],
  },
  {
    title: 'Brain', hint: 'The neural network between the senses and the controls.',
    items: [
      { key: 'hiddenLayers', label: 'Hidden layers', min: 0, max: 3, step: 1, kind: 'reset', hint: 'Layers between senses and controls. 0 = senses wired straight to the wheel.' },
      { key: 'hiddenSize', label: 'Neurons per layer', min: 2, max: 20, step: 1, kind: 'reset', hint: 'More neurons can learn subtler behaviour, but there is more to search.' },
      { type: 'buttons', buttons: [{ action: 'save', label: 'Save champion' }, { action: 'load', label: 'Load champion' }] },
    ],
  },
  {
    title: 'Sports car', hint: 'A real vehicle model: tyre slip, weight transfer, aero and a power-limited engine. Change it live and the brains have to cope.',
    items: [
      { key: 'power', label: 'Engine power', unit: ' hp', min: 80, max: 1200, step: 10, kind: 'live', hint: 'More power = faster on the straights, and easier to spin the rear wheels.' },
      { key: 'mass', label: 'Weight', unit: ' kg', min: 600, max: 2600, step: 50, kind: 'live', hint: 'Heavier cars accelerate, brake and change direction more slowly.' },
      { key: 'grip', label: 'Tyre grip', min: 0.3, max: 2.2, step: 0.05, kind: 'live', hint: 'Friction coefficient. 0.4 is ice, 0.8 is rain, 1.25 is sports tyres, 1.8 is racing slicks.' },
      { key: 'downforce', label: 'Downforce', min: 0, max: 5, step: 0.1, kind: 'live', hint: 'Wings push the car into the road at speed: more grip in fast corners.' },
      { key: 'brake', label: 'Brake force', unit: ' g', min: 0.4, max: 3, step: 0.1, kind: 'live', hint: 'How hard the brakes can bite. The tyres still set the real limit.' },
      { key: 'gravity', label: 'Gravity', unit: ' m/s²', min: 1, max: 25, step: 0.1, kind: 'live', hint: 'Earth is 9.8, the Moon 1.6, Jupiter 24.8. Less gravity = less grip, and hills matter less.' },
      { key: 'steerLock', label: 'Steering lock', min: 0.2, max: 0.8, step: 0.05, kind: 'live', hint: 'Maximum angle of the front wheels (radians).' },
      { key: 'drive', label: 'Driven wheels', type: 'select', options: ['RWD', 'AWD', 'FWD'], kind: 'live', hint: 'Rear-wheel drive oversteers on power, front-wheel drive understeers, all-wheel drive has the most traction.' },
      { key: 'aids', label: 'ABS + traction control', type: 'toggle', kind: 'live', hint: 'Stops the wheels locking under braking or spinning under power.' },
      { key: 'steerAssist', label: 'Speed-sensitive steering', type: 'toggle', kind: 'live', hint: 'The same steering input turns the wheels less at high speed, like a real car.' },
    ],
  },
  {
    title: 'Road', hint: 'Roads are generated procedurally. Every seed is a different circuit.',
    items: [
      { key: 'trackEvery', label: 'New road every', unit: ' gens', min: 0, max: 20, step: 1, kind: 'live', zero: 'off', hint: 'Auto-generate a new road every N generations. Forces real driving skill instead of memorising one track.' },
      { key: 'trackSize', label: 'Circuit size', unit: 'm', min: 90, max: 400, step: 10, kind: 'track', hint: 'Bigger circuits have longer straights and higher speeds.' },
      { key: 'trackHills', label: 'Hills', unit: 'm', min: 0, max: 25, step: 1, kind: 'track', hint: 'Height of the climbs and drops. Gravity slows the car uphill and lightens it over crests.' },
      { key: 'trackWidth', label: 'Road width', unit: 'm', min: 7, max: 24, step: 1, kind: 'track', hint: 'Narrow roads are much harder.' },
      { key: 'trackTwist', label: 'Twistiness', min: 0, max: 0.7, step: 0.05, kind: 'track', hint: '0 is nearly a circle. Higher gives hairpins and esses.' },
      { key: 'trackPoints', label: 'Corners', min: 6, max: 28, step: 1, kind: 'track', hint: 'Number of control points the road is bent through.' },
    ],
  },
  {
    title: 'View & sound', hint: '',
    items: [
      { key: 'showSensors', obj: 'view', label: 'Show sensor rays', type: 'toggle', kind: 'live', hint: 'Green = far from the edge, red = close.' },
      { key: 'hideDead', obj: 'view', label: 'Hide crashed cars', type: 'toggle', kind: 'live', hint: 'Wrecks show where the population struggles.' },
      { key: 'sound', obj: 'view', label: 'Engine sound', type: 'toggle', kind: 'live', hint: 'Hear the leader rev through the gears.' },
      { type: 'buttons', buttons: [{ action: 'defaults', label: 'Restore all default settings' }] },
    ],
  },
];

// gap to par: negative (faster than par) is good
export function fmtGap(d) {
  return (d < 0 ? '−' : '+') + Math.abs(d).toFixed(1) + 's';
}

export function fmtTime(t) {
  if (!isFinite(t)) return '—';
  const m = Math.floor(t / 60);
  return m + ':' + (t - m * 60).toFixed(1).padStart(4, '0');
}

const TAGS = { reset: 'restarts learning', track: 'rebuilds road' };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function fit(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export class UI {
  constructor(cfg, view, onChange, onAction) {
    this.cfg = cfg; this.view = view; this.onChange = onChange; this.onAction = onAction;
    this.inputs = [];
    this.build();
    this.pipCount = 0;
  }

  build() {
    const root = $('controls');
    for (const grp of SCHEMA) {
      const d = document.createElement('details');
      d.className = 'group'; d.open = !!grp.open;
      d.innerHTML = `<summary><i></i>${grp.title}</summary>${grp.hint ? `<p class="group-hint">${grp.hint}</p>` : ''}`;
      for (const it of grp.items) {
        const el = document.createElement('div');
        el.className = 'ctl';
        if (it.type === 'buttons') {
          el.className = 'btn-row';
          for (const b of it.buttons) {
            const btn = document.createElement('button');
            btn.textContent = b.label; btn.onclick = () => this.onAction(b.action);
            el.appendChild(btn);
          }
          d.appendChild(el); continue;
        }
        const obj = it.obj === 'view' ? this.view : this.cfg;
        const tag = TAGS[it.kind] ? `<span class="tag">${TAGS[it.kind]}</span>` : '';
        if (it.type === 'select') {
          el.innerHTML = `<div class="ctl-row"><label>${it.label}${tag}</label></div><div class="seg wide"></div><small>${it.hint}</small>`;
          const box = el.querySelector('.seg');
          const sync = () => [...box.children].forEach((b) => b.classList.toggle('on', b.textContent === obj[it.key]));
          for (const opt of it.options) {
            const b = document.createElement('button');
            b.textContent = opt;
            b.onclick = () => { obj[it.key] = opt; sync(); this.onChange(it); };
            box.appendChild(b);
          }
          sync();
          this.inputs.push(sync);
        } else if (it.type === 'toggle') {
          el.innerHTML = `<label class="toggle"><input type="checkbox">${it.label}${tag}</label><small>${it.hint}</small>`;
          const inp = el.querySelector('input');
          inp.checked = obj[it.key];
          inp.onchange = () => { obj[it.key] = inp.checked; this.onChange(it); };
          this.inputs.push(() => (inp.checked = obj[it.key]));
        } else {
          el.innerHTML = `<div class="ctl-row"><label>${it.label}${tag}</label><output></output></div><input type="range" min="${it.min}" max="${it.max}" step="${it.step}"><small>${it.hint}</small>`;
          const inp = el.querySelector('input'), out = el.querySelector('output');
          const dec = (String(it.step).split('.')[1] || '').length;
          const show = () => { const v = obj[it.key]; out.textContent = v === 0 && it.zero ? it.zero : it.pct ? Math.round(v * 100) + '%' : Number(v).toFixed(dec) + (it.unit || ''); };
          inp.value = obj[it.key]; show();
          inp.oninput = () => { obj[it.key] = Number(inp.value); show(); };
          inp.onchange = () => this.onChange(it); // structural changes apply on release
          this.inputs.push(() => { inp.value = obj[it.key]; show(); });
        }
        d.appendChild(el);
      }
      root.appendChild(d);
    }
  }

  refresh() { for (const f of this.inputs) f(); }

  // ---- telemetry ---------------------------------------------------------
  // car = the car being watched (leader, champion, or you)
  hud(sim, car, mode) {
    const cfg = sim.cfg, N = sim.track.n, last = sim.history[sim.history.length - 1];
    $('sGen').textContent = sim.gen;
    $('sAlive').textContent = mode === 'solo' ? `${sim.solo.all.filter((c) => c.alive).length}/${sim.solo.all.length}` : `${sim.alive}/${sim.cars.length}`;
    $('sFin').textContent = last ? `${last.finished}/${cfg.population}` : '—';
    $('sBestTime').textContent = fmtTime(sim.records.bestTime);
    $('sBestTime').nextElementSibling.textContent = `Best ${cfg.lapsTarget}-lap time`;
    $('sPar').textContent = fmtTime(sim.par.total);
    $('sPar').nextElementSibling.textContent = `Par ${cfg.lapsTarget}-lap time`;
    const gap = sim.records.bestTime - sim.par.total;
    $('sGap').textContent = isFinite(gap) ? fmtGap(gap) : '—';
    $('sGap').style.color = !isFinite(gap) ? '' : gap <= 0 ? '#5fd38d' : gap < sim.par.total * 0.15 ? css('--gold') : '#ff7a6b';

    // manual gearbox: how much of the engine's push the driver has had available so far
    const gearTxt = car && cfg.gearbox === 'Manual' ? ` · right gear ${Math.round(((sim.gearScore(car) + 1) / 2) * 100)}%` : '';
    const laps = cfg.lapsTarget;
    if (this.pipCount !== laps) {
      $('pips').innerHTML = Array.from({ length: laps }, () => '<div class="pip"><i></i></div>').join('');
      this.pipCount = laps;
    }
    const p = car ? Math.max(0, car.prog / N) : 0;
    const done = Math.min(laps, Math.floor(p));
    $('lapTitle').textContent = car && car.finished ? 'FINISHED' : `LAP ${Math.min(laps, done + 1)} / ${laps}`;
    $('lapSub').textContent =
      mode === 'drive' ? 'You are driving — arrows or WASD'
      : mode === 'solo' ? `Champion run · ${fmtTime(car.time)}${gearTxt}`
      : car && !car.alive ? `Leader ${car.why}` : `Leader · ${fmtTime(car ? car.time : 0)} · ${car ? Math.round(sim.pace(car) * 100) : 0}% of par pace${gearTxt}`;
    [...$('pips').children].forEach((el, i) => (el.firstChild.style.width = Math.max(0, Math.min(1, p - i)) * 100 + '%'));
  }

  // Speedo, gear, revs, pedals, handbrake, steering wheel and a g-force meter for the watched car.
  drawDash(car, cfg = this.cfg) {
    const { ctx, w, h } = fit($('dash'));
    if (!car) return;
    const kmh = car.v * 3.6, gear = car.gear, rpm = car.rpm;
    const acc = css('--acc'), mute = '#98a2b3', text = '#eef1f6';
    // rev bar
    const segs = 24, bw = (w - 16) / segs;
    for (let i = 0; i < segs; i++) {
      const on = i / segs < rpm / 7800;
      ctx.fillStyle = on ? (i >= segs - 4 ? '#ff4d4d' : i >= segs - 9 ? css('--gold') : '#5fd38d') : 'rgba(255,255,255,.1)';
      ctx.fillRect(8 + i * bw, 4, bw - 2, 7);
    }
    // speed + gear
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = text; ctx.font = '800 34px ui-sans-serif, system-ui';
    ctx.fillText(Math.round(kmh), 8, 56);
    ctx.fillStyle = mute; ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillText('km/h', 8, 70);
    const over = rpm >= 7650; // on the rev limiter
    if (over) ctx.fillStyle = '#ff4d4d';
    ctx.fillText(over ? 'SHIFT UP!' : 'GEAR', 96, 32);
    // the gear number goes green in the right gear and red in the wrong one
    ctx.fillStyle = car.gearOk > 0.8 ? '#5fd38d' : car.gearOk > 0.3 ? css('--gold') : '#ff4d4d';
    ctx.font = '800 26px ui-sans-serif, system-ui';
    ctx.fillText(gear, 98, 58);
    // steering wheel angle
    const wheel = Math.round(car.steer * cfg.wheelTurns * 360);
    ctx.fillStyle = mute; ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillText(wheel === 0 ? 'wheel 0°' : `wheel ${Math.abs(wheel)}° ${wheel > 0 ? 'L' : 'R'}`, 60, 72);
    // steering
    const sx = 8, sw = 118, sy = 80;
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(sx, sy, sw, 5);
    ctx.fillStyle = css('--acc2');
    const st = Math.max(-1, Math.min(1, car.steer));
    ctx.fillRect(sx + sw / 2, sy, (-st * sw) / 2, 5);
    ctx.fillStyle = text; ctx.fillRect(sx + sw / 2 - 0.5, sy - 2, 1, 9);
    // pedals
    const bar = (x, v, color, label) => {
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, 22, 10, 56);
      ctx.fillStyle = color; ctx.fillRect(x, 78 - 56 * v, 10, 56 * v);
      ctx.fillStyle = mute; ctx.font = '9px ui-sans-serif, system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x + 5, 89);
    };
    bar(140, Math.max(0, car.thr), '#5fd38d', 'gas');
    bar(157, Math.max(0, -car.thr), '#ff4d4d', 'brk');
    bar(174, car.hand, css('--gold'), 'hb');
    // g-meter (shows the force you would feel: braking throws you forward)
    const gx = w - 44, gy = 48, gr = 30, G = 9.81 * 1.8;
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(gx, gy, gr / 1.8, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx - gr, gy); ctx.lineTo(gx + gr, gy); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx, gy + gr); ctx.stroke();
    let px = (car.ay / G) * gr, py = (car.ax / G) * gr;
    const pm = Math.hypot(px, py);
    if (pm > gr) { px *= gr / pm; py *= gr / pm; }
    ctx.fillStyle = car.slip ? '#ff4d4d' : acc;
    ctx.beginPath(); ctx.arc(gx + px, gy + py, 4.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = mute; ctx.font = '9px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
    ctx.fillText((Math.hypot(car.ax, car.ay) / 9.81).toFixed(1) + ' g', gx, 89);
  }

  // Everything the watched car senses right now, in human units: the inputs of its brain.
  drawSenses(sim, car) {
    const cv = $('senses'), S = sim.inputs;
    if (!car || car.inp.length !== car.rays.length + S.length) return;
    const ROW = 14, GAP = 5, RAYS = 34, n = car.rays.length;
    let want = RAYS + 4;
    S.forEach((s, j) => (want += ROW + (j && s.group !== S[j - 1].group ? GAP : 0)));
    if (this.sensesH !== want) { cv.style.height = want + 'px'; this.sensesH = want; }
    const { ctx, w } = fit(cv);
    if (!w) return; // card is folded
    const x0 = 72, x1 = w - 84, bw = x1 - x0, mid = x0 + bw / 2;
    const pos = css('--acc'), neg = css('--acc2'), mute = '#98a2b3', text = '#eef1f6';
    ctx.font = '10px ui-sans-serif, system-ui'; ctx.textBaseline = 'middle';
    // eyes: one bar per ray, laid out left to right as the driver sees them
    const range = sim.cfg.sensorRange, cw = bw / n;
    let near = Infinity;
    for (let k = 0; k < n; k++) {
      const t = Math.min(1, car.rays[k] / range), bh = 3 + t * (RAYS - 9);
      near = Math.min(near, car.rays[k]);
      ctx.fillStyle = `hsl(${Math.round(t * 120)} 70% 55%)`;
      ctx.fillRect(x0 + (n - 1 - k) * cw + 1, RAYS - 4 - bh, Math.max(1, cw - 2), bh);
    }
    ctx.fillStyle = mute; ctx.textAlign = 'right'; ctx.fillText('eyes', x0 - 8, RAYS / 2);
    ctx.fillStyle = text; ctx.fillText(`edge ${Math.round(near)} m`, w - 2, RAYS / 2);
    let y = RAYS + 4;
    S.forEach((s, j) => {
      if (j && s.group !== S[j - 1].group) y += GAP;
      const v = Math.max(-1, Math.min(1, s.read(car, sim))), cy = y + ROW / 2;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0, cy - 3, bw, 6);
      ctx.fillStyle = v > 0 ? pos : neg;
      ctx.fillRect(mid, cy - 3, ((s.dir ? -v : v) * bw) / 2, 6);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(mid - 0.5, cy - 5, 1, 10);
      ctx.fillStyle = mute; ctx.textAlign = 'right'; ctx.fillText(s.label, x0 - 8, cy);
      ctx.fillStyle = text; ctx.fillText(s.show(car, sim), w - 2, cy);
      y += ROW;
    });
  }

  drawNet(brain, inputs = [], controls = []) {
    const cv = $('net');
    if (brain) { // many senses need a taller picture
      const want = Math.max(200, Math.min(340, 16 + brain.sizes[0] * 11));
      if (this.netH !== want) { cv.style.height = want + 'px'; this.netH = want; }
    }
    const { ctx, w, h } = fit(cv);
    if (!brain) return;
    const sizes = brain.sizes, L = sizes.length, padL = 58, padR = 62, nRays = sizes[0] - inputs.length;
    const X = (l) => padL + ((w - padL - padR) * l) / (L - 1);
    const Y = (l, i) => h / 2 + (i - (sizes[l] - 1) / 2) * Math.min(22, (h - 16) / sizes[l]);
    const pos = css('--acc'), neg = css('--acc2');
    let o = 0;
    for (let l = 0; l < L - 1; l++) {
      for (let j = 0; j < sizes[l + 1]; j++) {
        o++;
        for (let i = 0; i < sizes[l]; i++) {
          const s = brain.w[o++] * brain.acts[l][i], m = Math.min(1, Math.abs(s));
          ctx.strokeStyle = s > 0 ? pos : neg;
          ctx.globalAlpha = 0.06 + 0.8 * m;
          ctx.lineWidth = 0.5 + 2.2 * m;
          ctx.beginPath(); ctx.moveTo(X(l), Y(l, i)); ctx.lineTo(X(l + 1), Y(l + 1, j)); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = (sizes[0] > 16 ? 9 : 10) + 'px ui-sans-serif, system-ui'; ctx.textBaseline = 'middle';
    const r = Math.min(6, Math.max(3.5, (h - 16) / sizes[0] / 2 - 1));
    for (let l = 0; l < L; l++) {
      for (let i = 0; i < sizes[l]; i++) {
        const a = brain.acts[l][i], x = X(l), y = Y(l, i);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3);
        ctx.fillStyle = '#1b202b'; ctx.fill();
        ctx.globalAlpha = Math.min(1, Math.abs(a)); ctx.fillStyle = a > 0 ? pos : neg; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#98a2b3';
        if (l === 0) { ctx.textAlign = 'right'; ctx.fillText(i < nRays ? 'ray ' + (i + 1) : inputs[i - nRays]?.label ?? '', x - r - 4, y); }
        if (l === L - 1) {
          ctx.textAlign = 'left';
          const name = controls[i] || (i ? 'pedal' : 'steer');
          const txt = name === 'steer' ? (a > 0.08 ? 'left' : a < -0.08 ? 'right' : 'straight')
            : name === 'pedal' ? (a > 0.1 ? 'gas' : a < -0.1 ? 'brake' : 'coast')
            : name === 'shift' ? (a > 0.5 ? 'shift up' : a < -0.5 ? 'shift down' : 'hold gear')
            : a > 0.3 ? 'handbrake' : 'hb off';
          ctx.fillStyle = '#eef1f6'; ctx.fillText(txt, x + r + 5, y);
        }
      }
    }
  }

  drawChart(history) {
    this.drawTimes(history);
    const { ctx, w, h } = fit($('chart'));
    const pl = 34, pr = 6, pt = 8, pb = 16;
    ctx.font = '10px ui-sans-serif, system-ui'; ctx.fillStyle = '#98a2b3'; ctx.textBaseline = 'middle';
    if (!history.length) { ctx.textAlign = 'center'; ctx.fillText('Finish the first generation to see the curve', w / 2, h / 2); return; }
    const max = Math.max(...history.map((s) => s.best)) * 1.08 || 1, n = history.length;
    const X = (i) => pl + (n === 1 ? 0.5 : i / (n - 1)) * (w - pl - pr), Y = (v) => pt + (1 - v / max) * (h - pt - pb);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.textAlign = 'right';
    for (let k = 0; k <= 2; k++) {
      const v = (max * k) / 2, y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
      ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0), pl - 5, y);
    }
    ctx.textAlign = 'left'; ctx.fillText('gen 1', pl, h - 6);
    ctx.textAlign = 'right'; ctx.fillText('gen ' + history[n - 1].gen, w - pr, h - 6);
    const line = (key, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      history.forEach((s, i) => (i ? ctx.lineTo(X(i), Y(s[key])) : ctx.moveTo(X(i), Y(s[key]))));
      ctx.stroke();
      if (n === 1) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(0), Y(history[0][key]), 3, 0, 6.3); ctx.fill(); }
    };
    line('avg', css('--acc2')); line('best', css('--acc'));
    ctx.fillStyle = css('--gold');
    history.forEach((s, i) => { if (s.finished) { ctx.beginPath(); ctx.arc(X(i), Y(s.best), 2.6, 0, 6.3); ctx.fill(); } });
  }

  // Best finishing time per generation against par. This is the time attack: lower is better.
  drawTimes(history) {
    const { ctx, w, h } = fit($('times'));
    const pl = 34, pr = 6, pt = 8, pb = 16;
    ctx.font = '10px ui-sans-serif, system-ui'; ctx.fillStyle = '#98a2b3'; ctx.textBaseline = 'middle';
    const done = history.filter((s) => isFinite(s.bestTime));
    if (!done.length) { ctx.textAlign = 'center'; ctx.fillText('No car has finished the race yet', w / 2, h / 2); return; }
    const par = history[history.length - 1].par, n = history.length;
    const lo = Math.min(par, ...done.map((s) => s.bestTime)) * 0.96, hi = Math.max(par, ...done.map((s) => s.bestTime)) * 1.04;
    const X = (i) => pl + (n === 1 ? 0.5 : i / (n - 1)) * (w - pl - pr), Y = (v) => pt + ((hi - v) / (hi - lo)) * (h - pt - pb);
    ctx.textAlign = 'right';
    ctx.fillText(fmtTime(hi).slice(0, -2), pl - 5, Y(hi) + 4); ctx.fillText(fmtTime(lo).slice(0, -2), pl - 5, Y(lo) - 2);
    ctx.textAlign = 'left'; ctx.fillText('gen 1', pl, h - 6);
    ctx.textAlign = 'right'; ctx.fillText('gen ' + history[n - 1].gen, w - pr, h - 6);
    // par line
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pl, Y(par)); ctx.lineTo(w - pr, Y(par)); ctx.stroke(); ctx.setLineDash([]);
    // best time: only generations where somebody finished
    ctx.strokeStyle = ctx.fillStyle = css('--gold'); ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    history.forEach((s, i) => {
      if (!isFinite(s.bestTime)) { pen = false; return; }
      if (pen) ctx.lineTo(X(i), Y(s.bestTime)); else ctx.moveTo(X(i), Y(s.bestTime));
      pen = true;
    });
    ctx.stroke();
    history.forEach((s, i) => { if (isFinite(s.bestTime)) { ctx.beginPath(); ctx.arc(X(i), Y(s.bestTime), 2.2, 0, 6.3); ctx.fill(); } });
  }

  drawMap(sim, cars, focus) {
    const { ctx, w, h } = fit($('map'));
    const T = sim.track, s = Math.min(w, h) / (T.R * 2 + T.width + 8);
    const X = (x) => w / 2 + x * s, Y = (z) => h / 2 + z * s; // same orientation as the Top camera
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < T.n; i++) (i ? ctx.lineTo(X(T.cx[i]), Y(T.cz[i])) : ctx.moveTo(X(T.cx[i]), Y(T.cz[i])));
    ctx.closePath();
    ctx.strokeStyle = '#59606d'; ctx.lineWidth = Math.max(3, T.width * s); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(T.lx[0]), Y(T.lz[0])); ctx.lineTo(X(T.rx[0]), Y(T.rz[0])); ctx.stroke();
    for (const c of cars) {
      if (c === focus) continue;
      ctx.fillStyle = c.finished ? css('--gold') : c.alive ? 'rgba(255,255,255,.85)' : 'rgba(20,22,28,.55)';
      ctx.beginPath(); ctx.arc(X(c.x), Y(c.z), c.alive ? 2 : 1.5, 0, 6.3); ctx.fill();
    }
    const dot = (c, color) => { ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(c.x), Y(c.z), 4.5, 0, 6.3); ctx.fill(); ctx.stroke(); };
    if (focus) dot(focus, css('--acc'));
    if (sim.human) dot(sim.human, css('--acc2'));
  }

  toast(msg, gold) {
    const el = document.createElement('div');
    el.className = 'toast' + (gold ? ' gold' : '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => (el.style.opacity = 0), gold ? 4500 : 2800);
    setTimeout(() => el.remove(), gold ? 5000 : 3300);
  }

  confetti() {
    const cv = $('confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#ff6a3d', '#ffc933', '#4aa8ff', '#5fd38d', '#ffffff'];
    const parts = Array.from({ length: 180 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.3,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 3, r: Math.random() * 6.28, s: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
    }));
    let frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += 0.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (++frames < 200) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    tick();
  }
}
