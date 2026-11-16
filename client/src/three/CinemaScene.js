import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { eyePoint, tierOf } from './hallLayout.js';

/**
 * The 3D auditorium. Framework-agnostic: give it a DOM node and a hall (from buildHall)
 * and it handles rendering, camera flights, hover/click picking and "view from seat" snapshots.
 *
 * Modes:  overview (whole hall from above) -> block (fly into a block, pick seats) -> pov (sit in the seat)
 */

// Same colour language as a stadium map: red seats, blue = taken, orange = yours, white = the block you are in
const COLORS = {
  sold: new THREE.Color('#2f6fed'),
  selected: new THREE.Color('#ff8a00'),
  preview: new THREE.Color('#ffe14d'),
  hover: new THREE.Color('#ff9a2e'),
  white: new THREE.Color('#ffffff'),
};

/** Small seeded random generator so the park looks the same on every visit. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PEOPLE = ['#2a2d3a', '#3b2f3a', '#243442', '#40372c', '#2f3a31', '#3a2a2a'].map((c) => new THREE.Color(c));
const MAX_MARKERS = 12;
const BASE_FOV = 45;
const POV_FOV = 64;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** One box-ish part of a seat: rounded, positioned, with a baked brightness so cushions and frames differ. */
function part(w, h, d, x, y, z, shade = 1, rotX = 0, radius = 0.05) {
  let g = new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 2.01, h / 2.01, d / 2.01));
  if (g.index) g = g.toNonIndexed();
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(shade), 3));
  return g;
}

// Seats face -z (towards the screen); the origin is on the floor under the middle of the seat.
function seatGeometry(kind, w) {
  if (kind === 'recliner') {
    return mergeGeometries([
      part(w * 0.88, 0.3, 0.86, 0, 0.15, 0.06, 0.28),
      part(w * 0.7, 0.18, 0.62, 0, 0.42, -0.02, 1, 0, 0.08),
      part(w * 0.68, 0.1, 0.42, 0, 0.4, -0.56, 0.92, -0.2, 0.05),
      part(w * 0.7, 0.86, 0.17, 0, 0.84, 0.44, 0.95, 0.36, 0.08),
      part(w * 0.46, 0.2, 0.13, 0, 1.2, 0.56, 1, 0.36, 0.06),
      part(0.14, 0.36, 0.8, -w * 0.43, 0.5, 0.04, 0.45, 0, 0.06),
      part(0.14, 0.36, 0.8, w * 0.43, 0.5, 0.04, 0.45, 0, 0.06),
    ]);
  }
  if (kind === 'sofa') {
    return mergeGeometries([
      part(w * 0.96, 0.3, 0.95, 0, 0.15, 0.06, 0.28),
      part(w * 0.39, 0.2, 0.7, -w * 0.2, 0.43, -0.04, 1, 0, 0.09),
      part(w * 0.39, 0.2, 0.7, w * 0.2, 0.43, -0.04, 1, 0, 0.09),
      part(w * 0.8, 0.74, 0.2, 0, 0.8, 0.44, 0.95, 0.24, 0.09),
      part(w * 0.3, 0.26, 0.12, -w * 0.2, 0.74, 0.3, 0.8, 0.3, 0.06),
      part(w * 0.3, 0.26, 0.12, w * 0.2, 0.74, 0.3, 0.8, 0.3, 0.06),
      part(0.17, 0.44, 0.92, -w * 0.45, 0.5, 0.04, 0.6, 0, 0.08),
      part(0.17, 0.44, 0.92, w * 0.45, 0.5, 0.04, 0.6, 0, 0.08),
    ]);
  }
  return mergeGeometries([
    part(w * 0.5, 0.34, 0.3, 0, 0.17, 0.06, 0.22),
    part(w * 0.84, 0.13, 0.48, 0, 0.42, -0.05, 1),
    part(w * 0.84, 0.66, 0.11, 0, 0.78, 0.25, 0.9, 0.14),
    part(0.07, 0.22, 0.46, -w * 0.47, 0.52, -0.03, 0.3, 0, 0.03),
    part(0.07, 0.22, 0.46, w * 0.47, 0.52, -0.03, 0.3, 0, 0.03),
  ]);
}

function personGeometry() {
  let head = new THREE.SphereGeometry(0.125, 12, 9);
  head = head.toNonIndexed();
  head.translate(0, 1.2, 0.1);
  head.setAttribute('color', new THREE.BufferAttribute(new Float32Array(head.attributes.position.count * 3).fill(1.5), 3));
  return mergeGeometries([head, part(0.42, 0.52, 0.22, 0, 0.82, 0.13, 1, 0.1, 0.1)]);
}

