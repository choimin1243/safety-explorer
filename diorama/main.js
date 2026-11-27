// 가현 안전상자 — 1:150 미니어처 디오라마 안전교육 게임 (three.js r170)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TALK } from './talk.js';

const $ = (id) => document.getElementById(id);
const lp = (p) => { $('lp').textContent = Math.round(p) + '%'; };
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const MOBILE = matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

/* ───────────── 렌더러 ───────────── */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const labelR = new CSS2DRenderer();
labelR.setSize(innerWidth, innerHeight);
Object.assign(labelR.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
stage.appendChild(labelR.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.5, 600);
camera.position.set(48, 38, 60);
const controls = new OrbitControls(camera, labelR.domElement);
labelR.domElement.style.pointerEvents = 'auto';
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.target.set(0, 2, 0);
controls.minDistance = 8; controls.maxDistance = 190;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotate = true; controls.autoRotateSpeed = 0.35;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.55, 0.82);
composer.addPass(bloom);
// 틸트시프트(위·아래를 흐리게 해서 미니어처처럼)
const tilt = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 1.0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform vec2 res; varying vec2 vUv;
    void main(){ float d = smoothstep(0.18, 0.62, abs(vUv.y-0.5)) * amount; vec2 px = d * 2.2 / res; vec4 c = vec4(0.0);
      c += texture2D(tDiffuse, vUv) * 0.2;
      c += texture2D(tDiffuse, vUv + vec2(px.x, 0.0)) * 0.1; c += texture2D(tDiffuse, vUv - vec2(px.x, 0.0)) * 0.1;
      c += texture2D(tDiffuse, vUv + vec2(0.0, px.y)) * 0.1; c += texture2D(tDiffuse, vUv - vec2(0.0, px.y)) * 0.1;
      c += texture2D(tDiffuse, vUv + px * 1.8) * 0.1; c += texture2D(tDiffuse, vUv - px * 1.8) * 0.1;
      c += texture2D(tDiffuse, vUv + vec2(px.x, -px.y) * 1.8) * 0.1; c += texture2D(tDiffuse, vUv - vec2(px.x, -px.y) * 1.8) * 0.1;
      gl_FragColor = c; }`,
});
composer.addPass(tilt);
composer.addPass(new OutputPass());

/* ───────────── 빛 ───────────── */
const hemi = new THREE.HemisphereLight(0x9aa7ff, 0x2a2030, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xbcc8ff, 0.8);
sun.position.set(-30, 50, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);
const flashLight = new THREE.DirectionalLight(0xdfe6ff, 0);
flashLight.position.set(10, 60, -20);
scene.add(flashLight);

/* ───────────── 재료 ───────────── */
const CAN = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const GLOW = (color, i = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: i, roughness: 0.6 });

const wetMats = []; // 비 오면 반짝이는 재료
const snowMats = []; // 눈 오면 하얘지는 재료
const nightGlow = []; // 밤에 켜지는 재료 [mat, nightI, dayI]
const lampLights = [];
function wet(m) { m.userData.dryR = m.roughness; m.userData.base = m.color.clone(); wetMats.push(m); return m; }
function snowy(m) { if (!m.userData.base) m.userData.base = m.color.clone(); snowMats.push(m); return m; }
function nglow(m, n = 2, d = 0.25) { nightGlow.push([m, n, d]); return m; }

const mat = {
  asphalt: snowy(wet(M(0x2c2b31, { roughness: 0.85 }))),
  concrete: snowy(wet(M(0x8d8780, { roughness: 0.9 }))),
  paver: snowy(wet(M(0x9b8d7f, { roughness: 0.85 }))),
  paver2: snowy(wet(M(0x7f8a86, { roughness: 0.85 }))),
  curb: M(0xbdb6aa),
  grass: snowy(M(0x40603a, { roughness: 1 })),
  field: snowy(M(0x9c7350, { roughness: 1 })),
  rubberG: snowy(wet(M(0x3f7d5a))),
  rubberO: snowy(wet(M(0xc4683b))),
  red: snowy(wet(M(0x9a3b2e, { roughness: 0.8 }))),
  white: M(0xece8df, { roughness: 0.6 }),
  yellow: M(0xf2c230, { roughness: 0.6 }),
  roof: snowy(M(0x55504c)),
  roofG: snowy(M(0x4c6b4a)),
  dark: M(0x1b1a1f),
  metal: M(0x8b8f96, { metalness: 0.6, roughness: 0.35 }),
  pole: M(0x3a3d44, { metalness: 0.5, roughness: 0.4 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, transmission: 0, depthWrite: false }),
  trunk: M(0x4a3527),
  leaf: snowy(M(0x2f5a34, { roughness: 0.9 })),
  leaf2: snowy(M(0x4c7a3a, { roughness: 0.9 })),
  leafY: snowy(M(0xc79b2e, { roughness: 0.9 })),
  skin: M(0xf0c9a0),
  water: new THREE.MeshStandardMaterial({ color: 0x24485e, roughness: 0.05, metalness: 0.3 }),
  wood: M(0x6d4a2f),
  lampOn: nglow(GLOW(0xffd9a0, 3), 3.2, 0.1),
  garageLight: nglow(GLOW(0xe9f3ff, 2.2), 2.2, 1.4),
};

// 땅 단면(지층) 무늬
const strataTex = (() => {
  const c = CAN(256, 256), g = c.getContext('2d');
  const bands = ['#5a4636', '#6b523d', '#4b3a2e', '#7a6048', '#3e3029', '#5d4a3a', '#2f2622'];
  let y = 0; let i = 0;
  while (y < 256) { const h = 18 + Math.random() * 30; g.fillStyle = bands[i++ % bands.length]; g.fillRect(0, y, 256, h); y += h; }
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${200 + Math.random() * 55},${180 + Math.random() * 50},${150},${Math.random() * 0.18})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  return texOf(c);
})();
mat.earth = M(0xffffff, { map: strataTex, roughness: 1 });

/* ───────────── 레이어 그룹 ───────────── */
const root = new THREE.Group(); scene.add(root);
const L = {
  under: new THREE.Group(), ground: new THREE.Group(), build: new THREE.Group(), roof: new THREE.Group(),
};
for (const k in L) root.add(L[k]);
const EXPLODE = { under: -7, ground: 0, build: 7, roof: 14 };
let explodeT = 0, explodeGoal = 0;

function box(w, h, d, m, x, y, z, parent = L.ground, o = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = true;
  if (o.ry) mesh.rotation.y = o.ry;
  parent.add(mesh);
  return mesh;
}
// 왼쪽-아래 모서리 기준 상자 (x0..x1, y0..y1, z0..z1)
function slab(x0, x1, y0, y1, z0, z1, m, parent = L.ground, o) { return box(x1 - x0, y1 - y0, z1 - z0, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent, o); }
function cyl(rt, rb, h, m, x, y, z, parent = L.ground, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/* ───────────── 글씨 판 ───────────── */
function signTex(text, o = {}) {
  const fs = o.fs || 64, pad = o.pad ?? 18, font = `${o.weight || 900} ${fs}px 'Noto Sans KR', sans-serif`;
  const c0 = CAN(8, 8).getContext('2d'); c0.font = font;
  const lines = String(text).split('\n');
  const w = Math.ceil(Math.max(...lines.map((l) => c0.measureText(l).width)) + pad * 2), h = Math.ceil(fs * 1.25 * lines.length + pad * 1.4);
  const c = CAN(o.w || w, o.h || h), g = c.getContext('2d');
  g.fillStyle = o.bg || '#000'; g.fillRect(0, 0, c.width, c.height);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 6; g.strokeRect(5, 5, c.width - 10, c.height - 10); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.fg || '#fff';
  if (o.glow) { g.shadowColor = o.fg; g.shadowBlur = 18; }
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
  return { tex: texOf(c), aspect: c.width / c.height };
}
function sign(text, x, y, z, height, o = {}, parent = L.build) {
  const { tex, aspect } = signTex(text, o);
  const w = o.width || height * aspect;
  const m = o.lit === false ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
    : nglow(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.6, roughness: 0.5 }), o.ni || 1.7, o.di || 0.55);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, 0.08), [mat.dark, mat.dark, mat.dark, mat.dark, m, mat.dark]);
  mesh.position.set(x, y, z); mesh.rotation.y = o.ry || 0; mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
// 바닥에 그린 글씨/무늬
function decal(text, x, z, w, o = {}) {
  const { tex, aspect } = signTex(text, { bg: 'rgba(0,0,0,0)', fg: o.fg || '#f4f1ea', fs: 80, ...o });
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), m);
  mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = o.rz || 0; mesh.position.set(x, o.y || 0.035, z); mesh.receiveShadow = true;
  L.ground.add(mesh);
  return mesh;
}

/* ───────────── 창문 있는 건물 ───────────── */
const WARM = ['#ffd58a', '#ffcf7a', '#ffe2b0', '#fff0d0', '#ffc16a', '#bfe3ff'];
function facade(cols, rows, o = {}) {
  const cw = 32, ch = 36, c = CAN(cols * cw, rows * ch), e = CAN(cols * cw, rows * ch), g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = o.wall || '#cfc6b8'; g.fillRect(0, 0, c.width, c.height);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  for (let r = 0; r < rows; r++) {
    g.fillStyle = o.band || 'rgba(0,0,0,0.12)'; g.fillRect(0, r * ch + ch - 4, c.width, 4);
    for (let k = 0; k < cols; k++) {
      const x = k * cw + 5, y = r * ch + 7, w = cw - 10, h = ch - 16;
      const lit = Math.random() < (o.lit ?? 0.4) && !(o.groundShop && r === rows - 1);
      const col = WARM[(Math.random() * (o.cool ? WARM.length : WARM.length - 1)) | 0];
      g.fillStyle = lit ? col : (o.glass || '#2e3a47'); g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w, 2);
      if (o.balcony) { g.fillStyle = 'rgba(40,40,40,0.55)'; g.fillRect(x - 3, y + h - 3, w + 6, 4); }
      if (lit) { ge.fillStyle = col; ge.fillRect(x, y, w, h); if (Math.random() < 0.3) { ge.fillStyle = 'rgba(0,0,0,0.5)'; ge.fillRect(x + w * Math.random(), y, 3, h); } }
    }
  }
  return { map: texOf(c), emap: texOf(e) };
}
function building(o) {
  const { x0, x1, z0, z1, floors, fh = 1, parent = L.build } = o;
  const w = x1 - x0, d = z1 - z0, h = floors * fh;
  const mk = (len) => {
    const f = facade(Math.max(2, Math.round(len / (o.cell || 0.75))), floors, o);
    return nglow(new THREE.MeshStandardMaterial({ map: f.map, emissive: 0xffffff, emissiveMap: f.emap, emissiveIntensity: 0.5, roughness: 0.75 }), o.ni ?? 0.55, 0.0);
  };
  const sx = mk(d), sz = mk(w);
  const roofM = o.roofMat || mat.roof;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sx, sx, roofM, mat.dark, sz, sz]);
  mesh.position.set((x0 + x1) / 2, h / 2 + (o.y || 0), (z0 + z1) / 2); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  // 옥상 난간
  const top = h + (o.y || 0);
  const pm = o.parapet || mat.concrete;
  slab(x0, x1, top, top + 0.22, z0, z0 + 0.1, pm, L.roof); slab(x0, x1, top, top + 0.22, z1 - 0.1, z1, pm, L.roof);
  slab(x0, x0 + 0.1, top, top + 0.22, z0, z1, pm, L.roof); slab(x1 - 0.1, x1, top, top + 0.22, z0, z1, pm, L.roof);
  return { mesh, top };
}

/* ───────────── 나무·가로등·사람·차 ───────────── */
const trees = [];
function tree(x, z, s = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  cyl(0.07 * s, 0.1 * s, 1.1 * s, mat.trunk, 0, 0.55 * s, 0, g, 6);
  const lm = [mat.leaf, mat.leaf2, mat.leafY][kind];
  const n = 3 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.42, 0.62) * s, 0), lm);
    m.position.set(rand(-0.3, 0.3) * s, (1.25 + rand(0, 0.6)) * s, rand(-0.3, 0.3) * s); m.castShadow = true; m.receiveShadow = true;
    m.rotation.set(rand(0, 3), rand(0, 3), 0); g.add(m);
  }
  L.ground.add(g); trees.push(g); return g;
}
function lamp(x, z, ry = 0, light = false) {
  const g = new THREE.Group(); g.position.set(x, 0.15, z); g.rotation.y = ry;
  cyl(0.04, 0.05, 2.6, mat.pole, 0, 1.3, 0, g, 6);
  box(0.6, 0.05, 0.06, mat.pole, 0.28, 2.58, 0, g);
  box(0.28, 0.06, 0.14, mat.lampOn, 0.52, 2.53, 0, g, { cast: false });
  if (light && !MOBILE) { const p = new THREE.PointLight(0xffc98a, 0, 7, 1.6); p.position.set(0.52, 2.3, 0); g.add(p); lampLights.push(p); }
  L.ground.add(g); return g;
}
const SHIRTS = [0xe0543a, 0x2f6fd0, 0xf0c13a, 0x46a36b, 0xeeeeee, 0x8a4fd0, 0xff8fb1, 0x3ab0c8, 0x333333];
const UMB = [0xe0543a, 0x2f6fd0, 0xf0c13a, 0x222222, 0xffffff, 0x46a36b, 0xff8fb1];
const umbrellas = [];
function person(o = {}) {
  const s = o.kid ? 0.72 : 1;
  const g = new THREE.Group();
  const pants = M(o.pants ?? 0x2b2f3a), shirt = M(o.shirt ?? SHIRTS[(Math.random() * SHIRTS.length) | 0]);
  box(0.09 * s, 0.32 * s, 0.1 * s, pants, -0.06 * s, 0.16 * s, 0, g).name = 'legL';
  box(0.09 * s, 0.32 * s, 0.1 * s, pants, 0.06 * s, 0.16 * s, 0, g).name = 'legR';
  box(0.24 * s, 0.32 * s, 0.14 * s, shirt, 0, 0.48 * s, 0, g);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 10, 8), mat.skin); head.position.y = 0.74 * s; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(o.hair ?? 0x1d1712)); hair.position.y = 0.75 * s; g.add(hair);
  if (o.kid || o.bag) box(0.18 * s, 0.22 * s, 0.08 * s, M(o.bagColor ?? [0xe0543a, 0xf0c13a, 0x2f6fd0, 0xff8fb1][(Math.random() * 4) | 0]), 0, 0.5 * s, -0.11 * s, g);
  if (o.vest) box(0.26 * s, 0.24 * s, 0.155 * s, M(0xd8f23a, { emissive: 0x3a4a00, emissiveIntensity: 0.4 }), 0, 0.5 * s, 0, g);
  if (o.cap) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.12 * s, 0.06 * s, 10), M(o.cap)); c.position.y = 0.83 * s; g.add(c); }
  if (o.helmet) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.125 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(o.helmet)); c.position.y = 0.76 * s; g.add(c); }
  const um = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 0.18 * s, 8, 1, true), M(UMB[(Math.random() * UMB.length) | 0], { side: THREE.DoubleSide, roughness: 0.4 }));
  cone.position.y = 1.08 * s; cone.castShadow = true; um.add(cone);
  cyl(0.008, 0.008, 0.5 * s, mat.pole, 0.02, 0.82 * s, 0, um, 4);
  um.visible = false; g.add(um); umbrellas.push(um);
  g.userData = { s, phase: Math.random() * 6 };
  return g;
}
function animWalk(g, t, moving) {
  const k = moving ? Math.sin(t * 9 + g.userData.phase) : 0;
  g.children.forEach((c) => { if (c.name === 'legL') c.rotation.x = k * 0.5; if (c.name === 'legR') c.rotation.x = -k * 0.5; });
}

const carLights = [];
function car(kind = 'car', color) {
  const g = new THREE.Group();
  const spec = {
    car: { l: 1.5, w: 0.72, h: 0.34, cab: [0.8, 0.28], c: color ?? [0xe8e6e0, 0x2f5fb8, 0xb83a2e, 0x6c7178, 0x1c1d22, 0xd8b23a][(Math.random() * 6) | 0] },
    taxi: { l: 1.5, w: 0.72, h: 0.34, cab: [0.8, 0.28], c: 0xf0b52a },
    bus: { l: 3.6, w: 0.86, h: 0.9, cab: null, c: 0x2f9a5a },
    van: { l: 1.7, w: 0.78, h: 0.7, cab: null, c: 0x6d7076 },
    fire: { l: 2.4, w: 0.86, h: 0.8, cab: null, c: 0xd42a22 },
    amb: { l: 2.0, w: 0.82, h: 0.8, cab: null, c: 0xf2f2ee },
    truck: { l: 2.0, w: 0.8, h: 0.75, cab: null, c: 0x3a6fb8 },
  }[kind];
  const body = M(spec.c, { roughness: 0.35, metalness: 0.4 });
  box(spec.l, spec.h, spec.w, body, 0, 0.12 + spec.h / 2, 0, g);
  if (spec.cab) { box(spec.cab[0], spec.cab[1], spec.w * 0.9, M(0x1b2633, { roughness: 0.15, metalness: 0.6 }), -0.06, 0.12 + spec.h + spec.cab[1] / 2, 0, g); box(spec.cab[0] * 0.9, 0.03, spec.w * 0.86, body, -0.06, 0.12 + spec.h + spec.cab[1], 0, g); }
  else { // 창문 띠
    box(spec.l * 0.92, spec.h * 0.28, spec.w + 0.01, M(0x1b2633, { roughness: 0.15, metalness: 0.6 }), 0, 0.12 + spec.h * 0.72, 0, g);
    if (kind === 'bus') { box(0.02, spec.h * 0.28, spec.w * 0.7, nglow(GLOW(0x9ff0c0, 1), 1.4, 0.3), spec.l / 2, 0.12 + spec.h * 0.72, 0, g, { cast: false }); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = cyl(0.13, 0.13, 0.1, mat.dark, sx * spec.l * 0.32, 0.13, sz * spec.w * 0.48, g, 10); wh.rotation.x = Math.PI / 2; }
  const head = GLOW(0xfff4d8, 3), tail = GLOW(0xff2a1a, 2.2);
  for (const sz of [-1, 1]) { box(0.04, 0.07, 0.14, head, spec.l / 2 + 0.01, 0.3, sz * spec.w * 0.33, g, { cast: false }); box(0.04, 0.07, 0.14, tail, -spec.l / 2 - 0.01, 0.3, sz * spec.w * 0.33, g, { cast: false }); }
  carLights.push(head, tail);
  if (kind === 'taxi') { box(0.24, 0.08, 0.14, nglow(GLOW(0xffe08a, 2), 2, 0.4), -0.06, 0.12 + spec.h + spec.cab[1] + 0.05, 0, g); }
  if (kind === 'fire' || kind === 'amb') {
    const b1 = GLOW(0xff2020, 4), b2 = GLOW(kind === 'fire' ? 0xff2020 : 0x2060ff, 4);
    box(0.18, 0.08, 0.16, b1, spec.l * 0.3, 0.12 + spec.h + 0.05, -0.2, g, { cast: false }); box(0.18, 0.08, 0.16, b2, spec.l * 0.3, 0.12 + spec.h + 0.05, 0.2, g, { cast: false });
    g.userData.beacons = [b1, b2];
    if (kind === 'fire') { box(spec.l * 0.8, 0.06, 0.12, mat.metal, -0.1, 0.12 + spec.h + 0.12, 0, g); box(spec.l, 0.05, spec.w + 0.01, M(0xf2f2ee), 0, 0.3, 0, g); }
    else { box(spec.l + 0.01, 0.08, spec.w + 0.01, M(0xd42a22), 0, 0.34, 0, g); }
  }
  if (kind === 'van') { g.userData.hazard = [GLOW(0xffa020, 0)]; for (const sx of [-1, 1]) box(0.05, 0.06, 0.08, g.userData.hazard[0], sx * (spec.l / 2 + 0.01), 0.3, spec.w * 0.42, g, { cast: false }); }
  g.userData.len = spec.l; g.userData.kind = kind;
  return g;
}

/* ───────────── 동네 짓기 ───────────── */
// 좌표: x 동(+)·서(−) / z 남(+, 관람객 쪽)·북(−) / y 위. 상자 크기 44 × 32.
const W2 = 22, D2 = 16;
const ROAD = { z0: 2, z1: 8 }, CROSS_X = -2, LANE_W = 3.6, LANE_E = 6.4;
const RAMP = { x0: 3, x1: 6.5, z0: 10, z1: 14.6, depth: 3.6 };
const GARAGE = { x0: -2, x1: 20, z0: 2, z1: 15.95, y0: -3.6, y1: -0.4 };
const SITE = { x0: 13, x1: 21.6, z0: -15.6, z1: -2 };
let pct = 0; const step = (n) => { pct += n; lp(pct); };

function buildBase() {
  // 받침대
  slab(-W2 - 0.8, W2 + 0.8, -7.2, -6, -D2 - 0.8, D2 + 0.8, M(0x1a1618, { roughness: 0.5, metalness: 0.3 }), L.under);
  slab(-W2 - 0.5, W2 + 0.5, -6.05, -5.95, -D2 - 0.5, D2 + 0.5, M(0xb08a4c, { metalness: 0.8, roughness: 0.3 }), L.under);
  const plaque = sign('인천가현초등학교 · 루원시티   1:150', -10, -6.6, D2 + 0.81, 0.6, { bg: '#b08a4c', fg: '#2a2118', fs: 56, weight: 700, lit: false }, L.under);
  plaque.castShadow = false;
  // 땅속 (지하주차장 자리를 비우고)
  slab(-W2, GARAGE.x0, -6, -0.4, -D2, D2, mat.earth, L.under);
  slab(GARAGE.x0, W2, -6, -0.4, -D2, GARAGE.z0, mat.earth, L.under);
  slab(GARAGE.x1, W2, -6, -0.4, GARAGE.z0, D2, mat.earth, L.under);
  slab(GARAGE.x0, GARAGE.x1, -6, GARAGE.y0, GARAGE.z0, D2, mat.earth, L.under);
  // 지하주차장 안쪽
  const gfloor = M(0x5f7a6e, { roughness: 0.35, metalness: 0.1 });
  slab(GARAGE.x0, GARAGE.x1, GARAGE.y0, GARAGE.y0 + 0.04, GARAGE.z0, GARAGE.z1, gfloor, L.under);
  const gwall = M(0xb9b4ab, { roughness: 0.9 });
  slab(GARAGE.x0, GARAGE.x0 + 0.06, GARAGE.y0, GARAGE.y1, GARAGE.z0, GARAGE.z1, gwall, L.under);
  slab(GARAGE.x1 - 0.06, GARAGE.x1, GARAGE.y0, GARAGE.y1, GARAGE.z0, GARAGE.z1, gwall, L.under);
  slab(GARAGE.x0, GARAGE.x1, GARAGE.y0, GARAGE.y1, GARAGE.z0, GARAGE.z0 + 0.06, gwall, L.under);
  slab(GARAGE.x0 + 0.06, GARAGE.x1 - 0.06, GARAGE.y0, GARAGE.y0 + 0.5, GARAGE.z0 + 0.06, GARAGE.z0 + 0.1, M(0xe2b23a), L.under);
  for (let x = 1; x < GARAGE.x1 - 1; x += 4) for (const z of [6, 11]) {
    if (x > RAMP.x0 - 0.6 && x < RAMP.x1 + 0.6 && z > 9) continue;
    slab(x - 0.25, x + 0.25, GARAGE.y0, GARAGE.y1, z - 0.25, z + 0.25, gwall, L.under);
    slab(x - 0.26, x + 0.26, GARAGE.y0, GARAGE.y0 + 0.6, z - 0.26, z + 0.26, M(0xe2b23a), L.under);
  }
  // 주차칸, 조명
  for (let x = 0; x < GARAGE.x1 - 1; x += 1.0) { slab(x, x + 0.04, GARAGE.y0 + 0.04, GARAGE.y0 + 0.05, 2.2, 4.2, mat.white, L.under, { cast: false }); }
  for (let x = 8; x < GARAGE.x1 - 1; x += 1.0) { slab(x, x + 0.04, GARAGE.y0 + 0.04, GARAGE.y0 + 0.05, 12.0, 14.0, mat.white, L.under, { cast: false }); }
  for (let x = 0; x < GARAGE.x1 - 1; x += 3) for (const z of [4.5, 8.5, 12.8]) slab(x, x + 1.6, GARAGE.y1 - 0.08, GARAGE.y1 - 0.02, z - 0.06, z + 0.06, mat.garageLight, L.under, { cast: false });
  if (!MOBILE) for (const [x, z] of [[4, 7], [14, 7], [10, 13]]) { const p = new THREE.PointLight(0xdcecff, 3, 12, 1.4); p.position.set(x, GARAGE.y1 - 0.4, z); L.under.add(p); }
  const pk = [[0.5, 3.2], [2.5, 3.2], [6.5, 3.2], [9.5, 3.2], [11.5, 3.2], [15.5, 3.2], [8.5, 13.0], [12.5, 13.0], [16.5, 13.0], [18.5, 13.0]];
  for (const [x, z] of pk) { const c = car('car'); c.position.set(x, GARAGE.y0, z); c.rotation.y = Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0); L.under.add(c); }
  sign('B1  지하주차장', 12, GARAGE.y1 - 0.5, GARAGE.z0 + 0.1, 0.42, { bg: '#1d4f8a', fg: '#fff', fs: 54 }, L.under);
  sign('출차주의 ▲', RAMP.x1 + 0.4, -2.4, 9.9, 0.32, { bg: '#f2c230', fg: '#1a1410', fs: 50, ry: -Math.PI / 2 }, L.under);
  // 유리 앞면
  const gl = slab(GARAGE.x0, GARAGE.x1, GARAGE.y0, GARAGE.y1, D2 - 0.06, D2 - 0.02, mat.glass, L.under, { cast: false }); gl.receiveShadow = false; gl.renderOrder = 5;
  // 경사로
  const len = Math.hypot(RAMP.z1 - RAMP.z0, RAMP.depth);
  const ramp = box(RAMP.x1 - RAMP.x0, 0.2, len, mat.concrete, (RAMP.x0 + RAMP.x1) / 2, -RAMP.depth / 2 - 0.1, (RAMP.z0 + RAMP.z1) / 2, L.under);
  ramp.rotation.x = Math.atan2(RAMP.depth, RAMP.z1 - RAMP.z0);
  for (let i = 0; i < 6; i++) { const s = box(RAMP.x1 - RAMP.x0 - 0.3, 0.02, 0.12, mat.yellow, (RAMP.x0 + RAMP.x1) / 2, 0, 0, L.under, { cast: false }); const t = (i + 0.5) / 6; s.position.set((RAMP.x0 + RAMP.x1) / 2, -RAMP.depth * t + 0.01, lerp(RAMP.z0, RAMP.z1, t)); s.rotation.x = ramp.rotation.x; }
  step(8);
}

function buildGround() {
  // 지면 판 (경사로 구멍 남기고)
  const C = mat.concrete;
  slab(-W2, W2, -0.4, 0, -D2, RAMP.z0, C);
  slab(-W2, RAMP.x0, -0.4, 0, RAMP.z0, D2, C);
  slab(RAMP.x1, W2, -0.4, 0, RAMP.z0, D2, C);
  slab(RAMP.x0, RAMP.x1, -0.4, 0, RAMP.z1, D2, C);
  // 테두리 (전시 상자 틀)
  const rim = M(0x221c20, { roughness: 0.4, metalness: 0.4 });
  slab(-W2 - 0.12, W2 + 0.12, -0.4, 0.22, -D2 - 0.12, -D2, rim); slab(-W2 - 0.12, W2 + 0.12, -0.4, 0.22, D2, D2 + 0.12, rim);
  slab(-W2 - 0.12, -W2, -0.4, 0.22, -D2, D2, rim); slab(W2, W2 + 0.12, -0.4, 0.22, -D2, D2, rim);

  // 도로
  slab(-W2, W2, 0, 0.03, ROAD.z0, ROAD.z1, mat.asphalt, L.ground, { cast: false });
  slab(-W2, W2, 0.03, 0.035, 4.9, 4.96, mat.yellow, L.ground, { cast: false }); slab(-W2, W2, 0.03, 0.035, 5.04, 5.1, mat.yellow, L.ground, { cast: false });
  // 어린이 보호구역 (빨간 길)
  slab(-13, 7, 0.03, 0.036, ROAD.z0 + 0.1, ROAD.z1 - 0.1, mat.red, L.ground, { cast: false });
  decal('어린이 보호구역', -8, LANE_E, 2.6, { fg: '#fff3e0', rz: -Math.PI / 2 });
  decal('어린이 보호구역', 4, LANE_W, 2.6, { fg: '#fff3e0', rz: Math.PI / 2 });
  decal('30', -11, LANE_E, 1.0, { fg: '#ffffff', rz: -Math.PI / 2 });
  decal('30', 6.4, LANE_W, 1.0, { fg: '#ffffff', rz: Math.PI / 2 });
  // 횡단보도
  for (let z = ROAD.z0 + 0.25; z < ROAD.z1 - 0.2; z += 0.6) slab(CROSS_X - 1.5, CROSS_X + 1.5, 0.03, 0.04, z, z + 0.32, mat.white, L.ground, { cast: false });
  for (let z = ROAD.z0 + 0.25; z < ROAD.z1 - 0.2; z += 0.6) slab(16.5 - 1.1, 16.5 + 1.1, 0.03, 0.04, z, z + 0.32, mat.white, L.ground, { cast: false });
  slab(CROSS_X - 2.1, CROSS_X - 1.95, 0.03, 0.04, ROAD.z0 + 3, ROAD.z1, mat.white, L.ground, { cast: false }); // 정지선
  slab(CROSS_X + 1.95, CROSS_X + 2.1, 0.03, 0.04, ROAD.z0, ROAD.z0 + 3, mat.white, L.ground, { cast: false });
  // 웅덩이
  for (const [x, z, r] of [[-6, 7.2, 0.7], [3, 2.6, 0.5], [11, 6.8, 0.8], [-15, 3.2, 0.6], [17, 7.3, 0.5], [-9, 1.2, 0.4], [8, 9.1, 0.45]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0 }));
    p.rotation.x = -Math.PI / 2; p.position.set(x, z < 2 || z > 8 ? 0.16 : 0.04, z); p.scale.set(1, 0.7 + Math.random() * 0.4, 1); L.ground.add(p); puddles.push(p);
  }
  // 인도
  slab(-W2, W2, 0, 0.15, 0, ROAD.z0, mat.paver);
  slab(-W2, RAMP.x0, 0, 0.15, ROAD.z1, RAMP.z0, mat.paver);
  slab(RAMP.x1, W2, 0, 0.15, ROAD.z1, RAMP.z0, mat.paver);
  slab(RAMP.x0, RAMP.x1, 0, 0.06, ROAD.z1, RAMP.z0, mat.concrete); // 차 나가는 턱
  for (let x = RAMP.x0 + 0.1; x < RAMP.x1 - 0.2; x += 0.45) slab(x, x + 0.22, 0.06, 0.065, ROAD.z1 + 0.1, RAMP.z0 - 0.1, mat.yellow, L.ground, { cast: false });
  slab(RAMP.x0, RAMP.x1, 0.06, 0.07, RAMP.z0 - 0.12, RAMP.z0 - 0.02, mat.yellow, L.ground, { cast: false });
  slab(-W2, W2, 0, 0.17, ROAD.z0 - 0.08, ROAD.z0, mat.curb); slab(-W2, RAMP.x0, 0, 0.17, ROAD.z1, ROAD.z1 + 0.08, mat.curb); slab(RAMP.x1, W2, 0, 0.17, ROAD.z1, ROAD.z1 + 0.08, mat.curb);
  // 경사로 벽
  slab(RAMP.x0 - 0.15, RAMP.x0, -RAMP.depth, 0.7, RAMP.z0, RAMP.z1, mat.concrete, L.ground);
  slab(RAMP.x1, RAMP.x1 + 0.15, -RAMP.depth, 0.7, RAMP.z0, RAMP.z1, mat.concrete, L.ground);
  slab(RAMP.x0 - 0.15, RAMP.x1 + 0.15, 1.9, 2.05, RAMP.z0, RAMP.z0 + 1.2, M(0x2b3440), L.ground);
  for (const x of [RAMP.x0 - 0.1, RAMP.x1 + 0.1]) slab(x - 0.05, x + 0.05, 0.7, 1.9, RAMP.z0 + 1.1, RAMP.z0 + 1.2, mat.pole);
  sign('P  지하주차장 · 출차주의', (RAMP.x0 + RAMP.x1) / 2, 1.72, RAMP.z0 - 0.03, 0.3, { bg: '#1d4f8a', fg: '#fff', fs: 46, width: 3.6, ry: Math.PI }, L.ground);
  rampWarn = nglow(GLOW(0xffb020, 0), 0, 0);
  cyl(0.12, 0.12, 0.12, rampWarn, RAMP.x1 - 0.2, 2.12, RAMP.z0 + 0.6, L.ground);
  // 볼록거울
  cyl(0.03, 0.03, 2.2, mat.pole, RAMP.x0 - 0.5, 1.25, ROAD.z1 + 0.5, L.ground, 6);
  const mir = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05 }));
  mir.rotation.x = Math.PI / 2; mir.rotation.z = -0.6; mir.position.set(RAMP.x0 - 0.5, 2.3, ROAD.z1 + 0.6); L.ground.add(mir);
  cyl(0.36, 0.36, 0.06, M(0xff8a20), RAMP.x0 - 0.5, 2.3, ROAD.z1 + 0.5, L.ground, 16).rotation.x = Math.PI / 2;
  step(6);

  // ── 북쪽: 학교
  slab(-W2, 0, 0, 0.05, -D2, 0, mat.paver2, L.ground, { cast: false });
  slab(-16.5, -4.5, 0.05, 0.08, -9.6, -1.3, mat.field, L.ground, { cast: false });
  const track = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.12, 40, 1), mat.white); track.rotation.x = -Math.PI / 2; track.scale.set(1.7, 1, 1); track.position.set(-10.5, 0.085, -5.45); L.ground.add(track);
  for (const x of [-15.6, -5.4]) { slab(x - 0.04, x + 0.04, 0.08, 1.1, -6.2, -4.7, mat.white); slab(x - 0.04, x + 0.04, 1.05, 1.1, -6.2, -4.7, mat.white); }
  // 울타리 + 정문
  for (let x = -W2 + 0.2; x < 0; x += 0.5) { if (x > CROSS_X - 1.3 && x < CROSS_X + 1.3) continue; slab(x, x + 0.05, 0.05, 0.8, -0.45, -0.4, M(0x2e6b4a)); }
  slab(-W2, CROSS_X - 1.3, 0.75, 0.8, -0.46, -0.39, M(0x2e6b4a)); slab(CROSS_X + 1.3, 0, 0.75, 0.8, -0.46, -0.39, M(0x2e6b4a));
  for (const x of [CROSS_X - 1.45, CROSS_X + 1.45]) slab(x - 0.18, x + 0.18, 0.05, 1.5, -0.6, -0.25, M(0x8d6e58));
  sign('인천가현초등학교', CROSS_X - 3.6, 0.55, -0.2, 0.42, { bg: '#e8e0cf', fg: '#2c2a26', fs: 60, lit: false, width: 2.4 }, L.ground).rotation.y = 0;
  slab(CROSS_X - 4.9, CROSS_X - 2.3, 0.05, 0.3, -0.35, -0.05, M(0x7d7f7a));
  // 본관 (ㄱ자)
  const school = { wall: '#e6dccb', band: 'rgba(120,60,40,0.25)', glass: '#34465a', lit: 0.62, cell: 0.7 };
  building({ x0: -21.2, x1: -5.2, z0: -15.2, z1: -11.0, floors: 4, fh: 1.05, ...school });
  building({ x0: -21.2, x1: -17.6, z0: -11.0, z1: -6.8, floors: 4, fh: 1.05, ...school });
  sign('인천가현초등학교', -13.2, 3.7, -10.98, 0.55, { bg: '#21314a', fg: '#ffffff', fs: 64 }, L.build);
  const clock = cyl(0.42, 0.42, 0.08, nglow(GLOW(0xfff6e0, 1), 1.2, 0.2), -9, 3.6, -10.95, L.build, 20); clock.rotation.x = Math.PI / 2;
  slab(-14, -12.4, 0, 0.9, -11.0, -10.2, M(0x9b7b64)); // 현관
  slab(-14.2, -12.2, 0.9, 1.0, -11.0, -10.0, mat.roof);
  // 체육관
  slab(-4.4, -0.4, 0, 2.2, -15.2, -9.4, M(0xb7a58f));
  for (let x = -4.2; x < -0.6; x += 0.6) slab(x, x + 0.4, 1.2, 1.9, -9.38, -9.36, nglow(GLOW(0xffe6b0, 1.2), 1.4, 0.0), L.build, { cast: false });
  const vg = new THREE.CylinderGeometry(2.05, 2.05, 5.8, 20, 1, false, -Math.PI / 2, Math.PI); vg.rotateX(-Math.PI / 2);
  const vault = new THREE.Mesh(vg, M(0x6f8fa8, { roughness: 0.4, metalness: 0.3 }));
  vault.position.set(-2.4, 2.2, -12.3); vault.scale.set(1, 0.45, 1); vault.castShadow = true; L.roof.add(vault);
  sign('가현 체육관', -2.4, 1.85, -9.36, 0.32, { bg: '#2d2a26', fg: '#ffd58a', fs: 50 }, L.build);
  // 국기 게양대, 나무
  for (const x of [-17, -16.4, -15.8]) cyl(0.03, 0.03, 2.6, mat.metal, x, 1.3, -10.3, L.ground, 6);
  for (const x of [-20.5, -19, -1.2]) tree(x, -2.5, 1.0, 1);
  for (let x = -20.5; x < -1; x += 2.4) tree(x, -0.9, 0.85, x < -10 ? 2 : 0);
  tree(-1, -5, 1.3, 0); tree(-19.5, -8, 1.1, 1);
  step(10);

  // ── 북동: 상가
  slab(0, 13, 0, 0.05, -D2, 0, mat.paver, L.ground, { cast: false });
  building({ x0: 1.5, x1: 12.5, z0: -6.6, z1: -1.4, floors: 3, fh: 1.15, wall: '#3a3438', glass: '#1e2a33', lit: 0.75, groundShop: true, cool: true, ni: 1.4 });
  // 1층 가게 (밝은 유리)
  const shops = [
    { name: '가현분식', bg: '#d8352a', fg: '#fff3c4', x0: 1.5, x1: 3.7 },
    { name: '24시 편의점', bg: '#1f8a4c', fg: '#ffffff', x0: 3.7, x1: 6.4 },
    { name: '튼튼약국', bg: '#ffffff', fg: '#1d8a5a', x0: 6.4, x1: 8.6 },
    { name: 'CAFE 루원', bg: '#2b1d16', fg: '#ffcf8a', x0: 8.6, x1: 10.6 },
    { name: '문구·완구', bg: '#2f5fb8', fg: '#ffffff', x0: 10.6, x1: 12.5 },
  ];
  for (const s of shops) {
    slab(s.x0 + 0.08, s.x1 - 0.08, 0.05, 0.95, -1.42, -1.38, nglow(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe2b5, emissiveIntensity: 0.9, roughness: 0.2 }), 0.9, 0.15), L.build, { cast: false });
    sign(s.name, (s.x0 + s.x1) / 2, 1.07, -1.33, 0.28, { bg: s.bg, fg: s.fg, fs: 52, width: s.x1 - s.x0 - 0.15 });
    const aw = slab(s.x0 + 0.05, s.x1 - 0.05, 0.92, 0.96, -1.38, -0.9, M(new THREE.Color(s.bg).lerp(new THREE.Color(0x000000), 0.15)));
    aw.rotation.x = 0.18;
  }
  sign('아동안전지킴이집', 5.05, 0.78, -1.32, 0.16, { bg: '#ffd400', fg: '#1a1410', fs: 44, width: 0.9 });
  sign('태권도', 4, 2.2, -1.33, 0.36, { bg: '#111', fg: '#ff4a3a', fs: 64, glow: true, ry: 0 }, L.build);
  sign('수학·영어 학원', 9.2, 3.35, -1.33, 0.34, { bg: '#111', fg: '#62d6ff', fs: 56, glow: true }, L.build);
  sign('PC방', 12.62, 2.6, -3.6, 0.5, { bg: '#1a0f2a', fg: '#e78bff', fs: 70, glow: true, ry: Math.PI / 2 }, L.build);
  sign('노래방', 1.38, 2.6, -3.4, 0.5, { bg: '#1a0f0f', fg: '#ffd04a', fs: 70, glow: true, ry: -Math.PI / 2 }, L.build);
  for (let i = 0; i < 3; i++) slab(1.8 + i * 3.6, 2.6 + i * 3.6, 3.45, 3.85, -6.2, -4.4, M(0x9aa0a6, { metalness: 0.5 }), L.roof); // 실외기
  cyl(0.5, 0.5, 0.9, M(0x6c8fb2), 11, 3.9, -5, L.roof, 12);
  // 뒤쪽 아파트 2동 (루원시티)
  const apt = { wall: '#d9d2c6', glass: '#293845', lit: 0.4, balcony: true, cell: 0.62, band: 'rgba(0,0,0,0.18)' };
  for (const [x0, x1, nm] of [[2.2, 6.6, '루원시티 101'], [7.4, 11.8, '루원시티 102']]) {
    const b = building({ x0, x1, z0: -15.2, z1: -9.6, floors: 12, fh: 0.95, ...apt });
    const cx = (x0 + x1) / 2;
    slab(x0 + 0.4, x1 - 0.4, b.top, b.top + 1.0, -14, -11.2, M(0x8d8780), L.roof);
    sign(nm, cx, b.top + 0.55, -11.18, 0.46, { bg: '#15161a', fg: '#ffffff', fs: 60 }, L.roof);
  }
  step(8);

  // ── 공사장
  slab(SITE.x0, W2, 0, 0.06, -D2, -1.4, M(0x7a5a3e, { roughness: 1 }), L.ground, { cast: false });
  const fenceTex = signTex('안전제일 · 공사중 · 안전제일', { bg: '#f2c230', fg: '#1a1410', fs: 60 });
  const fm = new THREE.MeshStandardMaterial({ map: fenceTex.tex, roughness: 0.8 });
  slab(SITE.x0, W2 - 0.2, 0.05, 0.95, SITE.z1 - 0.06, SITE.z1, fm); slab(SITE.x0 - 0.06, SITE.x0, 0.05, 0.95, SITE.z0, SITE.z1, fm);
  for (let x = SITE.x0 + 1; x < W2 - 0.5; x += 2.2) for (let z = SITE.z0 + 1; z < SITE.z1 - 2.5; z += 2.4) for (let f = 0; f < 4; f++) {
    slab(x - 0.12, x + 0.12, f * 1.2, f * 1.2 + 1.2, z - 0.12, z + 0.12, M(0xa9a39a), L.build);
  }
  for (let f = 1; f <= 4; f++) slab(SITE.x0 + 0.8, W2 - 0.5, f * 1.2 - 0.12, f * 1.2, SITE.z0 + 0.8, SITE.z1 - 2.2, M(0x9c968c), L.build);
  for (let x = SITE.x0 + 0.7; x < W2 - 0.4; x += 0.8) { slab(x, x + 0.03, 0, 5, SITE.z1 - 2.1, SITE.z1 - 2.07, mat.pole, L.build, { cast: false }); }
  for (let y = 0.6; y < 5; y += 0.6) slab(SITE.x0 + 0.7, W2 - 0.4, y, y + 0.03, SITE.z1 - 2.1, SITE.z1 - 2.05, mat.pole, L.build, { cast: false });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(W2 - 0.4 - SITE.x0 - 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x2f7a5a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  net.position.set((SITE.x0 + 0.7 + W2 - 0.4) / 2, 2.5, SITE.z1 - 2.0); L.build.add(net);
  // 타워크레인
  crane = new THREE.Group(); crane.position.set(19.8, 0, -13.6);
  for (let y = 0; y < 13; y += 0.5) { box(0.5, 0.04, 0.04, M(0xf2c230), 0, y, 0.25, crane); box(0.5, 0.04, 0.04, M(0xf2c230), 0, y, -0.25, crane); box(0.04, 0.04, 0.5, M(0xf2c230), 0.25, y, 0, crane); box(0.04, 0.04, 0.5, M(0xf2c230), -0.25, y, 0, crane); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.06, 13, 0.06, M(0xf2c230), sx * 0.25, 6.5, sz * 0.25, crane);
  craneTop = new THREE.Group(); craneTop.position.y = 13; crane.add(craneTop);
  box(11, 0.3, 0.35, M(0xf2c230), -3.5, 0, 0, craneTop); box(1.2, 0.8, 0.8, M(0xe8e0d0), 0.2, -0.5, 0, craneTop); box(1, 0.7, 0.6, M(0x6c7178), 2.2, -0.2, 0, craneTop);
  craneHook = new THREE.Group(); craneHook.position.set(-6, 0, 0); craneTop.add(craneHook);
  craneCable = box(0.02, 1, 0.02, mat.pole, 0, -0.5, 0, craneHook); craneLoad = box(1.2, 0.18, 0.4, M(0xb35a2e), 0, -6, 0, craneHook);
  craneBeacon = nglow(GLOW(0xff2a1a, 3), 3, 0.5); box(0.14, 0.14, 0.14, craneBeacon, -9, 0.25, 0, craneTop, { cast: false });
  L.roof.add(crane);
  const ex = new THREE.Group(); ex.position.set(15, 0.05, -4.2); ex.rotation.y = 0.6;
  box(1.2, 0.35, 0.8, M(0x2c2b31), 0, 0.2, 0, ex); box(0.9, 0.55, 0.7, M(0xf2a52a), 0, 0.65, 0, ex); const arm = box(1.4, 0.14, 0.14, M(0xf2a52a), 0.9, 1.1, 0, ex); arm.rotation.z = 0.5;
  L.ground.add(ex);
  sign('공사중 위험', SITE.x0 + 1.6, 1.3, SITE.z1 + 0.04, 0.32, { bg: '#d42a22', fg: '#fff', fs: 54 }, L.ground);
  step(8);

  // ── 버스정류장
  const bs = new THREE.Group(); bs.position.set(18.4, 0.15, 0.6); L.ground.add(bs);
  box(2.6, 0.06, 0.9, M(0x2b3440), 0, 1.5, 0, bs); box(2.6, 1.3, 0.04, mat.glass, 0, 0.8, -0.42, bs);
  box(0.6, 1.2, 0.06, nglow(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9fd6ff, emissiveIntensity: 1.6 }), 1.8, 0.4), -1.0, 0.8, -0.38, bs);
  box(1.6, 0.06, 0.32, mat.wood, 0.3, 0.45, -0.22, bs);
  for (const x of [-1.25, 1.25]) box(0.06, 1.5, 0.06, mat.pole, x, 0.75, 0.38, bs);
  sign('가현초등학교 정류장', 18.4, 1.95, 1.08, 0.24, { bg: '#1d4f8a', fg: '#fff', fs: 42 }, L.ground);

  // ── 신호등
  sigMats = { carR: GLOW(0xff2a1a, 0), carY: GLOW(0xffb020, 0), carG: GLOW(0x22ff88, 0), pedR: GLOW(0xff2a1a, 0), pedG: GLOW(0x22ff88, 0) };
  for (const [x, z, ry] of [[CROSS_X - 1.9, 1.6, Math.PI], [CROSS_X + 1.9, 8.4, 0]]) {
    const g = new THREE.Group(); g.position.set(x, 0.15, z); g.rotation.y = ry; L.ground.add(g);
    cyl(0.05, 0.05, 3.1, mat.pole, 0, 1.55, 0, g, 6);
    box(0.05, 0.05, 1.3, mat.pole, 0, 3.0, 0.65, g);
    const hb = box(0.22, 0.24, 0.7, M(0x22242a), 0, 3.0, 1.2, g);
    box(0.02, 0.16, 0.16, sigMats.carR, 0.12, 3.0, 1.43, g, { cast: false }); box(0.02, 0.16, 0.16, sigMats.carY, 0.12, 3.0, 1.2, g, { cast: false }); box(0.02, 0.16, 0.16, sigMats.carG, 0.12, 3.0, 0.97, g, { cast: false });
    box(0.2, 0.5, 0.2, M(0x22242a), 0, 1.7, 0, g);
    box(0.02, 0.18, 0.15, sigMats.pedR, -0.11, 1.82, 0, g, { cast: false }); box(0.02, 0.18, 0.15, sigMats.pedG, -0.11, 1.58, 0, g, { cast: false });
    hb.castShadow = true;
  }
  // 30 표지판
  for (const [x, z] of [[-13.5, 1.5], [7.5, 8.5]]) { cyl(0.03, 0.03, 2, mat.pole, x, 1.15, z, L.ground, 6); const s = cyl(0.3, 0.3, 0.04, M(0xffffff), x, 2.2, z, L.ground, 20); s.rotation.x = Math.PI / 2; sign('30', x, 2.2, z + 0.03, 0.3, { bg: '#ffffff', fg: '#d42a22', fs: 70, lit: false, width: 0.36 }, L.ground); }
  // 가로등·가로수
  for (let x = -19; x < 21; x += 6) { lamp(x, 0.4, -Math.PI / 2, Math.abs(x) < 14); lamp(x + 3, 9.6, Math.PI / 2, Math.abs(x) < 14); }
  for (let x = -20; x < 21; x += 6) { if (Math.abs(x - CROSS_X) > 2) tree(x + 1.5, 1.4, 0.75, 0); }
  step(6);

  // ── 남쪽: 공원, 놀이터, 경비실, 아파트
  slab(-W2, -10.6, 0, 0.06, RAMP.z0, D2, mat.grass, L.ground, { cast: false });
  slab(-10.4, -2.2, 0, 0.08, RAMP.z0 + 0.3, D2 - 0.3, mat.rubberG, L.ground, { cast: false });
  slab(-9, -5.4, 0.08, 0.085, RAMP.z0 + 1.2, RAMP.z0 + 3.6, mat.rubberO, L.ground, { cast: false });
  slab(-2.2, RAMP.x0, 0, 0.05, RAMP.z0, D2, mat.paver2, L.ground, { cast: false });
  slab(RAMP.x1, W2, 0, 0.05, RAMP.z0, D2, mat.paver2, L.ground, { cast: false });
  // 산책길
  const path = M(0xc7b59a, { roughness: 0.95 }); snowy(path);
  slab(-21.6, -11, 0.06, 0.09, 11.2, 11.9, path, L.ground, { cast: false }); slab(-16.6, -15.9, 0.06, 0.09, 10, 15.8, path, L.ground, { cast: false });
  // 연못 + 물레방아
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.0, 28), mat.water); pond.rotation.x = -Math.PI / 2; pond.position.set(-19.2, 0.07, 14); pond.scale.set(1, 0.7, 1); L.ground.add(pond);
  wheel = new THREE.Group(); wheel.position.set(-17.6, 0.9, 14.2); wheel.rotation.y = Math.PI / 2; L.ground.add(wheel);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 6, 20), mat.wood); wheel.add(rim2);
  for (let i = 0; i < 8; i++) { const b = box(0.08, 1.6, 0.3, mat.wood, 0, 0, 0, wheel); b.rotation.z = i * Math.PI / 8; }
  slab(-17.9, -17.3, 0.06, 1.2, 13.3, 13.4, mat.wood); slab(-17.9, -17.3, 0.06, 1.2, 15.0, 15.1, mat.wood);
  for (const [x, z, s, k] of [[-21, 10.6, 1.1, 0], [-18.5, 10.5, 0.9, 1], [-13.5, 10.6, 1.2, 2], [-12, 13, 1, 0], [-14.2, 15.3, 0.9, 1], [-21.2, 12.8, 0.8, 2]]) tree(x, z, s, k);
  bench(-13.8, 12.6, 0); bench(-19.5, 11.6, 0);
  // 놀이기구
  const slide = new THREE.Group(); slide.position.set(-8, 0.08, 13.6); L.ground.add(slide);
  box(1, 1.2, 1, M(0xf2c230), 0, 0.6, 0, slide); box(1.1, 0.12, 1.1, M(0xe0543a), 0, 1.26, 0, slide);
  const sl = box(0.6, 0.06, 2.0, M(0x2f8ad0), 0, 0.68, 1.35, slide); sl.rotation.x = 0.62;
  for (let i = 0; i < 4; i++) box(0.6, 0.05, 0.22, mat.wood, 0, 0.25 + i * 0.28, -0.62 - i * 0.12, slide);
  const sw = new THREE.Group(); sw.position.set(-4.4, 0.08, 14.3); L.ground.add(sw);
  for (const x of [-1.1, 1.1]) { const p = box(0.08, 1.7, 0.08, M(0xd42a22), x, 0.85, 0, sw); }
  box(2.3, 0.08, 0.08, M(0xd42a22), 0, 1.7, 0, sw);
  swings = [];
  for (const x of [-0.5, 0.5]) { const pv = new THREE.Group(); pv.position.set(x, 1.68, 0); sw.add(pv); box(0.02, 1.2, 0.02, mat.pole, -0.15, -0.6, 0, pv); box(0.02, 1.2, 0.02, mat.pole, 0.15, -0.6, 0, pv); box(0.38, 0.05, 0.2, M(0x2c2b31), 0, -1.2, 0, pv); swings.push(pv); }
  const saw = box(2.2, 0.08, 0.22, M(0x46a36b), -7.2, 0.45, 11.3, L.ground); saw.rotation.z = 0.18; seesaw = saw; box(0.2, 0.35, 0.2, mat.dark, -7.2, 0.25, 11.3);
  duck = new THREE.Group(); duck.position.set(-4, 0.1, 11.6); L.ground.add(duck);
  cyl(0.03, 0.03, 0.4, mat.metal, 0, 0.2, 0, duck, 6); const db = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), M(0xf2c230)); db.position.y = 0.5; db.scale.set(1.3, 0.8, 0.8); duck.add(db); const dh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), M(0xf2c230)); dh.position.set(0.32, 0.8, 0); duck.add(dh); box(0.14, 0.05, 0.1, M(0xe0743a), 0.5, 0.78, 0, duck);
  // 경비실
  const booth = slab(-1.4, 1.6, 0.05, 1.3, 11.2, 12.8, M(0xe6dccb)); slab(-1.5, 1.7, 1.3, 1.42, 11.1, 12.9, mat.roof);
  slab(-1.2, 0.6, 0.6, 1.1, 11.18, 11.2, nglow(new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xfff0c8, emissiveIntensity: 1.3 }), 1.4, 0.2), L.ground, { cast: false });
  sign('경비실', 0.1, 1.55, 11.08, 0.22, { bg: '#21314a', fg: '#fff', fs: 46 }, L.ground);
  // 작은도서관 + 아파트 단지 정문
  building({ x0: 8, x1: 20.4, z0: 11.6, z1: 15.2, floors: 2, fh: 1.15, wall: '#c9b79c', glass: '#2a3a4a', lit: 0.7, cell: 0.8, roofMat: mat.roofG });
  sign('루원 작은도서관', 14.2, 1.7, 11.57, 0.36, { bg: '#2c4a3a', fg: '#ffffff', fs: 56 }, L.build);
  slab(13.2, 15.2, 0.05, 1.0, 11.5, 11.62, nglow(new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffe9c0, emissiveIntensity: 1 }), 1, 0.2), L.build, { cast: false });
  slab(12.8, 15.6, 1.0, 1.1, 10.6, 11.6, M(0x2b3440), L.build);
  for (const x of [8.6, 11.4]) slab(x - 0.25, x + 0.25, 0.05, 1.6, 10.5, 10.9, M(0x8d7a66));
  slab(8.35, 11.65, 1.6, 1.85, 10.45, 10.95, M(0x5a4a3c));
  sign('루원시티 단지 정문', 10, 1.72, 10.42, 0.2, { bg: '#5a4a3c', fg: '#ffe9c0', fs: 44, width: 3.0 }, L.ground);
  slab(13.4, 14.6, 0.05, 0.6, 12, 14.6, mat.leaf2);
  for (const [x, z] of [[7.4, 15.4], [14, 15.5], [21, 11], [7.2, 10.8]]) tree(x, z, 0.9, 0);
  step(10);
}
const puddles = [];
let rampWarn, crane, craneTop, craneHook, craneCable, craneLoad, craneBeacon, wheel, swings = [], seesaw, duck, sigMats;
function bench(x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0.06, z); g.rotation.y = ry; L.ground.add(g); box(1.1, 0.06, 0.32, mat.wood, 0, 0.32, 0, g); box(1.1, 0.26, 0.05, mat.wood, 0, 0.5, -0.15, g); for (const sx of [-0.45, 0.45]) box(0.05, 0.3, 0.3, mat.pole, sx, 0.15, 0, g); }

/* ───────────── 레이어 설명표 (분해도) ───────────── */
function layerTags() {
  const tags = [
    ['under', -3, 'LAYER 01 · B1', '지하주차장 · 땅속', '경사로를 올라온 차는 운전석에서 어린이가 잘 안 보여요.'],
    ['ground', 0.4, 'LAYER 02 · 지면', '도로 · 인도 · 스쿨존', '빨간 길은 어린이 보호구역. 횡단보도 · 신호등 · 정류장.'],
    ['build', 3, 'LAYER 03 · 건물', '학교 · 상가 · 아파트', '아동안전지킴이집(편의점), 공사장, 경비실을 찾아봐요.'],
    ['roof', 6, 'LAYER 04 · 옥상', '간판 · 크레인 · 옥상', '번개는 높은 곳에 떨어져요. 크레인 아래는 위험 구역!'],
  ];
  for (const [k, y, sm, b, s] of tags) {
    const d = document.createElement('div'); d.className = 'layer-tag'; d.innerHTML = `<small>${sm}</small><b>${b}</b><span>${s}</span>`;
    const o = new CSS2DObject(d); o.position.set(-W2 - 9, y, 0); L[k].add(o);
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W2 - 3.5, y, 0), new THREE.Vector3(-W2 + 0.5, y, 0)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd9a55b, transparent: true, opacity: 0 })); L[k].add(line); layerLines.push(line);
  }
}
const layerLines = [];

/* ───────────── 날씨 ───────────── */
const env = { weather: 'rain', time: 'night', haze: 0 };
const wx = { rain: 1, snow: 0, day: 0, haze: 0 }; // 부드럽게 바뀌는 값
const BOX = { x: W2, y0: 0, y1: 22, z: D2 };
let rain, snow, splashes;
function buildWeather() {
  const N = MOBILE ? 1400 : 3200;
  const rp = new Float32Array(N * 6), rv = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = rand(-BOX.x, BOX.x), y = rand(0, BOX.y1), z = rand(-BOX.z, BOX.z); rp.set([x, y, z, x - 0.02, y - 0.4, z + 0.01], i * 6); rv[i] = rand(22, 30); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb0d6, transparent: true, opacity: 0.3 })); rain.userData.v = rv; rain.frustumCulled = false; root.add(rain);
  const S = MOBILE ? 900 : 2000; const sp = new Float32Array(S * 3), sv = new Float32Array(S);
  for (let i = 0; i < S; i++) { sp.set([rand(-BOX.x, BOX.x), rand(0, BOX.y1), rand(-BOX.z, BOX.z)], i * 3); sv[i] = rand(0, 6); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sc = CAN(32, 32), g = sc.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.22, map: texOf(sc), transparent: true, depthWrite: false, opacity: 0 })); snow.userData.v = sv; snow.frustumCulled = false; root.add(snow);
  // 빗방울 튀김
  const R = 160; splashes = new THREE.InstancedMesh(new THREE.RingGeometry(0.03, 0.045, 10), new THREE.MeshBasicMaterial({ color: 0xc9d6f0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }), R);
  splashes.userData.t = new Float32Array(R).map(() => Math.random()); splashes.userData.p = Array.from({ length: R }, () => new THREE.Vector3(rand(-BOX.x, BOX.x), 0.06, rand(-1, 10)));
  splashes.frustumCulled = false; L.ground.add(splashes);
}
const dummy = new THREE.Object3D();
const bgTex = { night: null, day: null, cur: null };
function gradientTex(a, b, c) { const cv = CAN(4, 256), g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(0.55, b); gr.addColorStop(1, c); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = texOf(cv); return t; }
function setEnv(k, v) {
  env[k] = v;
  document.querySelectorAll('#seg-weather button').forEach((b) => b.classList.toggle('on', b.dataset.w === env.weather));
  document.querySelectorAll('#seg-time button').forEach((b) => b.classList.toggle('on', b.dataset.t === env.time));
  document.body.classList.toggle('day', env.time === 'day');
  audio.update();
}
const colNight = new THREE.Color(0x1a1420), colDay = new THREE.Color(0xc9d3d6), colSnowDay = new THREE.Color(0xdfe5ea), colHaze = new THREE.Color(0xb8a77a), tmpC = new THREE.Color();
const snowWhite = new THREE.Color(0xf4f6fa);
function updateWeather(dt, t) {
  const k = 1 - Math.exp(-dt * 1.6);
  wx.rain = lerp(wx.rain, env.weather === 'rain' ? 1 : 0, k);
  wx.snow = lerp(wx.snow, env.weather === 'snow' ? 1 : 0, k * 0.7);
  wx.day = lerp(wx.day, env.time === 'day' ? 1 : 0, k);
  wx.haze = lerp(wx.haze, env.haze, k);
  const day = wx.day, night = 1 - day;
  // 배경·안개
  tmpC.copy(colNight).lerp(env.weather === 'snow' ? colSnowDay : colDay, day).lerp(colHaze, wx.haze * 0.8);
  if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color();
  scene.background.copy(tmpC);
  scene.fog = scene.fog || new THREE.FogExp2(0x000000, 0.004);
  scene.fog.color.copy(tmpC); scene.fog.density = 0.0035 + wx.rain * 0.002 + wx.snow * 0.003 + wx.haze * 0.018;
  // 빛
  hemi.intensity = 0.35 + day * 1.4 - wx.rain * 0.15 * day;
  hemi.color.setHex(0x9aa7ff).lerp(new THREE.Color(0xffffff), day);
  hemi.groundColor.setHex(0x2a2030).lerp(new THREE.Color(0x8a8070), day);
  sun.intensity = 0.55 + day * (2.4 - wx.rain * 1.2 - wx.snow * 0.8);
  sun.color.setHex(0x8fa0ff).lerp(new THREE.Color(0xfff1dc), day);
  renderer.toneMappingExposure = 1.0 + day * 0.05;
  bloom.strength = 0.15 + night * 0.5;
  bloom.threshold = 0.82 + day * 0.15;
  scene.environment && (scene.environmentIntensity = 0.25 + day * 0.6);
  for (const [m, n, d] of nightGlow) m.emissiveIntensity = lerp(d, n, night);
  for (const p of lampLights) p.intensity = night * 6;
  for (const m of carLights) m.emissiveIntensity = 0.6 + night * 2.4;
  // 젖은 땅, 눈 덮인 땅
  for (const m of wetMats) { m.roughness = lerp(m.userData.dryR, 0.22, wx.rain); m.metalness = wx.rain * 0.25; }
  for (const m of snowMats) { m.color.copy(m.userData.base).lerp(snowWhite, wx.snow * 0.85); }
  for (const p of puddles) p.material.opacity = wx.rain * 0.85;
  // 비
  rain.visible = wx.rain > 0.02; rain.material.opacity = 0.28 * wx.rain * (0.7 + night * 0.3);
  if (rain.visible) {
    const a = rain.geometry.attributes.position.array, v = rain.userData.v, n = v.length;
    for (let i = 0; i < n; i++) { const o = i * 6, dy = v[i] * dt; a[o + 1] -= dy; a[o + 4] -= dy; if (a[o + 4] < 0) { const x = rand(-BOX.x, BOX.x), z = rand(-BOX.z, BOX.z), y = BOX.y1 + rand(0, 4); a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x - 0.02; a[o + 4] = y - 0.4; a[o + 5] = z + 0.01; } }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  splashes.visible = wx.rain > 0.1;
  if (splashes.visible) {
    const T = splashes.userData.t, P = splashes.userData.p;
    for (let i = 0; i < T.length; i++) { T[i] += dt * 2.2; if (T[i] > 1) { T[i] = 0; P[i].set(rand(-BOX.x, BOX.x), Math.random() < 0.5 ? 0.045 : 0.165, rand(-0.5, 10.5)); if (P[i].z > ROAD.z0 && P[i].z < ROAD.z1) P[i].y = 0.045; }
      dummy.position.copy(P[i]); dummy.rotation.set(-Math.PI / 2, 0, 0); const s = 0.4 + T[i] * 1.6; dummy.scale.set(s, s, s); dummy.updateMatrix(); splashes.setMatrixAt(i, dummy.matrix); }
    splashes.instanceMatrix.needsUpdate = true; splashes.material.opacity = 0.35 * wx.rain * (1 - T[0] * 0);
  }
  // 눈
  snow.visible = wx.snow > 0.02; snow.material.opacity = wx.snow;
  if (snow.visible) {
    const a = snow.geometry.attributes.position.array, v = snow.userData.v, n = v.length;
    for (let i = 0; i < n; i++) { const o = i * 3; a[o + 1] -= dt * 1.6; a[o] += Math.sin(t * 0.8 + v[i]) * dt * 0.35; if (a[o + 1] < 0) { a[o] = rand(-BOX.x, BOX.x); a[o + 1] = BOX.y1; a[o + 2] = rand(-BOX.z, BOX.z); } }
    snow.geometry.attributes.position.needsUpdate = true;
  }
  for (const u of umbrellas) u.visible = wx.rain > 0.4;
  tilt.uniforms.amount.value = view === 'street' ? 0.6 : 1.0;
}

/* ───────────── 소리 (WebAudio로 직접 만듦) ───────────── */
const audio = (() => {
  let ctx = null, on = false, rainG, master;
  function init() {
    if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2 + w * 0.08; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    rainG = ctx.createGain(); rainG.gain.value = 0; src.connect(f).connect(rainG).connect(master); src.start();
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!ctx || !on) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
    const t0 = ctx.currentTime + delay; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    toggle() { init(); on = !on; if (ctx.state === 'suspended') ctx.resume(); $('snd').textContent = on ? '🔊' : '🔇'; this.update(); },
    update() { if (!ctx) return; rainG.gain.setTargetAtTime(on ? (env.weather === 'rain' ? 0.32 : 0) : 0, ctx.currentTime, 0.6); },
    good() { tone(660, 0.18, 'triangle'); tone(880, 0.25, 'triangle', 0.15, 0.12); tone(1320, 0.3, 'triangle', 0.1, 0.24); },
    bad() { tone(220, 0.3, 'square', 0.07); tone(180, 0.35, 'square', 0.07, 0.15); },
    click() { tone(900, 0.06, 'sine', 0.08); },
    thunder() { if (!ctx || !on) return; const len = ctx.sampleRate * 2.5, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = (l + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = l * 6 * Math.pow(1 - i / len, 2); } const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; s.connect(f).connect(master); s.start(); },
    siren(on2) { /* 시각 효과만 */ },
  };
})();

/* ───────────── 교통 ───────────── */
const cars = [];
const sig = { phase: 'carG', t: 0 };
const PHASES = { carG: [11, 'carY'], carY: [2.2, 'allR'], allR: [1, 'pedG'], pedG: [9, 'pedBlink'], pedBlink: [3, 'allR2'], allR2: [1, 'carG'] };
function carsCanGo() { return sig.phase === 'carG' || sig.phase === 'carY'; }
function pedCanGo() { return sig.phase === 'pedG' || sig.phase === 'pedBlink'; }
function updateSignals(dt, t) {
  sig.t += dt;
  if (!sig.hold && sig.t > PHASES[sig.phase][0]) { sig.phase = PHASES[sig.phase][1]; sig.t = 0; }
  const s = sigMats, on = 3.2;
  s.carG.emissiveIntensity = sig.phase === 'carG' ? on : 0;
  s.carY.emissiveIntensity = sig.phase === 'carY' ? on : 0;
  s.carR.emissiveIntensity = !carsCanGo() ? on : 0;
  s.pedG.emissiveIntensity = sig.phase === 'pedG' || (sig.phase === 'pedBlink' && Math.sin(t * 12) > 0) ? on : 0;
  s.pedR.emissiveIntensity = !pedCanGo() ? on : 0;
}
function spawnCar(dir, kind, at, o = {}) {
  const g = car(kind); const lane = dir > 0 ? LANE_E : LANE_W;
  g.position.set(at, 0.03, lane); g.rotation.y = dir > 0 ? 0 : Math.PI;
  L.ground.add(g);
  const c = { g, dir, x: at, v: o.v ?? 5, vmax: o.vmax ?? rand(4.5, 6.5), len: g.userData.len, kind, ...o };
  cars.push(c); return c;
}
function removeCar(c) { L.ground.remove(c.g); cars.splice(cars.indexOf(c), 1); }
let carTimer = { 1: 1, '-1': 2 };
function updateTraffic(dt, t) {
  for (const d of [1, -1]) { carTimer[d] -= dt; if (carTimer[d] <= 0) { carTimer[d] = rand(2.2, 4.5); const start = -d * (W2 + 2); if (!cars.some((c) => c.dir === d && Math.abs(c.x - start) < 4)) spawnCar(d, Math.random() < 0.15 ? 'taxi' : Math.random() < 0.08 ? 'truck' : 'car', start); } }
  for (const c of [...cars]) {
    let target = c.vmax;
    const front = c.x + c.dir * c.len / 2;
    // 신호
    const stopX = c.dir > 0 ? CROSS_X - 2.2 : CROSS_X + 2.2;
    const toStop = (stopX - front) * c.dir;
    if (!carsCanGo() && toStop > -0.2 && toStop < 6) target = Math.min(target, Math.max(0, toStop - 0.15) * 1.6);
    if (sig.phase === 'carY' && toStop > 0 && toStop < 3) target = Math.min(target, Math.max(0, toStop - 0.15) * 1.6);
    if (c.stopAt != null) { const ts = (c.stopAt - c.x) * c.dir; target = Math.min(target, Math.max(0, ts) * 1.4); if (ts < 0.05) { c.arrived = true; } }
    if (c.hold > 0) { c.hold -= dt; target = 0; if (c.hold <= 0) { c.stopAt = null; c.arrived = false; } }
    // 앞차
    for (const o of cars) { if (o === c || o.dir !== c.dir) continue; const gap = (o.x - c.x) * c.dir - (o.len + c.len) / 2; if (gap > -0.5 && gap < 5) target = Math.min(target, Math.max(0, gap - 0.6) * 1.5); }
    c.v = lerp(c.v, target, 1 - Math.exp(-dt * 3));
    c.x += c.v * dt * c.dir;
    c.g.position.x = c.x;
    c.g.visible = Math.abs(c.x) < W2 - c.len / 2;
    if (c.g.userData.beacons) { const b = Math.sin(t * 14) > 0; c.g.userData.beacons[0].emissiveIntensity = b ? 5 : 0.2; c.g.userData.beacons[1].emissiveIntensity = b ? 0.2 : 5; }
    if (c.g.userData.hazard) c.g.userData.hazard[0].emissiveIntensity = Math.sin(t * 6) > 0 ? 3 : 0;
    if (c.x * c.dir > W2 + 3 && !c.keep) removeCar(c);
  }
}
// 지하주차장 출차 차량: 주차장 안 → 경사로 → 인도 앞 멈춤 → 차도
const gcar = { g: null, s: 0, wait: 3, stop: 0, peds: false };
const rampY = (z) => -RAMP.depth * clamp((z - RAMP.z0) / (RAMP.z1 - RAMP.z0), 0, 1);
const AISLE = 15.2, SEG = { a: 10.4, b: 1.2, c: RAMP.z1 - 10.9 };
function updateGarageCar(dt, t) {
  if (!gcar.g) {
    rampWarn.emissiveIntensity = 0;
    gcar.wait -= dt; if (gcar.wait > 0) return;
    gcar.g = car('car'); gcar.g.rotation.order = 'YXZ'; L.under.add(gcar.g); gcar.s = 0; gcar.stop = 0; gcar.waited = false;
  }
  const g = gcar.g;
  if (gcar.stop > 0) { gcar.stop -= dt; if (gcar.peds) gcar.stop = Math.max(gcar.stop, 0.3); }
  else gcar.s += dt * 2.6;
  const s = gcar.s, y0 = GARAGE.y0 + 0.04;
  if (s < SEG.a) { g.position.set(lerp(16, 5.6, s / SEG.a), y0, AISLE); g.rotation.set(0, Math.PI, 0); }
  else if (s < SEG.a + SEG.b) { const k = (s - SEG.a) / SEG.b; g.position.set(lerp(5.6, 4.75, k), y0, lerp(AISLE, RAMP.z1, k)); g.rotation.set(0, Math.PI - k * Math.PI / 2, 0); }
  else if (s < SEG.a + SEG.b + SEG.c) { const k = (s - SEG.a - SEG.b) / SEG.c; const z = lerp(RAMP.z1, 10.9, k); g.position.set(4.75, rampY(z) + 0.04, z); g.rotation.set(0, Math.PI / 2, Math.atan2(RAMP.depth, RAMP.z1 - RAMP.z0)); }
  else {
    if (!gcar.waited) { gcar.waited = true; gcar.stop = 2.6; }
    if (g.parent !== L.ground) { L.under.remove(g); L.ground.add(g); }
    const z = 10.9 - (s - SEG.a - SEG.b - SEG.c);
    g.position.set(4.75, z > RAMP.z0 ? rampY(z) + 0.04 : 0.07, z); g.rotation.set(0, Math.PI / 2, z > RAMP.z0 ? Math.atan2(RAMP.depth, RAMP.z1 - RAMP.z0) : 0);
    if (z < 7.0) { L.ground.remove(g); spawnCar(1, 'car', 4.75, { v: 1.2 }); gcar.g = null; gcar.wait = rand(8, 13); }
  }
  rampWarn.emissiveIntensity = gcar.g && s > SEG.a ? (Math.sin(t * 10) > 0 ? 4 : 0) : 0;
}

// 걸어 다니는 사람들
const walkers = [];
function spawnWalkers() {
  const routes = [
    { z: 0.9, x0: -21, x1: 21 }, { z: 1.4, x0: 21, x1: -21 }, { z: 8.7, x0: -21, x1: 21 }, { z: 9.3, x0: 21, x1: -21 },
  ];
  for (let i = 0; i < (MOBILE ? 10 : 18); i++) {
    const r = routes[i % routes.length]; const kid = Math.random() < 0.55;
    const p = person({ kid, bag: !kid && Math.random() < 0.3 });
    const w = { g: p, z: r.z + rand(-0.15, 0.15), dir: Math.sign(r.x1 - r.x0), x: rand(-20, 20), v: kid ? rand(0.9, 1.3) : rand(0.8, 1.1), mode: 'walk', y: 0.15 };
    p.position.set(w.x, 0.15, w.z); L.ground.add(p); walkers.push(w);
  }
  // 횡단보도 건너는 아이들
  for (let i = 0; i < 4; i++) {
    const p = person({ kid: true }); const w = { g: p, cross: true, side: i % 2 ? 1 : -1, x: CROSS_X + rand(-1, 1), z: i % 2 ? 0.8 : 9.0, v: rand(1.0, 1.3), wait: rand(0, 5), y: 0.15 };
    p.position.set(w.x, 0.15, w.z); L.ground.add(p); walkers.push(w);
  }
}
function updateWalkers(dt, t) {
  for (const w of walkers) {
    let moving = false;
    if (w.cross) {
      if (w.state !== 'go') { w.wait -= dt; if (pedCanGo() && sig.phase === 'pedG' && w.wait < 0) w.state = 'go'; }
      if (w.state === 'go') {
        const tz = w.side < 0 ? 9.0 : 0.8; const d = tz - w.z; if (Math.abs(d) < 0.05) { w.state = 'wait'; w.side *= -1; w.wait = rand(3, 8); } else { w.z += Math.sign(d) * w.v * dt; moving = true; w.g.rotation.y = d > 0 ? 0 : Math.PI; }
        w.y = w.z > ROAD.z0 && w.z < ROAD.z1 ? 0.035 : 0.15;
        w.g.userData.handUp = w.y < 0.1;
      }
      w.g.position.set(w.x, w.y, w.z);
    } else {
      w.x += w.dir * w.v * dt; moving = true;
      if (w.x > 21.2) w.x = -21.2; if (w.x < -21.2) w.x = 21.2;
      // 주차장 출입구 앞에서 차가 나오면 멈춤
      const nearRamp = w.z > 8 && w.x > RAMP.x0 - 0.6 && w.x < RAMP.x1 + 0.6;
      const atRamp = nearRamp ? 0.065 : 0.15;
      if (gcar.g && gcar.g.parent === L.ground && w.z > 8 && Math.abs(w.x - 4.75) < 2.2 && Math.abs(w.x - 4.75) > 1.4 && (4.75 - w.x) * w.dir > 0) { w.x -= w.dir * w.v * dt; moving = false; }
      w.g.position.set(w.x, atRamp, w.z); w.g.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    animWalk(w.g, t, moving);
  }
  gcar.peds = walkers.some((w) => !w.cross && w.z > 8 && Math.abs(w.x - 4.75) < 1.4);
}

/* ───────────── 미션 ───────────── */
const NPC = {
  guard: { vest: true, cap: 0xf2c230, shirt: 0x46a36b, face: '🦺' }, student: { shirt: 0x1d2d4a, bag: true, face: '🧑‍🎓' }, bro: { kid: true, shirt: 0x2f6fd0, helmet: 0x46c36b, face: '🧒' },
  keeper: { shirt: 0x2b3440, cap: 0x2b3440, face: '🧓' }, friend: { kid: true, shirt: 0xff8fb1, face: '👧' }, stranger: { shirt: 0x2a2a2a, cap: 0x111111, face: '🕶️' },
  manager: { shirt: 0xffffff, cap: 0xffffff, face: '👨‍🍳' }, teacher: { shirt: 0x8a4fd0, face: '👩‍🏫' }, worker: { vest: true, helmet: 0xf2c230, shirt: 0x3a6fb8, face: '👷' },
  kid3: { kid: true, shirt: 0xf0c13a, face: '👧' }, grandma: { shirt: 0x9b6b8a, hair: 0xcfcfcf, face: '👵' }, medic: { shirt: 0xf2f2ee, face: '🧑‍⚕️' },
  mom: { shirt: 0xd88a5a, face: '👩' }, officer: { shirt: 0x1d2d5a, cap: 0x1d2d5a, face: '👮' }, kid2: { kid: true, shirt: 0x46a36b, face: '👦' }, little: { kid: true, shirt: 0xffd36b, face: '🧒' },
};
const NAMES = { guard: '등굣길 지킴이 이모', student: '중학생 형', bro: '옆 반 친구 준호', keeper: '경비 아저씨', friend: '친구 서연', stranger: '모르는 아저씨', manager: '분식집 사장님', teacher: '담임 선생님', worker: '공사장 아저씨', kid3: '친구 하은', grandma: '지나가던 할머니', medic: '구급대원', mom: '엄마', officer: '경찰관', kid2: '친구 민준', little: '길 잃은 동생' };

// 미션 자리 [x, z], 카메라 위치(자리 기준), 마무리 말, 직접 고르기, 효과
const MI = {
  cross: { at: [-0.4, 1.0], npc: 'guard', cam: [7, 6, 12], rule: '서기 · 보기 · 걷기! 초록불이어도 좌우를 살피고, 손을 들고 건너요.',
    outro: '저기 친구들 봐! 초록불이 켜지면 좌우를 보고 손을 들고 건너지?', fx: 'cross' },
  bus: { at: [19.6, 1.0], npc: 'student', cam: [-6, 6, 12], rule: '버스 앞·뒤로 건너지 않아요. 버스가 떠난 뒤, 가까운 횡단보도로!', fx: 'bus',
    pick: { q: '어디로 건널까? 상자에서 골라 봐!', items: [['버스 바로 앞', [17, 4.6], 0, '버스에 가려서 마주 오는 차가 나를 못 봐요!'], ['버스 바로 뒤', [21.0, 4.6], 0, '뒤따라오던 차가 갑자기 나타날 수 있어요.'], ['버스가 떠난 뒤 횡단보도', [16.5, 1.2], 1, '맞아요! 시야가 트인 뒤 횡단보도로 건너요.']] } },
  kick: { at: [-14, 9.0], npc: 'bro', cam: [6, 7, -9], rule: '킥보드는 안전모·보호대를 쓰고, 사람 옆에서는 천천히!', outro: '헬멧 턱끈까지 딸깍! 사람 옆에서는 브레이크 잡고 천천히 가자.' },
  park: { at: [2.2, 9.0], npc: 'keeper', cam: [-6, 5, -8], rule: '주차장 출입구에서는 노란 선에 멈추고, 볼록거울과 좌우를 살펴요.', fx: 'park',
    pick: { q: '경사로로 차가 올라와요! 어디에 서 있을까?', items: [['노란 선 앞 (볼록거울 보기)', [2.3, 9.4], 1, '맞아요! 볼록거울로 차가 오는지 보고, 차가 지나간 뒤 건너요.'], ['출입구 한가운데', [4.75, 9.2], 0, '운전석에서 키 작은 어린이는 잘 안 보여요!']] } },
  play: { at: [-6.2, 12.2], npc: 'friend', cam: [3, 6, -9], rule: '미끄럼틀은 계단으로 올라 앉아서 내려오고, 그네 앞뒤는 멀리 돌아가요.', fx: 'play', outro: '미끄럼틀 계단으로 차례차례! 그네 앞뒤는 멀리 돌아서 가자.' },
  stranger: { at: [-17.5, 9.1], npc: 'stranger', cam: [8, 6, -8], rule: '"싫어요! 안 돼요!" 크게 거절하고, 아동안전지킴이집으로 가서 알려요.', fx: 'stranger',
    pick: { q: '도움을 요청하러 어디로 갈까?', items: [['24시 편의점 (아동안전지킴이집)', [5.05, -0.7], 1, '맞아요! 노란 "아동안전지킴이집" 표시가 있는 가게는 어린이를 도와줘요.'], ['아저씨 차 옆', [-17.5, 6.4], 0, '모르는 사람의 차에는 절대 가까이 가지 않아요.'], ['공원 안쪽 나무 뒤', [-20, 12.5], 0, '사람이 없는 곳은 더 위험해요. 사람 많은 가게로 가요.']] } },
  fire: { at: [2.6, -0.5], npc: 'manager', cam: [7, 6, 11], rule: '"불이야!" 외치고, 코와 입을 막고 몸을 낮춰 계단으로 대피해요.', fx: 'fire',
    outro: '119에는 내가 신고했어! 연기는 위로 올라가니까 몸을 낮추고 넓은 곳으로 대피해!',
    pick: { q: '어디로 대피할까?', items: [['길 건너 넓은 공원', [-15, 12.6], 1, '맞아요! 건물에서 멀고 넓은 곳으로 대피해요. 119 소방차가 오고 있어요!'], ['2층 태권도장으로 올라가기', [4, 2.4], 0, '불이 나면 위층은 연기로 가득 차요. 바깥으로 나가요!'], ['가게 안 엘리베이터', [7.5, 0.6], 0, '불이 나면 엘리베이터는 멈추거나 연기가 들어와요. 계단으로!']] } },
  quake: { at: [-8.5, -4.2], npc: 'teacher', cam: [6, 9, 13], rule: '흔들리면 머리를 감싸고, 건물·담장에서 먼 넓은 곳으로.', fx: 'quake',
    outro: '자, 흔들리기 시작했어요! 머리를 감싸고 어디로 가야 할까요?',
    pick: { q: '흔들려요! 어디로 갈까?', items: [['운동장 한가운데', [-10.5, -5.4], 1, '맞아요! 떨어질 물건이 없는 넓은 곳이 안전해요.'], ['학교 건물 벽 옆', [-12, -10.4], 0, '건물 가까이는 유리·간판이 떨어질 수 있어요.'], ['담장 옆', [-14, -0.9], 0, '담장은 무너질 수 있어요.']] } },
  site: { at: [13.2, 0.9], npc: 'worker', cam: [-5, 7, 10], rule: '공사장 안 지름길은 절대 안 돼요. 조금 멀어도 울타리 바깥 인도로!', fx: 'site',
    pick: { q: '공사장 옆, 어느 길로 갈까?', items: [['울타리 바깥 인도', [17, 1.0], 1, '맞아요! 조금 멀어도 공사장은 꼭 돌아서 가요.'], ['공사장 안 지름길', [16, -3.4], 0, '크레인 아래·공사장 안은 물건이 떨어질 수 있어 아주 위험해요!']] } },
  aid: { at: [9.6, 9.1], npc: 'grandma', cam: [-4, 6, -10], rule: '어른을 부르고 119! 있는 곳·상황을 말하고, 끊으라고 할 때까지 기다려요.', fx: 'aid', outro: '구급차가 오고 있어! 길가에서 손을 흔들어 우리가 여기 있다고 알려 주자.' },
  dog: { at: [-16.2, 13.3], npc: 'kid2', cam: [8, 6, -6], rule: '모르는 개가 다가오면 나무처럼 가만히, 눈을 마주치지 않아요.', fx: 'dog', outro: '개가 와도 나무처럼 가만히! 주인이 오면 목줄을 해 달라고 하자.' },
  storm: { at: [0.6, -2.6], npc: 'officer', cam: [6, 6, 11], rule: '번개가 치면 나무 밑·넓은 곳은 피하고, 가까운 건물 안으로!', fx: 'storm',
    pick: { q: '번개가 쳐요! 어디로 피할까?', items: [['작은도서관 안', [14.2, 10.8], 1, '맞아요! 건물 안이 가장 안전해요.'], ['큰 나무 밑', [-1, -5], 0, '번개는 높은 곳에 떨어져요. 나무 밑은 아주 위험해요!'], ['넓은 운동장 가운데', [-10.5, -5.4], 0, '넓은 곳에서는 내가 가장 높은 곳이 돼요.']] } },
  dust: { at: [17.4, 10.6], npc: 'mom', cam: [-6, 6, -10], rule: 'KF80 이상 마스크를 코까지 꼭 맞게! 다녀와서 손·얼굴을 씻어요.', fx: 'dust' },
  ice: { at: [8.4, 1.0], npc: 'grandma', cam: [-6, 6, 11], rule: '빙판길은 주머니에서 손을 빼고, 보폭을 좁게 천천히 걸어요.', fx: 'ice', outro: '종종걸음으로 천천히! 손은 주머니에서 빼고 걷자.' },
  lost: { at: [-1.2, 13.6], npc: 'little', cam: [7, 6, -8], rule: '길 잃은 동생은 경비실·아동안전지킴이집 어른에게 함께 가서 알려요.', fx: 'lost',
    pick: { q: '동생과 함께 어디로 갈까?', items: [['경비실', [0.1, 11.0], 1, '맞아요! 경비 아저씨가 방송하고 보호자를 찾아 줘요.'], ['큰길 건너편', [-6, 1.0], 0, '어린이끼리 멀리 가면 더 길을 잃어요.'], ['놀이터 구석', [-9.6, 15.2], 0, '사람이 적은 곳으로 가면 보호자가 찾기 어려워요.']] } },
};
const ORDER = ['cross', 'bus', 'kick', 'park', 'play', 'stranger', 'fire', 'quake', 'site', 'aid', 'dog', 'storm', 'dust', 'ice', 'lost'];
const state = { done: {}, name: '' };
try { const s = JSON.parse(localStorage.getItem('gahyeon-box') || '{}'); if (s.done) state.done = s.done; if (s.name) state.name = s.name; } catch (e) { /* 저장 불가 */ }
const save = () => { try { localStorage.setItem('gahyeon-box', JSON.stringify(state)); } catch (e) { /* 저장 불가 */ } };
const pins = {}, npcObjs = {};

function setupMissions() {
  ORDER.forEach((id, i) => {
    const m = MI[id], T = TALK[id];
    // NPC 인형
    const spec = NPC[m.npc]; const p = person(spec); p.position.set(m.at[0], groundY(m.at[0], m.at[1]), m.at[1]);
    p.rotation.y = m.at[1] > 5 ? Math.PI : 0; L.ground.add(p); npcObjs[id] = p;
    // 핀
    const d = document.createElement('div'); d.className = 'pin'; d.innerHTML = `<div class="bub">${T.icon}</div><div class="tag">${T.title}</div>`;
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    d.addEventListener('click', (e) => { e.stopPropagation(); startMission(id); });
    const o = new CSS2DObject(d); o.position.set(m.at[0], groundY(m.at[0], m.at[1]) + 1.9, m.at[1]); L.ground.add(o);
    pins[id] = { o, d };
    // 목록
    const li = document.createElement('li'); li.dataset.id = id; li.innerHTML = `<span class="ic">${T.icon}</span><span class="t">${T.title}</span><span class="s"></span>`;
    li.onclick = () => startMission(id); $('mlist').appendChild(li);
  });
  refreshProgress();
}
function groundY(x, z) { if (z > ROAD.z0 && z < ROAD.z1) return 0.035; if (z >= 0 && z <= RAMP.z0) return 0.15; return 0.06; }
function refreshProgress() {
  let n = 0, st = 0;
  for (const id of ORDER) { const s = state.done[id]; pins[id].d.classList.toggle('done', !!s); const li = document.querySelector(`#mlist li[data-id="${id}"]`); li.classList.toggle('done', !!s); li.querySelector('.s').textContent = s ? '★'.repeat(s) : ''; if (s) { n++; st += s; } }
  $('done').textContent = n; $('stars').textContent = '★ ' + st;
}

