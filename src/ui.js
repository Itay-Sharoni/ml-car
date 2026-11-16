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
      { key: 'lapsTarget', label: 'Laps to finish', min: 1, max: 10, step: 1, kind: 'live', hint: 'How many laps count as finishing the race.' },
      { key: 'timeLimit', label: 'Time limit', unit: 's', min: 30, max: 400, step: 10, kind: 'live', hint: 'A generation ends when every car has crashed or finished, or after this long.' },
    ],
  },
  {
    title: 'Brain & senses', hint: 'What the car can perceive and how big its neural network is.',
    items: [
      { key: 'sensors', label: 'Sensors', min: 3, max: 15, step: 1, kind: 'reset', hint: 'Number of distance rays. Each one is an input neuron.' },
      { key: 'sensorRange', label: 'Sensor range', unit: 'm', min: 15, max: 150, step: 5, kind: 'live', hint: 'How far ahead the car can see. Short range = short-sighted driver.' },
      { key: 'sensorFov', label: 'Field of view', unit: '°', min: 40, max: 300, step: 10, kind: 'live', hint: 'How wide the rays fan out around the nose.' },
      { key: 'hiddenLayers', label: 'Hidden layers', min: 0, max: 3, step: 1, kind: 'reset', hint: 'Layers between senses and controls. 0 = senses wired straight to the wheel.' },
      { key: 'hiddenSize', label: 'Neurons per layer', min: 2, max: 20, step: 1, kind: 'reset', hint: 'More neurons can learn subtler behaviour, but there is more to search.' },
      { type: 'buttons', buttons: [{ action: 'save', label: 'Save champion' }, { action: 'load', label: 'Load champion' }] },
    ],
  },
  {
    title: 'Car physics', hint: 'Change the car live. The brains have to cope (or re-learn).',
    items: [
      { key: 'maxSpeed', label: 'Top speed', unit: ' m/s', min: 15, max: 90, step: 1, kind: 'live', hint: 'Faster cars finish sooner but must learn to brake for corners.' },
      { key: 'accel', label: 'Acceleration', min: 5, max: 45, step: 1, kind: 'live', hint: 'Engine power.' },
      { key: 'brake', label: 'Brakes', min: 8, max: 70, step: 1, kind: 'live', hint: 'Stopping power.' },
      { key: 'grip', label: 'Tyre grip', min: 6, max: 50, step: 1, kind: 'live', hint: 'How hard the car can turn at speed. Low grip = ice: it understeers wide.' },
      { key: 'steerLock', label: 'Steering lock', min: 0.2, max: 0.9, step: 0.05, kind: 'live', hint: 'Maximum angle of the front wheels (radians).' },
    ],
  },
  {
    title: 'Road', hint: 'Roads are generated procedurally. Every seed is a different circuit.',
    items: [
      { key: 'trackEvery', label: 'New road every', unit: ' gens', min: 0, max: 20, step: 1, kind: 'live', zero: 'off', hint: 'Auto-generate a new road every N generations. Forces real driving skill instead of memorising one track.' },
      { key: 'trackWidth', label: 'Road width', unit: 'm', min: 7, max: 24, step: 1, kind: 'track', hint: 'Narrow roads are much harder.' },
      { key: 'trackTwist', label: 'Twistiness', min: 0, max: 0.7, step: 0.05, kind: 'track', hint: '0 is nearly a circle. Higher gives hairpins and esses.' },
      { key: 'trackPoints', label: 'Corners', min: 6, max: 28, step: 1, kind: 'track', hint: 'Number of control points the road is bent through.' },
    ],
  },
  {
    title: 'View', hint: '',
    items: [
      { key: 'showSensors', obj: 'view', label: 'Show sensor rays', type: 'toggle', kind: 'live', hint: 'Green = far from the edge, red = close.' },
      { key: 'hideDead', obj: 'view', label: 'Hide crashed cars', type: 'toggle', kind: 'live', hint: 'Wrecks show where the population struggles.' },
    ],
  },
];

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
        if (it.type === 'toggle') {
          el.innerHTML = `<label class="toggle"><input type="checkbox">${it.label}</label><small>${it.hint}</small>`;
          const inp = el.querySelector('input');
          inp.checked = obj[it.key];
          inp.onchange = () => { obj[it.key] = inp.checked; this.onChange(it); };
          this.inputs.push(() => (inp.checked = obj[it.key]));
        } else {
          el.innerHTML = `<div class="ctl-row"><label>${it.label}${tag}</label><output></output></div><input type="range" min="${it.min}" max="${it.max}" step="${it.step}"><small>${it.hint}</small>`;
          const inp = el.querySelector('input'), out = el.querySelector('output');
          const dec = (String(it.step).split('.')[1] || '').length;
          const show = () => { const v = obj[it.key]; out.textContent = v === 0 && it.zero ? it.zero : Number(v).toFixed(dec) + (it.unit || ''); };
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
  hud(sim, focus, driving) {
    const cfg = sim.cfg, N = sim.track.n, car = driving ? sim.human : focus;
    $('sGen').textContent = sim.gen;
    $('sAlive').textContent = `${sim.alive}/${sim.cars.length}`;
    $('sSpeed').textContent = car ? Math.round(car.v * 3.6) : 0;
    $('sTime').textContent = sim.time.toFixed(0) + 's';
    $('sBestTime').textContent = isFinite(sim.records.bestTime) ? sim.records.bestTime.toFixed(1) + 's' : '—';
    $('sBestTime').nextElementSibling.textContent = `Best ${cfg.lapsTarget}-lap time`;
    $('sBestFit').textContent = Math.round(sim.records.bestFitness);

    const laps = cfg.lapsTarget;
    if (this.pipCount !== laps) {
      $('pips').innerHTML = Array.from({ length: laps }, () => '<div class="pip"><i></i></div>').join('');
      this.pipCount = laps;
    }
    const p = car ? Math.max(0, car.prog / N) : 0;
    const done = Math.min(laps, Math.floor(p));
    $('lapTitle').textContent = car && car.finished ? 'FINISHED' : `LAP ${Math.min(laps, done + 1)} / ${laps}`;
    $('lapSub').textContent = driving ? 'You are driving — arrows or WASD' : car && !car.alive ? `Leader ${car.why}` : 'Leader progress';
    [...$('pips').children].forEach((el, i) => (el.firstChild.style.width = Math.max(0, Math.min(1, p - i)) * 100 + '%'));
  }

  drawNet(brain) {
    const { ctx, w, h } = fit($('net'));
    if (!brain) return;
    const sizes = brain.sizes, L = sizes.length, padL = 40, padR = 46;
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
    ctx.font = '10px ui-sans-serif, system-ui'; ctx.textBaseline = 'middle';
    const r = Math.min(6, Math.max(3.5, (h - 16) / sizes[0] / 2 - 1));
    for (let l = 0; l < L; l++) {
      for (let i = 0; i < sizes[l]; i++) {
        const a = brain.acts[l][i], x = X(l), y = Y(l, i);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3);
        ctx.fillStyle = '#1b202b'; ctx.fill();
        ctx.globalAlpha = Math.min(1, Math.abs(a)); ctx.fillStyle = a > 0 ? pos : neg; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#98a2b3';
        if (l === 0) { ctx.textAlign = 'right'; ctx.fillText(i === sizes[0] - 1 ? 'speed' : 'ray ' + (i + 1), x - r - 4, y); }
        if (l === L - 1) {
          ctx.textAlign = 'left';
          const txt = i === 0 ? (a > 0.08 ? 'left' : a < -0.08 ? 'right' : 'straight') : a > 0 ? 'gas' : 'brake';
          ctx.fillStyle = '#eef1f6'; ctx.fillText(txt, x + r + 5, y);
        }
      }
    }
  }

  drawChart(history) {
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

  drawMap(sim, focus) {
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
    for (const c of sim.cars) {
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