function textTexture(text, { size = 64, color = '#ffffff', bg = null, font = '700 40px Inter, system-ui, sans-serif', w = size, h = size } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CinemaScene {
  constructor(container, { hall, movie = {}, onSeatClick, onBlockClick, onModeChange, formatPrice = (n) => `₹${n}` }) {
    this.container = container;
    this.hall = hall;
    this.movie = movie;
    this.cb = { onSeatClick, onBlockClick, onModeChange };
    this.formatPrice = formatPrice;

    this.mode = 'overview';
    this.activeBlock = null;
    this.hoverBlock = null;
    this.hoverSeat = null;
    this.unavailable = new Set();
    this.selected = [];
    this.preview = [];
    this.povSeats = [];
    this.az = 0;
    this.zoom = 1;
    this.lightLevel = 1;
    this.lightTarget = 1;
    this.lightOverride = null;
    this.pointer = { x: 0, y: 0, inside: false, dirty: false, down: null, dragged: false };
    this.flight = null;
    this.disposed = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.perf = { frames: 0, time: 0 };
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';
    container.appendChild(this.canvas);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'stage-tooltip';
    container.appendChild(this.tooltip);
    this.tooltipAnchor = null;

    this.scene = new THREE.Scene();
    this.bgHouse = new THREE.Color('#a9c78c'); // daylight haze over the park
    this.bgMovie = new THREE.Color('#030306');
    this.scene.background = this.bgHouse.clone();
    this.scene.fog = new THREE.Fog(this.scene.background, hall.radius * 5, hall.radius * 13);

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 400);
    this.snapCamera = new THREE.PerspectiveCamera(POV_FOV, 16 / 9, 0.1, 400);
    this.pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.buildLights();
    this.buildExterior();
    this.buildHallShell();
    this.buildScreen();
    this.buildSeats();
    this.buildBlocks();
    this.buildMarkers();
    this.buildRowLabels();

    this.resize();
    const start = this.goalPose();
    // Start a little further out and glide in - a small "establishing shot"
    this.pose.pos.copy(start.pos).add(new THREE.Vector3(hall.radius * 0.5, hall.radius * 1.5, hall.radius * 1.1));
    this.pose.target.copy(start.target);
    this.flight = { from: { pos: this.pose.pos.clone(), target: this.pose.target.clone() }, t: 0, dur: 2.6 };

    this.bind();
    this.paint();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ------------------------------------------------------------------ build */

  buildLights() {
    const { hall } = this;
    const R = hall.radius;
    this.hemi = new THREE.HemisphereLight('#eef5ff', '#55663f', 1.4);
    // Afternoon sun from behind-left: lights the seat backs and throws the wall's shadow across the stalls
    this.sun = new THREE.DirectionalLight('#fff0d6', 1.6);
    this.sun.position.set(-R * 1.5, R * 2.6, hall.zBack / 2 + R * 1.3);
    this.sun.target.position.set(0, 0, hall.zBack / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -R * 3; sc.right = R * 3; sc.top = R * 3; sc.bottom = -R * 3;
    sc.near = 1; sc.far = R * 8;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#9fb4ff', 0.5);
    this.fill.position.set(hall.halfW, hall.wallH, -4);
    // Light spilling off the screen onto the audience
    this.screenLight = new THREE.SpotLight('#bcd0ff', 0, 0, 1.25, 1, 1.1);
    this.screenLight.position.set(0, hall.screen.cy, 0.6);
    this.screenLight.target.position.set(0, hall.topY * 0.5, hall.zBack * 0.6);
    this.scene.add(this.hemi, this.sun, this.fill, this.screenLight, this.screenLight.target);
  }

  /**
   * Everything outside the auditorium: lawn, paths, trees and the cinema building itself.
   * This is the aerial "you have arrived" shot - the roof is off so you can see straight into the hall.
   */
  buildExterior() {
    const { hall } = this;
    const R = hall.radius;
    const W = hall.halfW;
    const cz = hall.zBack / 2;
    const rand = seeded(24);
    const g = new THREE.Group();
    const ground = -0.3;

    // Mown lawn
    const lc = document.createElement('canvas');
    lc.width = lc.height = 256;
    const lx = lc.getContext('2d');
    for (let i = 0; i < 8; i++) {
      lx.fillStyle = i % 2 ? '#6fa550' : '#679c49';
      lx.fillRect(i * 32, 0, 32, 256);
    }
    for (let i = 0; i < 2600; i++) {
      lx.fillStyle = `rgba(${rand() > 0.5 ? '40,80,20' : '170,210,120'},${0.05 + rand() * 0.08})`;
      lx.fillRect(rand() * 256, rand() * 256, 1.5 + rand() * 2, 1.5 + rand() * 2);
    }
    const lawnTex = new THREE.CanvasTexture(lc);
    lawnTex.colorSpace = THREE.SRGBColorSpace;
    lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping;
    lawnTex.repeat.set(R * 1.1, R * 1.1);
    lawnTex.anisotropy = 4;
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(R * 26, R * 26), new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, ground, cz);
    lawn.receiveShadow = true;
    g.add(lawn);

    // Paved plaza, a ring walk and paths out into the park
    const paving = new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.95 });
    const lobbyDepth = 7.5;
    const plazaW = W * 2 + 11;
    const plazaD = hall.zBack + lobbyDepth + 13;
    const plazaZ = (hall.zBack + lobbyDepth) / 2;
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(plazaW, 0.1, plazaD), paving);
    plaza.position.set(0, ground + 0.04, plazaZ);
    plaza.receiveShadow = true;
    g.add(plaza);
    const ringR = R * 2.05;
    const ring = new THREE.Mesh(new THREE.RingGeometry(ringR - 0.6, ringR + 0.6, 96), paving);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, ground + 0.03, cz);
    ring.receiveShadow = true;
    g.add(ring);
    const spokes = [0.35, 1.25, 2.2, 3.5, 4.4, 5.5];
    for (const a of spokes) {
      const len = R * 4.2;
      const path = new THREE.Mesh(new THREE.PlaneGeometry(1.3, len), paving);
      path.rotation.x = -Math.PI / 2;
      path.rotation.z = -a + Math.PI / 2;
      path.position.set(Math.cos(a) * (len / 2 + R * 0.4), ground + 0.02, cz + Math.sin(a) * (len / 2 + R * 0.4));
      path.receiveShadow = true;
      g.add(path);
    }

    // The building: pale outer walls around the hall, with the foyer block behind it
    const shell = new THREE.MeshStandardMaterial({ color: '#efebe2', roughness: 0.85 });
    const t = 0.8;
    const H = hall.wallH + 0.45;
    const backH = hall.topY + 1.1;
    const outerW = W * 2 + 0.6 + t * 2;
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(t, H, hall.zBack + 1.5 + t), shell, sx * (W + 0.3 + t / 2), H / 2 + ground, (hall.zBack - 1.2 - t) / 2 + 0.15);
    add(new THREE.BoxGeometry(outerW, H, t), shell, 0, H / 2 + ground, -1.2 - t / 2);
    const foyerH = Math.max(3, backH - 0.6);
    const foyerZ = hall.zBack + 0.3 + lobbyDepth / 2;
    add(new THREE.BoxGeometry(outerW, foyerH, lobbyDepth), shell, 0, foyerH / 2 + ground, foyerZ);
    const roof = add(new THREE.BoxGeometry(outerW - 0.7, 0.12, lobbyDepth - 0.7), new THREE.MeshStandardMaterial({ color: '#8f8b86', roughness: 1 }), 0, foyerH + ground + 0.06, foyerZ);
    roof.castShadow = false;
    // rooftop plant + a red entrance canopy
    const metal = new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.5, metalness: 0.4 });
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(1.5, 0.7, 1.1), metal, -outerW / 2 + 2 + i * 2.1, foyerH + ground + 0.47, foyerZ + lobbyDepth / 2 - 1.3);
    add(new THREE.BoxGeometry(outerW * 0.5, 0.25, 2.4), new THREE.MeshStandardMaterial({ color: '#f84464', roughness: 0.6 }), 0, foyerH * 0.62 + ground, foyerZ + lobbyDepth / 2 + 1.2);

    // Name on the roof, readable from the air
    const sign = textTexture(`CINEVERSE${hall.features?.label ? `  ·  ${hall.features.label}` : ''}`, { w: 1024, h: 128, color: '#ffffff', font: '800 76px Inter, system-ui, sans-serif' });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(outerW * 0.8, 15), Math.min(outerW * 0.8, 15) / 8), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
    signMesh.rotation.x = -Math.PI / 2;
    signMesh.position.set(0, foyerH + ground + 0.14, foyerZ - 0.9);
    g.add(signMesh);

    // Trees scattered through the park, keeping clear of the building and the paths
    const count = 170;
    const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 6), new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 1 }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 4000) {
      const a = rand() * Math.PI * 2;
      const r = R * (1.35 + rand() ** 1.4 * 4.4);
      const x = Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (Math.abs(x) < plazaW / 2 + 1.5 && Math.abs(z - plazaZ) < plazaD / 2 + 1.5) continue;
      if (Math.abs(r - ringR) < 1.8) continue;
      if (spokes.some((sa) => { const d = Math.abs(((a - sa + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return d * r < 1.8; })) continue;
      const s = 1 + rand() * 1.5;
      q.setFromEuler(new THREE.Euler(0, rand() * 6.28, 0));
      m.compose(new THREE.Vector3(x, ground + s * 1.9, z), q, new THREE.Vector3(s, s * (1.05 + rand() * 0.4), s));
      canopy.setMatrixAt(placed, m);
      canopy.setColorAt(placed, col.setHSL(0.27 + rand() * 0.09, 0.42 + rand() * 0.2, 0.2 + rand() * 0.14));
      m.compose(new THREE.Vector3(x, ground + s * 0.5, z), q, new THREE.Vector3(s, s, s));
      trunk.setMatrixAt(placed, m);
      placed++;
    }
    canopy.count = placed;
    trunk.count = placed;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    trunk.castShadow = true;
    g.add(canopy, trunk);

    this.scene.add(g);
  }

  buildHallShell() {
    const { hall } = this;
    const W = hall.halfW;
    const group = new THREE.Group();
    const carpet = new THREE.MeshStandardMaterial({ color: '#2b2740', roughness: 1 });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#211e33', roughness: 0.95 });
    const panelMat = new THREE.MeshStandardMaterial({ color: '#34304f', roughness: 0.9 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.2, hall.zBack + 1.2), new THREE.MeshStandardMaterial({ color: '#1d1a2c', roughness: 1 }));
    floor.position.set(0, -0.1, (hall.zBack - 1.2) / 2);
    floor.receiveShadow = true;
    group.add(floor);

    // Stepped risers, one per row (stadium seating)
    for (const r of hall.rows) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(W * 2, r.y, r.depth), carpet);
      riser.position.set(0, r.y / 2, r.z);
      riser.receiveShadow = true;
      group.add(riser);
    }
    const last = hall.rows[hall.rows.length - 1];
    const backDepth = hall.zBack - (last.z + last.depth / 2);
    const landing = new THREE.Mesh(new THREE.BoxGeometry(W * 2, last.y, backDepth), carpet);
    landing.position.set(0, last.y / 2, hall.zBack - backDepth / 2);
    group.add(landing);

    // Walls (no ceiling: we look in from above like a doll's house)
    const sideGeo = new THREE.BoxGeometry(0.3, hall.wallH, hall.zBack + 1.2);
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(sideGeo, wallMat);
      wall.position.set(sx * (W + 0.15), hall.wallH / 2, (hall.zBack - 1.2) / 2);
      wall.castShadow = true;
      group.add(wall);
    }
    // The back wall is cut down to a parapet so the camera can look in from behind the last row
    const backH = hall.topY + 1.1;
    const back = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.6, backH, 0.3), wallMat);
    back.position.set(0, backH / 2, hall.zBack + 0.15);
    const front = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.6, hall.wallH, 0.3), wallMat);
    front.position.set(0, hall.wallH / 2, -1.05);
    front.castShadow = true;
    group.add(back, front);

    // Acoustic panels + warm sconces down both side walls
    const panelCount = Math.floor(hall.zBack / 2.4);
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, hall.wallH * 0.62, 1.7), panelMat, panelCount * 2);
    const sconces = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.16),
      new THREE.MeshBasicMaterial({ color: '#ffbf7a', toneMapped: false }),
      panelCount * 2,
    );
    const m = new THREE.Matrix4();
    let i = 0;
    for (let p = 0; p < panelCount; p++) {
      const z = 1.6 + p * 2.4;
      for (const sx of [-1, 1]) {
        m.makeTranslation(sx * (W - 0.05), hall.wallH * 0.52, z);
        panels.setMatrixAt(i, m);
        m.makeTranslation(sx * (W - 0.08), hall.wallH * 0.52 + 0.4, z + 1.2);
        sconces.setMatrixAt(i, m);
        i++;
      }
    }
    group.add(panels, sconces);
    this.sconces = sconces;

    // LED step lights along every aisle
    const spots = [];
    for (const r of hall.rows) {
      const xs = [...r.aisleXs, -(r.halfWidth + 0.55), r.halfWidth + 0.55];
      for (const x of xs) spots.push([x, r.y + 0.02, r.z - r.depth / 2 + 0.04]);
    }
    const leds = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.55, 0.03, 0.05),
      new THREE.MeshBasicMaterial({ color: '#ffc978', toneMapped: false }),
      spots.length,
    );
    spots.forEach((s, k) => { m.makeTranslation(s[0], s[1], s[2]); leds.setMatrixAt(k, m); });
    group.add(leds);

    // Exit signs
    const exitTex = textTexture('EXIT', { w: 128, h: 48, bg: '#0c6b3a', color: '#d8ffe9', font: '700 30px Inter, system-ui, sans-serif' });
    const exitMat = new THREE.MeshBasicMaterial({ map: exitTex, toneMapped: false });
    for (const sx of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), exitMat);
      sign.position.set(sx * (W - 0.02), 3.1, 3.2);
      sign.rotation.y = -sx * Math.PI / 2;
      group.add(sign);
    }

    // Projector beam (only visible when the house lights are down)
    const projector = new THREE.Vector3(0, hall.topY + 2.0, hall.zBack - 0.2);
    const screenCentre = new THREE.Vector3(0, hall.screen.cy, 0.1);
    const len = projector.distanceTo(screenCentre);
    const cone = new THREE.ConeGeometry(1, len, 32, 1, true);
    cone.translate(0, -len / 2, 0);
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 4; beamCanvas.height = 128;
    const bctx = beamCanvas.getContext('2d');
    const bg = bctx.createLinearGradient(0, 0, 0, 128); // v = 1 (top of canvas) is the projector end
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(0.12, 'rgba(255,255,255,1)');
    bg.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, 4, 128);
    this.beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({
      color: '#cfe0ff', map: new THREE.CanvasTexture(beamCanvas), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.beam.position.copy(projector);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), screenCentre.clone().sub(projector).normalize());
    this.beam.scale.set(hall.screen.w / 2, 1, hall.screen.h / 2);
    const metal = new THREE.MeshStandardMaterial({ color: '#2c2a3a', roughness: 0.4, metalness: 0.4 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.8), metal);
    box.position.copy(projector).add(new THREE.Vector3(0, 0, 0.3));
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1.5, projector.y - 0.22 - backH, 0.5), wallMat); // projection booth
    pole.position.set(0, (projector.y - 0.22 + backH) / 2, hall.zBack + 0.05);
    group.add(this.beam, box, pole);

    this.scene.add(group);
  }

  buildScreen() {
    const { hall } = this;
    const { w, h, cy } = hall.screen;
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1024;
    this.screenCanvas.height = Math.round(1024 / (w / h));
    this.screenCtx = this.screenCanvas.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTime = 0;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.2), new THREE.MeshStandardMaterial({ color: '#050507', roughness: 0.6 }));
    frame.position.set(0, cy, -0.75);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    screen.position.set(0, cy, -0.62);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, 1.6), new THREE.MeshStandardMaterial({ color: '#0e0d15', roughness: 0.9 }));
    stage.position.set(0, 0.25, -0.1);
    this.scene.add(frame, screen, stage);

    // ScreenX wraps the film onto the side walls; ICE lines them with LED panels that follow its colours
    const f = hall.features || {};
    this.sidePanels = [];
    if (f.screenX || f.ice) {
      const len = Math.min(hall.zBack * 0.66, w);
      for (const sx of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(len, h * (f.ice ? 0.8 : 1), f.ice ? 12 : 1, 1);
        let mat;
        if (f.screenX) {
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) {
            const u = uv.getX(i); // the end next to the screen continues the picture's edge, mirrored
            uv.setX(i, sx < 0 ? 0.3 * (1 - u) : 1 - 0.3 * u);
          }
          mat = new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false, transparent: true, opacity: 0.4 });
        } else {
          mat = new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        }
        const panel = new THREE.Mesh(geo, mat);
        panel.position.set(sx * (hall.halfW - 0.13), cy, 0.7 + len / 2);
        panel.rotation.y = -sx * Math.PI / 2;
        this.sidePanels.push(panel);
        this.scene.add(panel);
      }
    }

    if (this.movie.posterUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // without CORS the image simply fails to load and we keep the title card
      img.onload = () => { this.poster = img; };
      img.src = this.movie.posterUrl;
    }
    this.drawScreen(0);
  }

  /** The "film" on the screen: an animated title card with the poster. */
  drawScreen(t) {
    const ctx = this.screenCtx;
    const { width: W, height: H } = this.screenCanvas;
    const g = ctx.createLinearGradient(0, 0, W, H);
    const hue = (t * 8) % 360;
    g.addColorStop(0, `hsl(${(hue + 230) % 360} 70% 16%)`);
    g.addColorStop(0.5, `hsl(${(hue + 320) % 360} 65% 22%)`);
    g.addColorStop(1, `hsl(${(hue + 20) % 360} 75% 18%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // drifting bokeh
    for (let i = 0; i < 9; i++) {
      const x = ((i * 137 + t * (12 + i * 3)) % (W + 200)) - 100;
      const y = H * (0.2 + 0.6 * ((i * 0.37) % 1)) + Math.sin(t * 0.6 + i) * 18;
      const r = 40 + (i % 4) * 26;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.16)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    let textX = W / 2;
    ctx.textAlign = 'center';
    if (this.poster) {
      const ph = H * 0.78;
      const pw = ph * (this.poster.width / this.poster.height);
      const px = W * 0.08;
      const py = (H - ph) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30;
      ctx.drawImage(this.poster, px, py, pw, ph);
      ctx.restore();
      textX = px + pw + (W - px - pw) / 2;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText('N O W   S H O W I N G', textX, H * 0.3);
    const title = this.movie.title || 'CineVerse';
    let size = 84;
    ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
    const maxW = this.poster ? W * 0.55 : W * 0.85;
    while (ctx.measureText(title).width > maxW && size > 30) { size -= 4; ctx.font = `800 ${size}px Inter, system-ui, sans-serif`; }
    const f = this.hall.features || {};
    if (f.threeD) { // red/cyan fringes: the picture you see without the glasses on
      ctx.fillStyle = 'rgba(255, 50, 50, 0.85)'; ctx.fillText(title, textX - 6, H * 0.52);
      ctx.fillStyle = 'rgba(40, 230, 255, 0.85)'; ctx.fillText(title, textX + 6, H * 0.52);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, textX, H * 0.52);
    ctx.fillStyle = '#ff6b81';
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillText(f.label ? `▶ CineVerse  ·  ${f.label}` : '▶ CineVerse', textX, H * 0.72);
    if (this.sidePanels?.length && f.ice) {
      for (const p of this.sidePanels) p.material.color.setHSL(((hue + 300) % 360) / 360, 0.8, 0.55);
    }

    // letterbox bars + light sweep
    const sweep = ((t * 0.12) % 1.6) * W - W * 0.3;
    const sg = ctx.createLinearGradient(sweep - 120, 0, sweep + 120, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    this.screenTex.needsUpdate = true;
  }

  buildSeats() {
    const { hall } = this;
    this.seatMeshes = [];
    const byGeo = new Map(); // one instanced mesh per seat shape/width
    for (const s of hall.seats) {
      const key = `${s.kind}:${s.w}`;
      if (!byGeo.has(key)) byGeo.set(key, []);
      byGeo.get(key).push(s);
    }
    const m = new THREE.Matrix4();
    for (const [key, list] of byGeo) {
      const [kind] = key.split(':');
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'std' ? 0.8 : 0.42, metalness: kind === 'std' ? 0 : 0.08 });
      const mesh = new THREE.InstancedMesh(seatGeometry(kind, list[0].w), mat, list.length);
      list.forEach((s, i) => {
        m.makeTranslation(s.x, s.y, s.z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, COLORS.white);
        s.mesh = mesh;
        s.index = i;
        mesh.receiveShadow = true;
        s.base = new THREE.Color(tierOf(s.category).color);
      });
      mesh.userData.seats = list;
      mesh.instanceMatrix.needsUpdate = true;
      this.seatMeshes.push(mesh);
      this.scene.add(mesh);
    }

    // The audience: a silhouette appears in every seat that is already taken
    this.people = new THREE.InstancedMesh(
      personGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      hall.seats.length,
    );
    this.people.count = 0;
    this.people.frustumCulled = false;
    this.scene.add(this.people);
  }

  buildBlocks() {
    this.blockMeshes = [];
    for (const b of this.hall.blocks.values()) {
      const geo = new THREE.BoxGeometry(b.width + 0.35, b.height + 0.25, b.depth + 0.2);
      const color = COLORS.hover.clone();
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.position.set(b.center.x, b.center.y + 0.1, b.center.z);
      mesh.userData.block = b;
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: color.clone().lerp(COLORS.white, 0.5), transparent: true, opacity: 0 }));
      mesh.add(outline);
      mesh.userData.outline = outline;
      this.blockMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  buildMarkers() {
    const pinGeo = new THREE.OctahedronGeometry(0.16);
    const haloGeo = new THREE.BoxGeometry(1, 1, 1);
    this.markers = [];
    for (let i = 0; i < MAX_MARKERS * 2; i++) {
      const isPreview = i >= MAX_MARKERS;
      const color = isPreview ? COLORS.preview : COLORS.selected;
      const pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
      const g = new THREE.Group();
      g.add(pin, halo);
      g.visible = false;
      g.userData = { pin, halo, isPreview };
      this.markers.push(g);
      this.scene.add(g);
    }
  }

  buildRowLabels() {
    this.rowLabels = new THREE.Group();
    const cache = new Map();
    for (const r of this.hall.rows) {
      if (!cache.has(r.row)) cache.set(r.row, textTexture(r.row));
      for (const sx of [-1, 1]) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cache.get(r.row), transparent: true, opacity: 0, depthWrite: false }));
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(sx * (r.halfWidth + 0.45), r.y + 0.75, r.z);
        this.rowLabels.add(sprite);
      }
    }
    this.scene.add(this.rowLabels);
  }

  /* ------------------------------------------------------------------ state */

  setUnavailable(ids) {
    this.unavailable = new Set(ids);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const s of this.hall.seats) {
      if (!this.unavailable.has(s.id)) continue;
      const lean = s.kind === 'std' ? 0 : 0.16;
      m.makeTranslation(s.x, s.y - 0.02, s.z + lean);
      this.people.setMatrixAt(n, m);
      this.people.setColorAt(n, PEOPLE[hash(s.id) % PEOPLE.length]);
      n++;
    }
    this.people.count = n;
    this.people.instanceMatrix.needsUpdate = true;
    if (this.people.instanceColor) this.people.instanceColor.needsUpdate = true;
    this.paint();
  }

  setSelected(ids) { this.selected = [...ids]; this.placeMarkers(); this.paint(); }

  /** Gold "what if" seats shown while the upgrade side of the ticket is open. */
  setPreview(ids) { this.preview = [...ids]; this.placeMarkers(); this.paint(); }

  placeMarkers() {
    const place = (ids, offset) => {
      for (let i = 0; i < MAX_MARKERS; i++) {
        const g = this.markers[offset + i];
        const s = this.hall.seatById.get(ids[i]);
        g.visible = Boolean(s);
        if (!s) continue;
        g.position.set(s.x, s.y, s.z);
        g.userData.halo.scale.set(s.w + 0.1, 1.25, s.depth * 0.85);
        g.userData.halo.position.set(0, 0.62, 0.05);
        g.userData.pinBase = s.kind === 'std' ? 1.7 : 1.95;
      }
    };
    place(this.selected, 0);
    place(this.preview, MAX_MARKERS);
  }

  /** Recolour every seat from the current state. ~300 seats, so just redo them all. */
  paint() {
    const c = new THREE.Color();
    const focus = this.mode === 'overview' ? this.hoverBlock : this.activeBlock;
    for (const s of this.hall.seats) {
      if (this.unavailable.has(s.id)) c.copy(COLORS.sold);
      else if (this.selected.includes(s.id)) c.copy(COLORS.selected);
      else if (this.preview.includes(s.id)) c.copy(COLORS.preview);
      else {
        c.copy(s.base);
        if (focus && s.blockId === focus) {
          // hovered stand glows orange from the air; once you are in it, its free seats turn white
          if (this.mode === 'overview') c.lerp(COLORS.hover, 0.85); else c.lerp(COLORS.white, 0.82);
        }
        if (this.hoverSeat === s.id) c.lerp(COLORS.hover, 0.7);
      }
      s.mesh.setColorAt(s.index, c);
    }
    for (const mesh of this.seatMeshes) mesh.instanceColor.needsUpdate = true;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.az = 0;
    this.zoom = 1;
    this.hoverSeat = null;
    this.hoverBlock = null;
    this.hideTooltip();
    this.lightTarget = mode === 'pov' ? 0 : 1;
    this.canvas.style.cursor = '';
    this.cb.onModeChange?.(mode, this.activeBlock);
  }

  startFlight(dur = 1.5) {
    this.flight = { from: { pos: this.pose.pos.clone(), target: this.pose.target.clone() }, t: 0, dur };
  }

  flyToOverview() {
    this.activeBlock = null;
    this.setMode('overview');
    this.startFlight(1.5);
    this.paint();
  }

  flyToBlock(blockId) {
    if (!this.hall.blocks.has(blockId)) return;
    const changed = this.activeBlock !== blockId;
    this.activeBlock = blockId;
    if (this.mode !== 'block') this.setMode('block');
    else if (changed) { this.az = 0; this.zoom = 1; this.cb.onModeChange?.('block', blockId); }
    this.startFlight(1.5);
    this.paint();
  }

  /** Sit down: first-person view of the screen from these seats. */
  flyToSeats(ids) {
    const first = this.hall.seatById.get(ids[0]);
    if (!first) return;
    this.povSeats = [...ids];
    this.activeBlock = first.blockId;
    this.setMode('pov');
    this.startFlight(1.9);
    this.paint();
  }

  /** Pixels of UI covering the right edge (the ticket); the picture slides left to stay centred. */
  setRightInset(px) { this.insetTarget = px; }

  /** null = automatic (bright while choosing, dark when seated); true/false = forced by the user. */
  setHouseLights(on) { this.lightOverride = on; }

  /* ------------------------------------------------------------------ camera */

  goalPose() {
    const { hall } = this;
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    const px = this.pointer.inside ? this.pointer.x : 0;
    const py = this.pointer.inside ? this.pointer.y : 0;
    // Fit maths always uses the base lens and only the part of the picture not covered by the ticket
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const vfov = (BASE_FOV * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * ((w - (this.insetTarget || 0)) / h));

    if (this.mode === 'pov') {
      const eye = eyePoint(hall, this.povSeats) || { x: 0, y: 2, z: hall.zBack / 2 };
      pos.set(eye.x, eye.y, eye.z);
      target.set(px * hall.screen.w * 0.55, hall.screen.cy + py * hall.screen.h * 0.5, 0);
      return { pos, target };
    }

    let centre; let dist; let elevation;
    if (this.mode === 'block' && this.activeBlock) {
      const b = hall.blocks.get(this.activeBlock);
      centre = new THREE.Vector3(b.center.x, b.center.y - 0.2, b.center.z);
      const fitW = (b.width / 2 + 1.2) / Math.tan(hfov / 2);
      const fitD = (b.depth / 2 + 1.6) / Math.tan(vfov / 2);
      dist = Math.max(fitW * 1.08, fitD * 0.92, 9);
      elevation = 0.84;
    } else {
      centre = new THREE.Vector3(hall.center.x, hall.center.y, hall.center.z);
      elevation = 0.9;
      const halfTall = (hall.zBack / 2) * Math.sin(elevation) + (hall.wallH / 2) * Math.cos(elevation);
      dist = Math.max(halfTall / Math.tan(vfov / 2), (hall.halfW * 1.2) / Math.tan(hfov / 2)) * 1.16;
    }
    dist *= this.zoom;
    const az = this.az + px * 0.07;
    const el = elevation + py * 0.04;
    pos.set(
      centre.x + dist * Math.sin(az) * Math.cos(el),
      centre.y + dist * Math.sin(el),
      centre.z + dist * Math.cos(az) * Math.cos(el),
    );
    target.copy(centre);
    return { pos, target };
  }

  updateCamera(dt) {
    const goal = this.goalPose();
    if (this.flight) {
      this.flight.t += dt;
      const k = ease(clamp(this.flight.t / this.flight.dur, 0, 1));
      this.pose.pos.lerpVectors(this.flight.from.pos, goal.pos, k);
      this.pose.target.lerpVectors(this.flight.from.target, goal.target, k);
      if (this.flight.t >= this.flight.dur) this.flight = null;
    } else {
      const k = 1 - Math.exp(-dt * 5);
      this.pose.pos.lerp(goal.pos, k);
      this.pose.target.lerp(goal.target, k);
    }
    this.camera.position.copy(this.pose.pos);
    this.camera.lookAt(this.pose.target);

    // Wider lens once you sit down, like turning your head in a real seat
    const fov = this.mode === 'pov' ? POV_FOV : BASE_FOV;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3));
      this.camera.updateProjectionMatrix();
    }

    // 4DX: the seat moves with the film
    if (this.mode === 'pov' && !this.flight && this.hall.features?.fourDX) {
      const t = this.clock.elapsedTime;
      this.camera.position.y += Math.sin(t * 2.1) * 0.035 + Math.sin(t * 5.3) * 0.008;
      this.camera.rotateZ(Math.sin(t * 1.3) * 0.016);
      this.camera.rotateX(Math.sin(t * 1.9) * 0.007);
    }

    const inset = this.mode === 'pov' ? 0 : (this.insetTarget || 0);
    this.inset = (this.inset || 0) + (inset - (this.inset || 0)) * (1 - Math.exp(-dt * 4));
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (this.inset > 0.5) this.camera.setViewOffset(w, h, this.inset / 2, 0, w, h);
    else if (this.camera.view) this.camera.clearViewOffset();
  }

  applyLights(level) {
    this.hemi.intensity = 0.34 + 1.25 * level;
    this.sun.intensity = 0.04 + 2.7 * level;
    this.fill.intensity = 0.1 + 0.35 * level;
    this.screenLight.intensity = 30 + 520 * (1 - level);
    this.beam.material.opacity = 0.085 * (1 - level);
    for (const p of this.sidePanels || []) p.material.opacity = this.hall.features.screenX ? 0.2 + 0.75 * (1 - level) : 0.08 + 0.5 * (1 - level);
    this.scene.background.lerpColors(this.bgMovie, this.bgHouse, level);
    this.scene.fog.color.copy(this.scene.background);
  }

  /* ------------------------------------------------------------------ input */

  bind() {
    const el = this.canvas;
    this.onMove = (e) => {
      const r = el.getBoundingClientRect();
      const p = this.pointer;
      p.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      p.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      p.inside = e.pointerType !== 'touch' || Boolean(p.down);
      p.dirty = true;
      if (p.down) {
        const dx = e.clientX - p.down.x;
        const dy = e.clientY - p.down.y;
        if (Math.hypot(dx, dy) > 7) p.dragged = true;
        if (p.dragged && this.mode !== 'pov') {
          this.az = clamp(p.down.az - dx * 0.006, -1.1, 1.1);
          el.style.cursor = 'grabbing';
        }
      }
    };
    this.onDown = (e) => {
      this.pointer.down = { x: e.clientX, y: e.clientY, az: this.az };
      this.pointer.dragged = false;
      el.setPointerCapture?.(e.pointerId);
    };
    this.onUp = (e) => {
      const wasDrag = this.pointer.dragged;
      this.pointer.down = null;
      this.pointer.dragged = false;
      el.style.cursor = '';
      if (wasDrag) return;
      this.onMove(e);
      this.pick();
      if (this.mode === 'overview' && this.hoverBlock) {
        const b = this.hall.blocks.get(this.hoverBlock);
        if (this.cb.onBlockClick) this.cb.onBlockClick(b); else this.flyToBlock(b.id);
      } else if (this.mode === 'block' && this.hoverSeat) {
        this.cb.onSeatClick?.(this.hall.seatById.get(this.hoverSeat));
      }
      if (e.pointerType === 'touch') {
        // No hover on touch screens: show the tag briefly, then clear it
        this.pointer.inside = false;
        clearTimeout(this.touchTimer);
        this.touchTimer = setTimeout(() => {
          if (this.disposed) return;
          this.hoverSeat = null;
          this.hoverBlock = null;
          this.hideTooltip();
          this.paint();
        }, 1500);
      }
    };
    this.onLeave = () => {
      this.pointer.inside = false;
      if (this.hoverBlock || this.hoverSeat) { this.hoverBlock = null; this.hoverSeat = null; this.paint(); }
      this.hideTooltip();
    };
    this.onWheel = (e) => {
      if (this.mode === 'pov') return;
      e.preventDefault();
      this.zoom = clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.55, 1.3);
    };
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  pick() {
    const p = this.pointer;
    p.dirty = false;
    if (this.flight || this.mode === 'pov') return;
    this.raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), this.camera);

    if (this.mode === 'overview') {
      const hit = this.raycaster.intersectObjects(this.blockMeshes, false)[0];
      const id = hit ? hit.object.userData.block.id : null;
      if (id !== this.hoverBlock) {
        this.hoverBlock = id;
        this.paint();
        if (id) this.showBlockTooltip(this.hall.blocks.get(id)); else this.hideTooltip();
      }
      this.canvas.style.cursor = id ? 'pointer' : '';
      return;
    }

    const hit = this.raycaster.intersectObjects(this.seatMeshes, false)[0];
    const seat = hit ? hit.object.userData.seats[hit.instanceId] : null;
    const id = seat ? seat.id : null;
    if (id !== this.hoverSeat) {
      this.hoverSeat = id;
      this.paint();
      if (seat) this.showSeatTooltip(seat); else this.hideTooltip();
    }
    this.canvas.style.cursor = seat ? (this.unavailable.has(id) ? 'not-allowed' : 'pointer') : '';
  }

  /* ------------------------------------------------------------------ tooltip */

  setTooltip(parts, anchor, accent) {
    const t = this.tooltip;
    t.replaceChildren();
    const left = document.createElement('div');
    const small = document.createElement('small'); small.textContent = parts.kicker;
    const strong = document.createElement('strong'); strong.textContent = parts.title;
    const sub = document.createElement('span'); sub.textContent = parts.sub; sub.className = parts.subClass || '';
    left.append(small, strong, sub);
    t.append(left);
    if (parts.price) {
      const right = document.createElement('div'); right.className = 'stage-tooltip-price';
      const b = document.createElement('b'); b.textContent = parts.price;
      right.append(b);
      t.append(right);
    }
    t.style.setProperty('--tip-accent', accent || '#ff4d6d');
    this.tooltipAnchor = anchor;
    t.classList.add('show');
    this.positionTooltip();
  }

  showBlockTooltip(b) {
    const left = b.seats.filter((s) => !this.unavailable.has(s.id)).length;
    this.setTooltip({
      kicker: `${b.category}${b.name ? ` · ${b.name}` : ''}`.toUpperCase(),
      title: `Block ${b.code}`,
      sub: left ? `● ${left} left` : 'Sold out',
      subClass: left ? (left < b.seats.length * 0.3 ? 'few' : 'ok') : 'none',
      price: this.formatPrice(b.price),
    }, new THREE.Vector3(b.center.x, b.max.y + 0.6, b.center.z), b.color);
  }

  showSeatTooltip(s) {
    const taken = this.unavailable.has(s.id);
    this.setTooltip({
      kicker: `ROW ${s.row} · SEAT ${s.col}`,
      title: taken ? 'Taken' : s.category,
      sub: taken ? 'Someone got here first' : `View score ${s.score}/10`,
      subClass: taken ? 'none' : 'ok',
      price: taken ? '' : this.formatPrice(s.price),
    }, new THREE.Vector3(s.x, s.y + 1.75, s.z), tierOf(s.category).color);
  }

  hideTooltip() { this.tooltip.classList.remove('show'); this.tooltipAnchor = null; }

  positionTooltip() {
    if (!this.tooltipAnchor) return;
    const v = this.tooltipAnchor.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const x = clamp((v.x * 0.5 + 0.5) * w, 90, w - 90);
    const y = clamp((-v.y * 0.5 + 0.5) * h, 70, h - 10);
    this.tooltip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  /* ------------------------------------------------------------------ frame */

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.12);
    this.adaptQuality(rawDt);
    const t = this.clock.elapsedTime;

    if (this.pointer.dirty && !this.pointer.dragged) this.pick();
    this.updateCamera(dt);

    const wanted = this.lightOverride == null ? this.lightTarget : (this.lightOverride ? 1 : 0);
    this.lightLevel += (wanted - this.lightLevel) * (1 - Math.exp(-dt * 3));
    this.applyLights(this.lightLevel);

    // block glow
    for (const mesh of this.blockMeshes) {
      const on = this.mode === 'overview' && mesh.userData.block.id === this.hoverBlock;
      mesh.visible = this.mode === 'overview';
      const mat = mesh.material;
      mat.opacity += ((on ? 0.2 : 0) - mat.opacity) * 0.2;
      mesh.userData.outline.material.opacity = mat.opacity * 4.5;
    }
    // markers bob + spin
    for (const g of this.markers) {
      if (!g.visible) continue;
      const { pin, halo, pinBase } = g.userData;
      pin.position.y = pinBase + Math.sin(t * 3 + g.position.x) * 0.07;
      pin.rotation.y = t * 2;
      pin.visible = this.mode !== 'pov';
      halo.material.opacity = (this.mode === 'pov' ? 0.03 : 0.09) + Math.sin(t * 4) * 0.03;
    }
    // row letters only when you are close enough to read them
    const labelOpacity = this.mode === 'block' ? 0.9 : 0;
    for (const s of this.rowLabels.children) s.material.opacity += (labelOpacity - s.material.opacity) * 0.12;

    if (t - this.screenTime > 0.09) { this.screenTime = t; this.drawScreen(t); }
    this.positionTooltip();
    this.renderer.render(this.scene, this.camera);
  }

  /** Slow device? Quietly drop the render resolution until the hall feels smooth again. */
  adaptQuality(dt) {
    const p = this.perf;
    p.frames++;
    p.time += dt;
    if (p.frames < 45) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (fps >= 26) return;
    if (this.pixelRatio > 0.6) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio * 0.75);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    } else if (this.sun.castShadow && fps < 20) {
      this.sun.castShadow = false; // last resort on very slow devices: drop the sun shadows
    }
  }

  /** Screen position (CSS pixels) of a seat - handy for tests and guided tours. */
  seatScreenPoint(id) {
    const s = this.hall.seatById.get(id);
    if (!s) return null;
    const v = new THREE.Vector3(s.x, s.y + 0.6, s.z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }

  /**
   * Render the view from the given seats (lights down, film playing) and return it as a JPEG data URL.
   * Used for the picture on the ticket, so nobody has to buy a seat blind.
   */
  snapshot(ids, width = 640, height = 360) {
    const eye = eyePoint(this.hall, ids);
    if (!eye) return null;
    const cam = this.snapCamera;
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    // Render into a 16:9 corner of the canvas so the picture is the same on a phone and a monitor
    const cw = this.container.clientWidth || 1;
    const ch = this.container.clientHeight || 1;
    const vw = Math.min(cw, (ch * width) / height);
    const vh = (vw * height) / width;
    cam.position.set(eye.x, eye.y, eye.z);
    cam.lookAt(0, this.hall.screen.cy, 0);

    const hidden = this.markers.filter((g) => g.visible);
    hidden.forEach((g) => { g.visible = false; });
    this.blockMeshes.forEach((m) => { m.visible = false; });
    const labels = this.rowLabels.visible;
    this.rowLabels.visible = false;
    this.applyLights(0.05);

    this.renderer.setViewport(0, 0, vw, vh);
    this.renderer.setScissor(0, 0, vw, vh);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, cam);
    const out = document.createElement('canvas');
    out.width = width; out.height = height;
    const ctx = out.getContext('2d');
    const src = this.canvas;
    const k = src.width / cw; // device pixels per CSS pixel
    ctx.drawImage(src, 0, src.height - vh * k, vw * k, vh * k, 0, 0, width, height); // GL origin is bottom-left
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, cw, ch);

    hidden.forEach((g) => { g.visible = true; });
    this.rowLabels.visible = labels;
    this.applyLights(this.lightLevel);
    this.renderer.render(this.scene, this.camera); // put the real frame back before the browser paints
    try { return out.toDataURL('image/jpeg', 0.85); } catch { return null; }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.touchTimer);
    this.ro?.disconnect();
    const el = this.canvas;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('wheel', this.onWheel);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((mat) => { mat.map?.dispose?.(); mat.dispose?.(); });
    });
    this.renderer.dispose();
    el.remove();
    this.tooltip.remove();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