let cur = null; // 진행 중 미션
function startMission(id) {
  if (cur && cur.id === id) return;
  if (cur) endMission(false);
  audio.click();
  const m = MI[id], T = TALK[id];
  cur = { id, step: 0, mistakes: 0, talk: [...T.talk], picks: [] };
  if (m.outro) cur.talk.push({ who: m.npc, say: m.outro });
  if (m.pick) cur.talk.push({ who: m.npc, pick: m.pick });
  cur.talk.push({ rule: m.rule });
  document.body.classList.add('busy');
  for (const k in pins) pins[k].d.classList.toggle('active', k === id);
  $('c-icon').textContent = T.icon; $('c-title').textContent = T.title; $('c-no').textContent = 'MISSION ' + String(ORDER.indexOf(id) + 1).padStart(2, '0');
  $('card').classList.remove('hidden'); viewShift();
  if (view === 'exploded') setView('overview', true);
  const [x, z] = m.at, y = groundY(x, z);
  flyTo(new THREE.Vector3(x + m.cam[0], y + m.cam[1], z + m.cam[2]), new THREE.Vector3(x, y + 0.6, z), 1.6);
  controls.autoRotate = false;
  fxStart(m.fx, id);
  showStep();
}
function showStep() {
  const s = cur.talk[cur.step];
  const ch = $('c-choices'), why = $('c-why'), nx = $('c-next');
  ch.innerHTML = ''; why.className = 'hidden'; why.textContent = ''; nx.classList.add('hidden'); clearPicks();
  if (s.rule) {
    $('c-face').textContent = '📌'; $('c-name').textContent = '기억해요!'; $('c-text').textContent = '';
    why.className = 'rule'; why.textContent = s.rule;
    const stars = Math.max(1, 3 - cur.mistakes);
    nx.textContent = `미션 완료 ${'★'.repeat(stars)}`; nx.classList.remove('hidden'); nx.onclick = () => finishMission(stars);
    return;
  }
  const n = NPC[s.who] || {}; $('c-face').textContent = n.face || '🙂'; $('c-name').textContent = NAMES[s.who] || s.who;
  if (s.say) { $('c-text').textContent = s.say; nx.textContent = '다음 ▶'; nx.classList.remove('hidden'); nx.onclick = next; }
  else if (s.ask) {
    $('c-text').textContent = s.ask;
    s.choices.forEach((c) => {
      const b = document.createElement('button'); b.textContent = c.t;
      b.onclick = () => {
        if (b.disabled) return;
        if (c.ok) { b.classList.add('good'); [...ch.children].forEach((x) => (x.disabled = true)); why.className = 'ok'; why.textContent = '⭕ ' + c.why; audio.good(); nx.textContent = '다음 ▶'; nx.classList.remove('hidden'); nx.onclick = next; }
        else { b.classList.add('bad'); b.disabled = true; why.className = 'no'; why.textContent = '❌ ' + c.why; cur.mistakes++; audio.bad(); }
      };
      ch.appendChild(b);
    });
  } else if (s.pick) {
    $('c-text').textContent = '🔍 ' + s.pick.q + '\n(상자 안의 노란 단추를 눌러요)';
    // 고를 곳이 다 보이게 카메라를 살짝 뒤로
    const pts = s.pick.items.map((it) => new THREE.Vector3(it[1][0], 0, it[1][1])); const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const r = Math.max(...pts.map((p) => p.distanceTo(c))) + 4; const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    flyTo(new THREE.Vector3(c.x + dir.x * r * 2.3, r * 1.9 + 5, c.z + dir.z * r * 2.3), new THREE.Vector3(c.x - dir.z * r * 0.25, 0.5, c.z + dir.x * r * 0.25), 1.4);
    s.pick.items.forEach(([label, [x, z], ok, msg], i) => {
      const wrap = document.createElement('div'); wrap.className = 'pickwrap';
      const d = document.createElement('button'); d.className = 'pick'; d.innerHTML = `<b>${i + 1}</b>${label}`; wrap.appendChild(d);
      d.addEventListener('pointerdown', (e) => e.stopPropagation());
      d.onclick = (e) => {
        e.stopPropagation(); if (d.classList.contains('no')) return;
        if (ok) { why.className = 'ok'; why.textContent = '⭕ ' + msg; audio.good(); clearPicks(); fxPick(cur.id, x, z); nx.textContent = '다음 ▶'; nx.classList.remove('hidden'); nx.onclick = next; }
        else { d.classList.add('no'); why.className = 'no'; why.textContent = '❌ ' + msg; cur.mistakes++; audio.bad(); }
      };
      const o = new CSS2DObject(wrap); o.position.set(x, groundY(x, z) + 0.9, z); L.ground.add(o); cur.picks.push(o);
    });
  }
}
function clearPicks() { if (!cur) return; for (const o of cur.picks) { o.element.remove(); L.ground.remove(o); } cur.picks = []; }
function next() { audio.click(); cur.step++; showStep(); }
function finishMission(stars) {
  const id = cur.id; state.done[id] = Math.max(state.done[id] || 0, stars); save();
  audio.good(); toast(`${TALK[id].icon} ${TALK[id].title} 완료! ${'★'.repeat(stars)}`);
  endMission(true); refreshProgress();
  setTimeout(() => { if (!cur) setView('overview'); }, 1400);
  if (ORDER.every((k) => state.done[k])) setTimeout(showCert, 900);
}
function endMission() {
  if (!cur) return; clearPicks(); fxEnd(MI[cur.id].fx);
  cur = null; $('card').classList.add('hidden'); document.body.classList.remove('busy'); viewShift();
  for (const k in pins) pins[k].d.classList.remove('active');
}
$('c-close').onclick = () => { endMission(); setView('overview'); };

