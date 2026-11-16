// Everything you see: sky, terrain, road, cars, sensor rays and cameras.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './track.js';
import { sensorAngle } from './sim.js';

const MAX_CARS = 320;
const MAX_RAYS = 16;

function paint(g, hex) {
  if (g.index) g = g.toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Side profile (x = forward, y = up) extruded across the car's width.
function profile(pts, depth, bevel) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

const BODY = [[-2.05, 0.3], [2.0, 0.3], [2.15, 0.42], [2.05, 0.58], [1.0, 0.76], [-1.2, 0.8], [-2.0, 0.88], [-2.12, 0.6]];
const CABIN = [[-1.4, 0.8], [0.95, 0.78], [0.2, 1.17], [-0.75, 1.19]];
const WHEELS = [[0.9, 1.28], [-0.9, 1.28], [0.9, -1.28], [-0.9, -1.28]];

function carParts() {
  return {
    body: profile(BODY, 1.8, 0.08),
    cabin: profile(CABIN, 1.4, 0.07),
    tire: new THREE.CylinderGeometry(0.37, 0.37, 0.3, 20).rotateZ(Math.PI / 2),
    hub: new THREE.CylinderGeometry(0.21, 0.21, 0.32, 12).rotateZ(Math.PI / 2),
    wing: new THREE.BoxGeometry(1.75, 0.06, 0.36).translate(0, 1.08, -1.85),
    strutL: new THREE.BoxGeometry(0.07, 0.22, 0.12).translate(0.6, 0.97, -1.85),
    strutR: new THREE.BoxGeometry(0.07, 0.22, 0.12).translate(-0.6, 0.97, -1.85),
    headL: new THREE.BoxGeometry(0.42, 0.09, 0.1).translate(0.62, 0.56, 2.1),
    headR: new THREE.BoxGeometry(0.42, 0.09, 0.1).translate(-0.62, 0.56, 2.1),
    tailL: new THREE.BoxGeometry(0.55, 0.1, 0.08).translate(0.55, 0.72, -2.16),
    tailR: new THREE.BoxGeometry(0.55, 0.1, 0.08).translate(-0.55, 0.72, -2.16),
  };
}

// One merged low-cost geometry for the whole population (drawn with instancing).
export function swarmGeometry() {
  const p = carParts(), list = [];
  list.push(paint(p.body, 0xffffff), paint(p.cabin, 0x10151c));
  for (const [x, z] of WHEELS) {
    list.push(paint(p.tire.clone().translate(x, 0.37, z), 0x0c0c0e));
    list.push(paint(p.hub.clone().translate(x, 0.37, z), 0x8a8f98));
  }
  list.push(paint(p.wing, 0x15171b), paint(p.strutL, 0x15171b), paint(p.strutR, 0x15171b));
  list.push(paint(p.headL, 0xfff6cc), paint(p.headR, 0xfff6cc), paint(p.tailL, 0xff2a2a), paint(p.tailR, 0xff2a2a));
  return mergeGeometries(list);
}

// The detailed "hero" car: glossy paint, steering + spinning wheels, brake lights.
export function buildHero(color) {
  const p = carParts(), g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  const paintM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.06, metalness: 0.5, clearcoat: 1 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.9 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.25, metalness: 0.9 });
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 2 });
  const brake = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });
  add(p.body, paintM); add(p.cabin, glass);
  add(p.wing, carbon); add(p.strutL, carbon); add(p.strutR, carbon);
  add(p.headL, head); add(p.headR, head); add(p.tailL, brake); add(p.tailR, brake);
  const wheels = [];
  for (const [x, z] of WHEELS) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.set(x, 0.37, z);
    const t = new THREE.Mesh(p.tire, rubber); t.castShadow = true;
    spin.add(t, new THREE.Mesh(p.hub, alloy));
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.6, 0.07), alloy);
      spoke.rotation.x = (k * Math.PI) / 3;
      spin.add(spoke);
    }
    pivot.add(spin); g.add(pivot);
    wheels.push({ pivot, spin, front: z > 0 });
  }
  g.userData = { wheels, brake };
  return g;
}

