// Procedural closed race track.
// Control points are scattered around a circle, joined with a Catmull-Rom spline,
// then resampled into evenly spaced centre-line points with left/right edges.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(ang, rad, spacing) {
  const n = ang.length;
  const px = ang.map((a, i) => Math.cos(a) * rad[i]);
  const pz = ang.map((a, i) => Math.sin(a) * rad[i]);
  const cr = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

  // dense spline
  const dx = [], dz = [];
  const SUB = 20;
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = i, c = (i + 1) % n, d = (i + 2) % n;
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      dx.push(cr(px[a], px[b], px[c], px[d], t));
      dz.push(cr(pz[a], pz[b], pz[c], pz[d], t));
    }
  }
  const m = dx.length;
  let total = 0;
  const segL = new Array(m);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    segL[i] = Math.hypot(dx[j] - dx[i], dz[j] - dz[i]);
    total += segL[i];
  }

  // even arclength resample
  const N = Math.max(40, Math.round(total / spacing));
  const step = total / N;
  const cx = new Float64Array(N), cz = new Float64Array(N);
  let i = 0, acc = 0;
  for (let k = 0; k < N; k++) {
    const target = k * step;
    while (acc + segL[i] < target && i < m - 1) { acc += segL[i]; i++; }
    const u = segL[i] > 0 ? (target - acc) / segL[i] : 0;
    const j = (i + 1) % m;
    cx[k] = dx[i] + (dx[j] - dx[i]) * u;
    cz[k] = dz[i] + (dz[j] - dz[i]) * u;
  }

  // curvature (turn angle per metre)
  let maxK = 0, worst = 0;
  const curv = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const a = (k + N - 1) % N, b = (k + 1) % N;
    const h1 = Math.atan2(cx[k] - cx[a], cz[k] - cz[a]);
    const h2 = Math.atan2(cx[b] - cx[k], cz[b] - cz[k]);
    let d = h2 - h1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    curv[k] = d / step;
    if (Math.abs(curv[k]) > maxK) { maxK = Math.abs(curv[k]); worst = k; }
  }
  return { cx, cz, N, step, total, curv, maxK, worst };
}

export function buildTrack({ seed = 1, points = 12, twist = 0.35, width = 13, radius = 110, hills = 0, spacing = 2 } = {}) {
  const rnd = mulberry32(seed);
  const n = Math.max(5, points | 0);
  const ang = [], rad = [];
  for (let i = 0; i < n; i++) {
    ang.push(((i + (rnd() - 0.5) * 0.7) / n) * Math.PI * 2);
    rad.push(radius * (1 + twist * (rnd() * 2 - 1)));
  }
  const hw = width / 2;
  const maxK = 1 / (hw + 12); // tightest corner the road is allowed to have

  // Relax corners that are too tight for the road width until the track is drivable.
  let S;
  for (let it = 0; it < 300; it++) {
    S = sample(ang, rad, spacing);
    if (S.maxK <= maxK) break;
    let j = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(Math.cos(ang[i]) * rad[i] - S.cx[S.worst], Math.sin(ang[i]) * rad[i] - S.cz[S.worst]);
      if (d < bd) { bd = d; j = i; }
    }
    const r0 = rad.slice();
    for (const o of [-1, 0, 1]) {
      const i = (j + o + n) % n, a = (i + n - 1) % n, b = (i + 1) % n;
      rad[i] = r0[i] + 0.35 * ((r0[a] + r0[b]) / 2 - r0[i]);
    }
  }

  const { cx, cz, N } = S;
  const tx = new Float64Array(N), tz = new Float64Array(N);
  const nx = new Float64Array(N), nz = new Float64Array(N);
  const lx = new Float64Array(N), lz = new Float64Array(N);
  const rx = new Float64Array(N), rz = new Float64Array(N);
  let R = 0;
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    const ddx = cx[b] - cx[a], ddz = cz[b] - cz[a];
    const l = Math.hypot(ddx, ddz) || 1;
    tx[i] = ddx / l; tz[i] = ddz / l;
    nx[i] = tz[i]; nz[i] = -tx[i];
    lx[i] = cx[i] + nx[i] * hw; lz[i] = cz[i] + nz[i] * hw;
    rx[i] = cx[i] - nx[i] * hw; rz[i] = cz[i] - nz[i] * hw;
    R = Math.max(R, Math.hypot(cx[i], cz[i]));
  }
  // Elevation: a few long sine waves around the lap (periodic, so the loop closes).
  const cy = new Float64Array(N), slope = new Float64Array(N), curvV = new Float64Array(N);
  const waves = [1, 2, 3, 5].map((k) => ({ k, a: (0.4 + rnd() * 0.6) / k ** 0.7, p: rnd() * 6.283 }));
  let peak = 1e-9;
  for (let i = 0; i < N; i++) {
    const s = (i / N) * Math.PI * 2;
    let y = 0;
    for (const w of waves) y += w.a * Math.sin(w.k * s + w.p);
    cy[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  let k = hills / peak, maxS = 0;
  for (let i = 0; i < N; i++) maxS = Math.max(maxS, Math.abs(cy[(i + 1) % N] - cy[(i + N - 1) % N]) * k / (2 * S.step));
  if (maxS > 0.11) k *= 0.11 / maxS; // keep gradients road-legal (11%)
  for (let i = 0; i < N; i++) cy[i] *= k;
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    slope[i] = (cy[b] - cy[a]) / (2 * S.step);            // dy/ds: positive = uphill
    curvV[i] = (cy[b] - 2 * cy[i] + cy[a]) / (S.step * S.step); // positive = dip, negative = crest
  }
  return { n: N, cx, cy, cz, tx, tz, nx, nz, lx, lz, rx, rz, curv: S.curv, slope, curvV, segLen: S.step, length: S.total, hw, width, R, seed };
}