/* ───────────── 미션 효과 ───────────── */
const fx = { saved: null, fireOn: false, shake: 0, stormT: 0, dog: null, owner: null, amb: null, truck: null, bus: null, van: null, swing: false, smoke: null, flames: null, crane: false };
function fxStart(kind, id) {
  fx.saved = { weather: env.weather, time: env.time };
  if (kind === 'cross') { sig.phase = 'allR'; sig.t = 0; }
  if (kind === 'bus') { if (!fx.bus) { fx.bus = spawnCar(-1, 'bus', W2 + 4, { vmax: 5, keep: true }); fx.bus.stopAt = 18.4; } }
  if (kind === 'park') { if (!gcar.g) gcar.wait = 0; }
  if (kind === 'play') fx.swing = true;
  if (kind === 'stranger') { fx.van = spawnCar(1, 'van', -17.5, { v: 0, vmax: 0, keep: true }); fx.van.hold = 999; }
  if (kind === 'fire') { fireOn(true); }
  if (kind === 'quake') fx.quake = true;
  if (kind === 'site') fx.crane = true;
  if (kind === 'aid') { const k = person({ kid: true, shirt: 0xf0c13a }); k.rotation.set(0, 0, Math.PI / 2); k.position.set(10.6, 0.25, 9.3); L.ground.add(k); fx.down = k; }
  if (kind === 'dog') { dogOn(); }
  if (kind === 'storm') { setEnv('weather', 'rain'); fx.stormT = 1.2; }
  if (kind === 'dust') { env.haze = 1; if (env.weather === 'rain') setEnv('weather', 'clear'); }
  if (kind === 'ice') setEnv('weather', 'snow');
  if (kind === 'lost') { fx.cry = true; }
}
function fxPick(id, x, z) {
  if (id === 'fire') { if (!fx.truck) { fx.truck = spawnCar(-1, 'fire', W2 + 3, { vmax: 7, keep: true }); fx.truck.stopAt = 3.4; } toast('🚒 소방차 출동!'); }
  if (id === 'bus' && fx.bus) { fx.bus.hold = 0.01; fx.bus.stopAt = null; fx.bus.keep = false; fx.bus = null; }
  if (id === 'quake') fx.quake = false;
  if (id === 'storm') fx.stormT = 999;
  if (id === 'lost') { fx.cry = false; walkTo(npcObjs.lost, 0.6, 11.0); }
}
function fxEnd(kind) {
  if (kind === 'fire') { fireOn(false); if (fx.truck) { fx.truck.stopAt = null; fx.truck.keep = false; fx.truck.hold = 0; fx.truck = null; } }
  if (kind === 'bus' && fx.bus) { fx.bus.stopAt = null; fx.bus.keep = false; fx.bus = null; }
  if (kind === 'stranger' && fx.van) { fx.van.hold = 0; fx.van.vmax = 5; fx.van.keep = false; fx.van = null; }
  if (kind === 'play') fx.swing = false;
  if (kind === 'quake') { fx.quake = false; }
  if (kind === 'site') fx.crane = false;
  if (kind === 'aid') { if (fx.down) { L.ground.remove(fx.down); fx.down = null; } if (fx.amb) { fx.amb.stopAt = null; fx.amb.keep = false; fx.amb.hold = 0; fx.amb = null; } }
  if (kind === 'dog') dogOff();
  if (kind === 'storm') { fx.stormT = 0; setEnv('weather', fx.saved.weather === 'snow' ? 'snow' : fx.saved.weather); }
  if (kind === 'dust') env.haze = 0;
  if (kind === 'ice') setEnv('weather', fx.saved.weather);
  if (kind === 'lost') { fx.cry = false; const n = npcObjs.lost; n.position.set(MI.lost.at[0], 0.06, MI.lost.at[1]); }
  if (kind === 'cross') { /* 신호는 그대로 돈다 */ }
}
const moveJobs = [];
function walkTo(obj, x, z) { moveJobs.push({ obj, x, z }); }
function fireOn(on) {
  fx.fireOn = on;
  if (on && !fx.flames) {
    fx.flames = new THREE.Group(); fx.flames.position.set(2.6, 0.2, -1.2); L.build.add(fx.flames);
    fx.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 6), fx.flameMat); f.position.set(rand(-0.6, 0.6), rand(0.2, 0.7), rand(0, 0.2)); f.userData.p = Math.random() * 6; fx.flames.add(f); }
    fx.fireLight = new THREE.PointLight(0xff7a2a, 8, 8, 1.4); fx.fireLight.position.set(0, 1, 0.6); fx.flames.add(fx.fireLight);
    const sm = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 });
    fx.smoke = []; for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), sm); s.userData = { t: Math.random() * 4 }; L.build.add(s); fx.smoke.push(s); }
  }
  if (fx.flames) fx.flames.visible = on;
  if (fx.smoke) fx.smoke.forEach((s) => (s.visible = on));
}
function dogOn() {
  const g = new THREE.Group(); const fur = M(0x8a5a2b);
  box(0.7, 0.32, 0.3, fur, 0, 0.45, 0, g); box(0.28, 0.26, 0.24, fur, 0.42, 0.66, 0, g); box(0.14, 0.1, 0.14, M(0x2a1a10), 0.6, 0.62, 0, g);
  for (const [x, z] of [[-0.25, -0.1], [-0.25, 0.1], [0.25, -0.1], [0.25, 0.1]]) box(0.08, 0.3, 0.08, fur, x, 0.15, z, g);
  box(0.25, 0.06, 0.06, fur, -0.45, 0.6, 0, g).rotation.z = 0.6;
  g.position.set(-19.5, 0.06, 11.5); L.ground.add(g); fx.dog = { g, t: 0 };
}
function dogOff() { if (fx.dog) { L.ground.remove(fx.dog.g); fx.dog = null; } }
function updateFx(dt, t) {
  if (fx.swing || true) { const amp = fx.swing ? 0.75 : 0.18; swings.forEach((s, i) => (s.rotation.x = Math.sin(t * 2.1 + i * 1.3) * amp)); }
  seesaw.rotation.z = Math.sin(t * 1.1) * 0.2; duck.rotation.z = Math.sin(t * 3) * 0.12;
  wheel.rotation.z -= dt * 0.8;
  craneTop.rotation.y = Math.sin(t * 0.12) * 0.6;
  const sway = fx.crane ? Math.sin(t * 2.3) * 0.35 : Math.sin(t * 0.9) * 0.05;
  craneHook.rotation.x = sway; craneHook.position.x = -6 + Math.sin(t * 0.25) * 2;
  const drop = fx.crane ? 4.5 : 6 + Math.sin(t * 0.3) * 2; craneLoad.position.y = -drop; craneCable.scale.y = drop; craneCable.position.y = -drop / 2;
  craneBeacon.emissiveIntensity = Math.sin(t * 4) > 0.3 ? 4 : 0.2;
  if (fx.fireOn && fx.flames) {
    fx.flames.children.forEach((f) => { if (f.isMesh) { f.scale.setScalar(0.7 + Math.sin(t * 13 + f.userData.p) * 0.35); f.position.y = 0.4 + Math.abs(Math.sin(t * 7 + f.userData.p)) * 0.4; } });
    fx.fireLight.intensity = 6 + Math.random() * 6;
    fx.smoke.forEach((s) => { s.userData.t += dt; if (s.userData.t > 4) s.userData.t = 0; const k = s.userData.t / 4; s.position.set(2.6 + Math.sin(k * 5 + s.id) * 0.5 + k * 1.5, 1.2 + k * 6.5, -1.0 + Math.cos(k * 4 + s.id) * 0.4); s.scale.setScalar(0.5 + k * 2.2); });
  }
  if (fx.truck && fx.truck.arrived && !fx.truck.spray) { fx.truck.spray = true; toast('🚒 소방관이 불을 끄고 있어요!'); setTimeout(() => { if (fx.fireOn) fireOn(false); }, 3500); }
  if (fx.quake) { fx.shake = 0.16; } else fx.shake *= 0.9;
  if (fx.stormT > 0 && fx.stormT < 900) { fx.stormT -= dt; if (fx.stormT <= 0) { lightning(); fx.stormT = rand(2.2, 4.5); } }
  if (fx.stormT >= 900) { fx.stormT -= dt; if (Math.random() < dt * 0.25) lightning(); }
  if (cur && cur.id === 'aid' && !fx.amb && cur.step >= cur.talk.length - 2) { fx.amb = spawnCar(1, 'amb', -W2 - 3, { vmax: 7, keep: true }); fx.amb.stopAt = 10.4; toast('🚑 구급차가 오고 있어요!'); }
  if (fx.dog) { const d = fx.dog; d.t += dt; const npc = npcObjs.dog.position; const tx = npc.x - 0.9, tz = npc.z - 0.4; const dx = tx - d.g.position.x, dz = tz - d.g.position.z, dist = Math.hypot(dx, dz);
    if (dist > 0.3) { d.g.position.x += dx / dist * dt * 3; d.g.position.z += dz / dist * dt * 3; d.g.rotation.y = Math.atan2(-dz, dx); } else d.g.rotation.y += Math.sin(t * 8) * 0.04; }
  if (fx.cry && npcObjs.lost) npcObjs.lost.position.y = 0.06 + Math.abs(Math.sin(t * 6)) * 0.05;
  for (const j of [...moveJobs]) { const p = j.obj.position, dx = j.x - p.x, dz = j.z - p.z, d = Math.hypot(dx, dz); if (d < 0.05) { moveJobs.splice(moveJobs.indexOf(j), 1); continue; } p.x += dx / d * Math.min(d, dt * 1.1); p.z += dz / d * Math.min(d, dt * 1.1); j.obj.rotation.y = Math.atan2(dx, dz); animWalk(j.obj, t, true); }
}
function lightning() {
  flashLight.intensity = 9; const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.55';
  requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; });
  setTimeout(() => (flashLight.intensity = 0), 120); setTimeout(() => { flashLight.intensity = 5; setTimeout(() => (flashLight.intensity = 0), 80); }, 220);
  setTimeout(() => audio.thunder(), 500);
}
let toastT = 0;
function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ───────────── 시점 ───────────── */
let view = 'overview';
const fly = { t: 1, dur: 1, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
function flyTo(pos, target, dur = 1.6) { if (camera.aspect < 1) pos = target.clone().add(pos.clone().sub(target).multiplyScalar(1.65)); fly.p0.copy(camera.position); fly.t0.copy(controls.target); fly.p1.copy(pos); fly.t1.copy(target); fly.t = 0; fly.dur = dur; }
const VIEWS = {
  overview: () => { flyTo(new THREE.Vector3(48, 38, 60), new THREE.Vector3(0, 1, 0)); controls.autoRotate = true; explodeGoal = 0; },
  street: () => { flyTo(new THREE.Vector3(-15, 1.7, 9.6), new THREE.Vector3(2, 1.6, 3.2)); controls.autoRotate = false; explodeGoal = 0; },
  exploded: () => { flyTo(new THREE.Vector3(74, 40, 92), new THREE.Vector3(-4, 4, 0)); controls.autoRotate = false; explodeGoal = 1; },
};
function setView(v, silent) {
  if (v === 'tour') { const id = ORDER.find((k) => !state.done[k]) || ORDER[(ORDER.indexOf(cur?.id) + 1) % ORDER.length] || ORDER[0]; startMission(id); return; }
  if (cur && v !== 'overview' && !silent) endMission();
  view = v; VIEWS[v]();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  document.body.classList.toggle('exploded', v === 'exploded');
}

/* ───────────── UI 연결 ───────────── */
document.querySelectorAll('#seg-weather button').forEach((b) => (b.onclick = () => { audio.click(); setEnv('weather', b.dataset.w); }));
document.querySelectorAll('#seg-time button').forEach((b) => (b.onclick = () => { audio.click(); setEnv('time', b.dataset.t); }));
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => { audio.click(); setView(b.dataset.v); }));
$('snd').onclick = () => audio.toggle();
$('prog-head').onclick = () => { $('prog').classList.toggle(MOBILE ? 'open' : 'fold'); };
labelR.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; fly.t = 1; });
function showCert() {
  $('cert-name').textContent = state.name || '탐험대원';
  const st = ORDER.reduce((a, k) => a + (state.done[k] || 0), 0); $('cert-stars').textContent = '★'.repeat(Math.round(st / 15)) + `  (${st} / 45)`;
  const d = new Date(); $('cert-date').textContent = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.  인천가현초등학교`;
  $('cert').classList.remove('hidden');
}
$('again').onclick = () => $('cert').classList.add('hidden');
$('print').onclick = () => print();
$('name').value = state.name;
$('start').onclick = () => {
  state.name = $('name').value.trim(); save(); $('title').classList.add('hidden');
  if (!audioAsked) { audioAsked = true; audio.toggle(); }
  toast('📍 빛나는 아이콘을 눌러 안전 미션을 시작해요!');
};
let audioAsked = false;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) { endMission(); setView('overview'); } });

/* ───────────── 크기 맞춤 ───────────── */
function resize() {
  const w = innerWidth, h = innerHeight; camera.aspect = w / h;
  camera.fov = w / h < 1 ? 42 : 28; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); labelR.setSize(w, h); tilt.uniforms.res.value.set(w, h);
  viewShift();
}
// 세로 화면에서 미션 카드가 열리면 장면을 위로 올려 보이게
function viewShift() { const w = innerWidth, h = innerHeight; if (cur && w < h) camera.setViewOffset(w, h, 0, h * 0.2, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

/* ───────────── 돌리기 ───────────── */
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (fly.t < 1) {
    fly.t = Math.min(1, fly.t + dt / fly.dur); const k = ease(fly.t);
    camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
  }
  explodeT = lerp(explodeT, explodeGoal, 1 - Math.exp(-dt * 3));
  for (const k in L) L[k].position.y = EXPLODE[k] * explodeT;
  for (const l of layerLines) l.material.opacity = explodeT;
  rain.position.y = 0; snow.position.y = 0;
  updateSignals(dt, t); updateTraffic(dt, t); updateGarageCar(dt, t); updateWalkers(dt, t); updateFx(dt, t); updateWeather(dt, t);
  controls.update();
  if (fx.shake > 0.005) { root.position.set(rand(-1, 1) * fx.shake, 0, rand(-1, 1) * fx.shake); } else root.position.set(0, 0, 0);
  composer.render();
  labelR.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ───────────── 시작 ───────────── */
(async function init() {
  try { await Promise.race([Promise.all([document.fonts.load("900 40px 'Noto Sans KR'"), document.fonts.load("700 40px 'Noto Sans KR'")]), new Promise((r) => setTimeout(r, 3500))]); } catch (e) { /* 글꼴 없이도 진행 */ }
  lp(5);
  const tasks = [buildBase, buildGround, buildWeather, layerTags, spawnWalkers, setupMissions];
  for (const f of tasks) { f(); await new Promise((r) => setTimeout(r, 0)); }
  for (const d of [1, -1]) for (let i = 0; i < 3; i++) spawnCar(d, i === 1 ? 'taxi' : 'car', -d * 14 + d * i * 9, { v: 4 });
  resize(); setEnv('weather', 'rain');
  if (camera.aspect < 1) { camera.position.multiplyScalar(1.65); }
  lp(100);
  $('loading').classList.add('gone');
  $('start').disabled = false; $('start').textContent = state.name || Object.keys(state.done).length ? '이어서 둘러보기' : '상자 열기';
  frame();
})();
// 디버그·검증용
window.__box = { setView, startMission, setEnv, state, cars, get cur() { return cur; } };