export class World {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog(0xcfe6ff, 420, 2000);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 6000);
    this.camera.position.set(200, 150, 200);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 900;
    this.controls.enabled = false;

    this.buildSky();
    this.buildLights();
    this.trackGroup = new THREE.Group();
    scene.add(this.trackGroup);

    // population
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
    this.swarm = new THREE.InstancedMesh(swarmGeometry(), mat, MAX_CARS);
    this.swarm.castShadow = true;
    this.swarm.frustumCulled = false;
    this.swarm.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.swarm);

    this.hero = buildHero(0xff3b1f);
    this.humanCar = buildHero(0x1f8bff);
    this.humanCar.visible = false;
    scene.add(this.hero, this.humanCar);

    this.beacon = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    scene.add(this.beacon);

    // sensor rays
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_RAYS * 6), 3));
    rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_RAYS * 6), 3));
    this.rays = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, fog: false }));
    this.rays.frustumCulled = false;
    this.hits = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ fog: false }), MAX_RAYS);
    this.hits.frustumCulled = false;
    this.hits.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.rays, this.hits);

    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    this.camPos = new THREE.Vector3(200, 150, 200);
    this.camLook = new THREE.Vector3();
    this.camH = 0;
    this.mode = 'chase';
    this.t = 0;
  }

  buildSky() {
    const g = new THREE.SphereGeometry(3500, 32, 20);
    const top = new THREE.Color(0x2f7fe0), mid = new THREE.Color(0x8cc4ff), hor = new THREE.Color(0xe6f1ff);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 3500);
      if (t < 0.18) c.lerpColors(hor, mid, t / 0.18); else c.lerpColors(mid, top, Math.min(1, (t - 0.18) / 0.6));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

    const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6fae52, roughness: 1 }));
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // distant mountains
    const rnd = mulberry32(42), mm = new THREE.MeshStandardMaterial({ color: 0x6d86a8, roughness: 1, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rnd() * 0.2, d = 1000 + rnd() * 500, h = 160 + rnd() * 260;
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * (1 + rnd() * 0.6), h, 6 + ((rnd() * 3) | 0)), mm);
      m.position.set(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
      m.rotation.y = rnd() * 6;
      this.scene.add(m);
    }

    // clouds
    this.clouds = new THREE.Group();
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
    const sg = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 16; i++) {
      const cl = new THREE.Group(), a = rnd() * 6.28, d = 350 + rnd() * 900;
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(sg, cm), w = 30 + rnd() * 35;
        s.scale.set(w, w * 0.45, w * 0.7);
        s.position.set((k - 2) * 28 + rnd() * 10, rnd() * 8, rnd() * 20);
        cl.add(s);
      }
      cl.position.set(Math.cos(a) * d, 260 + rnd() * 140, Math.sin(a) * d);
      cl.rotation.y = rnd() * 6;
      this.clouds.add(cl);
    }
    this.scene.add(this.clouds);
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xdcebff, 0x5d7a45, 1.1));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 95, sc = sun.shadow.camera;
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 10; sc.far = 500;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, sun.target);
  }

  // ---- track ------------------------------------------------------------
  setTrack(T) {
    const G = this.trackGroup;
    G.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    G.clear();
    this.track = T;
    const N = T.n, hw = T.hw;

    const strip = (a, b, y, filter, colorFn) => {
      const pos = [], col = [], idx = [];
      let v = 0;
      for (let i = 0; i < N; i++) {
        if (filter && !filter(i)) continue;
        const j = (i + 1) % N;
        pos.push(T.cx[i] + T.nx[i] * a, y, T.cz[i] + T.nz[i] * a, T.cx[j] + T.nx[j] * a, y, T.cz[j] + T.nz[j] * a,
          T.cx[i] + T.nx[i] * b, y, T.cz[i] + T.nz[i] * b, T.cx[j] + T.nx[j] * b, y, T.cz[j] + T.nz[j] * b);
        if (colorFn) { const c = colorFn(i); for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b); }
        idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
        v += 4;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.receiveShadow = true; G.add(o); return o; };

    mesh(strip(-hw - 2.2, hw + 2.2, -0.02), new THREE.MeshStandardMaterial({ color: 0x8a7d5a, roughness: 1 })); // gravel verge
    mesh(strip(-hw, hw, 0), new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.85 }));
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    mesh(strip(hw - 0.55, hw - 0.3, 0.03), white);
    mesh(strip(-hw + 0.3, -hw + 0.55, 0.03), white);
    mesh(strip(-0.12, 0.12, 0.03, (i) => (i >> 1) % 2 === 0), white);
    const red = new THREE.Color(0xe23b2e), wht = new THREE.Color(0xf5f5f5);
    const curb = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const cf = (i) => ((i >> 1) % 2 ? red : wht);
    mesh(strip(hw, hw + 0.9, 0.05, null, cf), curb);
    mesh(strip(-hw - 0.9, -hw, 0.05, null, cf), curb);

    // chequered start line
    const blk = new THREE.Color(0x111111), cells = 8, cw = (hw * 2) / cells;
    for (let c = 0; c < cells; c++)
      mesh(strip(-hw + c * cw, -hw + (c + 1) * cw, 0.04, (i) => i < 2, (i) => ((i + c) % 2 ? blk : wht)), curb);

    // start gantry
    const gantry = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.5, metalness: 0.6 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), dark);
      post.position.set(s * (hw + 1.6), 4, 0); post.castShadow = true; gantry.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 4, 1.3, 0.6), new THREE.MeshStandardMaterial({ color: 0xff5a2c, roughness: 0.4 }));
    beam.position.y = 7.6; beam.castShadow = true; gantry.add(beam);
    gantry.position.set(T.cx[0], 0, T.cz[0]);
    gantry.rotation.y = Math.atan2(T.tx[0], T.tz[0]);
    G.add(gantry);

    // trees
    const tree = mergeGeometries([
      paint(new THREE.CylinderGeometry(0.25, 0.38, 1.8, 6).translate(0, 0.9, 0), 0x6b4a2e),
      paint(new THREE.ConeGeometry(1.9, 4.2, 7).translate(0, 3.6, 0), 0x2f7d3a),
      paint(new THREE.ConeGeometry(1.35, 3.2, 7).translate(0, 5.7, 0), 0x3c9447),
    ]);
    const rnd = mulberry32(T.seed + 99), spots = [];
    const lim = T.R + 140;
    for (let tries = 0; tries < 2500 && spots.length < 420; tries++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * lim, x = Math.cos(a) * d, z = Math.sin(a) * d;
      let ok = true;
      for (let i = 0; i < N; i += 2) {
        const ex = x - T.cx[i], ez = z - T.cz[i];
        if (ex * ex + ez * ez < (hw + 7) ** 2) { ok = false; break; }
      }
      if (ok) spots.push([x, z, 0.8 + rnd() * 1.3, rnd()]);
    }
    const trees = new THREE.InstancedMesh(tree, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), spots.length);
    spots.forEach(([x, z, s, h], i) => {
      this.dummy.position.set(x, 0, z); this.dummy.rotation.set(0, h * 6, 0); this.dummy.scale.setScalar(s); this.dummy.updateMatrix();
      trees.setMatrixAt(i, this.dummy.matrix);
      trees.setColorAt(i, this.col.setHSL(0.3, 0, 0.75 + h * 0.25));
    });
    trees.castShadow = true;
    G.add(trees);
    this.dummy.scale.setScalar(1);
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      const d = this.track.R * 1.25;
      this.camera.position.set(d, d * 0.75, d);
      this.controls.target.set(0, 0, 0);
    }
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  poseHero(hero, car, cfg, dt) {
    hero.position.set(car.x, 0, car.z);
    hero.rotation.set(0, car.h, (-car.steer * car.v) / cfg.maxSpeed * 0.07);
    for (const w of hero.userData.wheels) {
      if (w.front) w.pivot.rotation.y = car.steer * cfg.steerLock;
      w.spin.rotation.x += (car.v * dt) / 0.37;
    }
    hero.userData.brake.emissiveIntensity = car.thr < -0.05 ? 4 : 0.6;
  }

  // ---- per-frame --------------------------------------------------------
  render(sim, focus, view, dt, simDt) {
    const cfg = sim.cfg, d = this.dummy, col = this.col, cars = sim.cars;
    this.t += dt;
    const n = Math.min(cars.length, MAX_CARS);
    for (let i = 0; i < n; i++) {
      const c = cars[i];
      const hide = c === focus || (!c.alive && !c.finished && view.hideDead);
      d.position.set(c.x, hide ? -50 : 0, c.z);
      d.rotation.set(0, c.h, 0);
      d.scale.setScalar(hide ? 0.0001 : 1);
      d.updateMatrix();
      this.swarm.setMatrixAt(i, d.matrix);
      if (c.finished) col.setHex(0xffc933);
      else if (!c.alive) col.setHex(0x4a4d55);
      else col.setHSL((i * 0.618034) % 1, 0.62, 0.56);
      this.swarm.setColorAt(i, col);
    }
    this.swarm.count = n;
    this.swarm.instanceMatrix.needsUpdate = true;
    this.swarm.instanceColor.needsUpdate = true;

    if (focus) {
      this.poseHero(this.hero, focus, cfg, simDt);
      this.beacon.visible = !sim.human;
      this.beacon.position.set(focus.x, 3.4 + Math.sin(this.t * 4) * 0.25, focus.z);
      this.beacon.rotation.y = this.t * 2;
    }
    const human = sim.human;
    this.humanCar.visible = !!human;
    if (human) this.poseHero(this.humanCar, human, cfg, dt);

    // sensor rays of the car we are watching
    const rc = human || focus, showRays = view.showSensors && rc && (human || rc.alive);
    this.rays.visible = this.hits.visible = !!showRays;
    if (showRays) {
      const P = this.rays.geometry.attributes.position, C = this.rays.geometry.attributes.color;
      const nr = Math.min(rc.rays.length, MAX_RAYS);
      for (let k = 0; k < nr; k++) {
        const a = rc.h + sensorAngle(cfg, k, rc.rays.length), dist = rc.rays[k];
        const ex = rc.x + Math.sin(a) * dist, ez = rc.z + Math.cos(a) * dist;
        P.setXYZ(k * 2, rc.x, 0.7, rc.z); P.setXYZ(k * 2 + 1, ex, 0.7, ez);
        col.setHSL(0.36 * Math.min(1, dist / cfg.sensorRange), 0.95, 0.55);
        C.setXYZ(k * 2, col.r, col.g, col.b); C.setXYZ(k * 2 + 1, col.r, col.g, col.b);
        d.position.set(ex, 0.7, ez); d.rotation.set(0, 0, 0); d.scale.setScalar(dist < cfg.sensorRange - 0.01 ? 1 : 0.0001); d.updateMatrix();
        this.hits.setMatrixAt(k, d.matrix); this.hits.setColorAt(k, col);
      }
      d.scale.setScalar(1);
      this.rays.geometry.setDrawRange(0, nr * 2);
      this.hits.count = nr;
      P.needsUpdate = C.needsUpdate = true;
      this.hits.instanceMatrix.needsUpdate = true;
      this.hits.instanceColor.needsUpdate = true;
    }

    this.clouds.rotation.y += dt * 0.004;
    this.updateCamera(human || focus, dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(car, dt) {
    const cam = this.camera, k = 1 - Math.exp(-dt * 5);
    const fx = car ? car.x : 0, fz = car ? car.z : 0;
    if (this.mode === 'orbit') {
      this.controls.update();
    } else if (this.mode === 'top') {
      const h = (this.track.R * 1.12) / Math.tan((cam.fov * Math.PI) / 360) / Math.min(1, cam.aspect * 0.8);
      this.camPos.lerp(new THREE.Vector3(0, h, 0.01), k);
      cam.position.copy(this.camPos);
      cam.up.set(0, 0, -1);
      cam.lookAt(0, 0, 0);
      cam.up.set(0, 1, 0);
    } else if (car) {
      let dh = car.h - this.camH;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const hood = this.mode === 'hood';
      this.camH += dh * (hood ? 1 - Math.exp(-dt * 14) : k);
      const sx = Math.sin(this.camH), sz = Math.cos(this.camH);
      const want = hood ? new THREE.Vector3(fx - sx * 0.2, 1.45, fz - sz * 0.2) : new THREE.Vector3(fx - sx * 11.5, 5.2, fz - sz * 11.5);
      const look = hood ? new THREE.Vector3(fx + sx * 20, 1.0, fz + sz * 20) : new THREE.Vector3(fx + sx * 5, 1.2, fz + sz * 5);
      const far = this.camPos.distanceTo(want) > 150; // leader jumped (new generation): snap closer fast
      this.camPos.lerp(want, hood ? 1 - Math.exp(-dt * 20) : far ? 1 - Math.exp(-dt * 12) : k);
      this.camLook.lerp(look, hood ? 1 : 1 - Math.exp(-dt * 8));
      cam.position.copy(this.camPos);
      cam.lookAt(this.camLook);
    }
    if (this.mode !== 'chase' && this.mode !== 'hood') this.camPos.copy(cam.position);
    this.hero.visible = !(this.mode === 'hood' && !this.humanCar.visible);
    if (this.mode === 'hood' && this.humanCar.visible) this.humanCar.visible = false;
    this.sun.position.set(fx + 70, 120, fz + 45);
    this.sun.target.position.set(fx, 0, fz);
  }
}
