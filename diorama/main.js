// 가현 안전상자 — 실제 가현초 둘레(OSM) 미니어처 디오라마 + 직접 걸어 다니는 안전교육 게임 (three.js r170)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TALK } from './talk.js';
import { ROOMS } from './rooms.js';

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
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 1200);
camera.position.set(86, 78, 104);
const controls = new OrbitControls(camera, labelR.domElement);
labelR.domElement.style.pointerEvents = 'auto';
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.target.set(0, 2, 0);
controls.minDistance = 4; controls.maxDistance = 320;
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
sun.position.set(-50, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 55, bottom: -55, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);
const flashLight = new THREE.DirectionalLight(0xdfe6ff, 0);
const fireLight = new THREE.PointLight(0xff7a2a, 0, 7, 1.4); fireLight.position.set(-28.7, 0.9, -21.5); scene.add(fireLight);
const roomLight = new THREE.PointLight(0xfff0d8, 0, 16, 1.0); roomLight.position.set(300, 3, 0); scene.add(roomLight);
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
const EXPLODE = { under: -14, ground: 0, build: 14, roof: 26 };
const PS = 0.62; // 사람·차 크기 (지도 1칸 = 1단위)
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
  g.scale.setScalar(PS);
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
  g.userData.len = spec.l * PS; g.userData.kind = kind;
  g.scale.setScalar(PS);
  return g;
}

/* ───────────── 실제 가현초 둘레 지도 (OSM 격자, 1칸 = 실제 6m = 1단위) ───────────── */
let GRID, W, H, W2, D2;
const TX = (tx) => tx - W / 2, TZ = (ty) => ty - H / 2;          // 칸 → 월드
const FX = (x) => x + W / 2, FZ = (z) => z + H / 2;              // 월드 → 칸
let ground, blocks;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : ground[y | 0][x | 0];
const isRoadC = (c) => c === 'r' || c === 'z';
const CW = [
  { id: 'S', x0: 41, x1: 42, y0: 35, y1: 37, axis: 'v', off: 0, name: '가현초 정문 앞 횡단보도' },
  { id: 'E', x0: 65, x1: 66, y0: 35, y1: 37, axis: 'v', off: 9, name: '루원시티 앞 횡단보도' },
  { id: 'W', x0: 18, x1: 21, y0: 26, y1: 27, axis: 'h', off: 4, name: '상가 앞 횡단보도(염곡로)' },
  { id: 'N', x0: 18, x1: 21, y0: 46, y1: 47, axis: 'h', off: 13, name: '아파트 쪽 횡단보도' },
];
const cwAt = (x, y) => CW.find((c) => x >= c.x0 && x < c.x1 + 1 && y >= c.y0 && y < c.y1 + 1);
const SITE = { x0: 23, x1: 28, y0: 40, y1: 44 };
const PARK = { x0: 38, x1: 47, y0: 47, y1: 55 };
const RAMP = { x0: 7, x1: 10, y0: 59, y1: 64, depth: 3.6 };     // 지하주차장 경사로 (칸)
const GAR = { x0: 0, x1: 15, y0: 54, y1: 70, top: -0.4, bot: -3.6 }; // 지하주차장 (칸)
const DRIVE = 58;                                                 // 단지 출입 찻길 (행)
const SW_H = 0.12;                                                // 인도 높이
let pct = 0; const step = (n) => { pct += n; lp(Math.min(99, pct)); };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const raised = (c) => c === 's' || c === 'v' || c === 'm';
function hY(x, z) { const c = tileAt(FX(x), FZ(z)); return raised(c) ? SW_H : 0.0; }

function prepMap() {
  ground = GRID.ground.map((r) => r.split(''));
  blocks = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (GRID.bldg[y][x] !== '.') blocks[y * W + x] = 1;
  const nearField = (x, y) => { for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { if (GRID.ground[y + dy]?.[x + dx] === 'h') return true; } return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground[y][x] === 'r' && nearField(x, y)) ground[y][x] = 'z';
  for (let y = PARK.y0; y <= PARK.y1; y++) for (let x = PARK.x0; x <= PARK.x1; x++) { ground[y][x] = 'd'; blocks[y * W + x] = 0; }
  for (let y = SITE.y0; y <= SITE.y1; y++) for (let x = SITE.x0; x <= SITE.x1; x++) { ground[y][x] = 'k'; blocks[y * W + x] = 0; }
  for (let y = 33; y <= 34; y++) for (let x = 1; x <= 8; x++) if (!blocks[y * W + x]) ground[y][x] = 'm';
  for (let x = 6; x <= 17; x++) ground[DRIVE][x] = 'a';            // 단지 찻길
  for (let y = RAMP.y0; y < RAMP.y1; y++) for (let x = RAMP.x0; x < RAMP.x1; x++) ground[y][x] = 'p';
}

function buildGroundPlane() {
  const P = 16, cv = CAN(W * P, H * P), g = cv.getContext('2d');
  const COL = { y: '#7d8a6c', g: '#4d7343', h: '#a8865f', r: '#34353b', z: '#7e3631', s: '#a49b8d', v: '#b3a689', d: '#c3a46c', k: '#7a5a3e', m: '#a8a0b6', a: '#3b3d43', p: 'rgba(0,0,0,0)' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = ground[y][x]; if (c === 'p') { g.clearRect(x * P, y * P, P, P); continue; }
    g.fillStyle = COL[c] || COL.g; g.fillRect(x * P, y * P, P, P);
    const h = hash(x, y);
    if (c === 'g' || c === 'y') { g.fillStyle = 'rgba(20,50,20,.18)'; for (let i = 0; i < 5; i++) g.fillRect(x * P + ((h * 97 + i * 37) % 14 | 0), y * P + ((h * 53 + i * 29) % 14 | 0), 2, 2); if (c === 'y') { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x * P, y * P + 15, P, 1); } }
    if (c === 's' || c === 'm' || c === 'v') { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(x * P, y * P + 7, P, 1); g.fillRect(x * P + ((y % 2) ? 4 : 11), y * P, 1, 7); g.fillRect(x * P + ((y % 2) ? 11 : 4), y * P + 8, 1, 8); }
    if (c === 'h') { g.fillStyle = 'rgba(80,50,20,.14)'; g.fillRect(x * P + (h * 12 | 0), y * P + (h * 7 | 0), 3, 2); }
    if (c === 'k' && h > 0.5) { g.fillStyle = '#5e4630'; g.fillRect(x * P + 3, y * P + 9, 8, 3); }
  }
  g.fillStyle = '#e6b93a';
  for (let x = 22; x < W; x++) { g.fillRect(x * P, 36 * P + 7, P, 1.4); g.fillRect(x * P, 36 * P + 9, P, 1.4); }
  for (let y = 0; y < H; y++) if (y < 35 || y > 37) { g.fillRect(19 * P + 15, y * P, 1.4, P); g.fillRect(20 * P, y * P, 1.4, P); }
  g.fillStyle = 'rgba(240,240,240,.75)';
  for (let x = 22; x < W; x += 2) { g.fillRect(x * P + 2, 35 * P + 8, 10, 1); g.fillRect(x * P + 2, 37 * P + 7, 10, 1); }
  g.font = "900 10px 'Noto Sans KR', sans-serif"; g.textAlign = 'center'; g.fillStyle = '#fff3e0';
  for (const x of [34, 52, 76]) { g.save(); g.translate(x * P, 37 * P + 12); g.fillText('어린이 보호구역', 0, 0); g.restore(); g.save(); g.translate(x * P + 120, 35 * P + 5); g.rotate(Math.PI); g.fillText('어린이 보호구역', 0, 0); g.restore(); }
  g.font = "900 13px 'Noto Sans KR', sans-serif"; for (const x of [30, 60]) { g.fillText('30', x * P, 37 * P + 13); }
  for (const c of CW) {
    g.fillStyle = COL.r; g.fillRect(c.x0 * P, c.y0 * P, (c.x1 - c.x0 + 1) * P, (c.y1 - c.y0 + 1) * P);
    g.fillStyle = '#efefe8';
    if (c.axis === 'v') for (let y = c.y0 * P + 2; y < (c.y1 + 1) * P; y += 8) g.fillRect(c.x0 * P + 2, y, (c.x1 - c.x0 + 1) * P - 4, 4);
    else for (let x = c.x0 * P + 2; x < (c.x1 + 1) * P; x += 8) g.fillRect(x, c.y0 * P + 2, 4, (c.y1 - c.y0 + 1) * P - 4);
  }
  const track = (r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(28 * P, (21.6 - r) * P); g.lineTo(34 * P, (21.6 - r) * P); g.arc(34 * P, 21.6 * P, r * P, -Math.PI / 2, Math.PI / 2); g.lineTo(28 * P, (21.6 + r) * P); g.arc(28 * P, 21.6 * P, r * P, Math.PI / 2, Math.PI * 1.5); g.stroke(); };
  track(3.0, '#a34c3a', 1.2 * P); for (const r of [2.45, 2.85, 3.25, 3.65]) track(r, 'rgba(255,255,255,.8)', 1.5);
  g.fillStyle = '#4f7d43'; g.beginPath(); g.moveTo(28 * P, 19.2 * P); g.lineTo(34 * P, 19.2 * P); g.arc(34 * P, 21.6 * P, 2.4 * P, -Math.PI / 2, Math.PI / 2); g.lineTo(28 * P, 24 * P); g.arc(28 * P, 21.6 * P, 2.4 * P, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.strokeStyle = '#e6b93a'; g.lineWidth = 2; g.beginPath(); for (let x = 46; x <= 56; x += 0.5) g.lineTo(x * P, 35 * P + (((x * 2) | 0) % 2 ? 3 : 8)); g.stroke();
  g.fillStyle = '#ffd34d'; g.fillRect(14.6 * P, DRIVE * P, 3, P); // 출입구 정지선
  const tex = texOf(cv); tex.anisotropy = 8;
  const m = wet(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, alphaTest: 0.5 }));
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; L.ground.add(plane);
  // 눈 덮개
  snowCover = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0xf2f5fa, transparent: true, opacity: 0, roughness: 0.9, alphaMap: snowMask(cv), depthWrite: false }));
  snowCover.rotation.x = -Math.PI / 2; snowCover.position.y = 0.01; L.ground.add(snowCover);
  // 지면 판(두께)과 경사로 구멍
  const C = mat.concrete, x0 = -W2, x1 = W2, z0 = -D2, z1 = D2, rx0 = TX(RAMP.x0), rx1 = TX(RAMP.x1), rz0 = TZ(RAMP.y0), rz1 = TZ(RAMP.y1);
  slab(x0, x1, -0.4, -0.01, z0, rz0, C); slab(x0, x1, -0.4, -0.01, rz1, z1, C); slab(x0, rx0, -0.4, -0.01, rz0, rz1, C); slab(rx1, x1, -0.4, -0.01, rz0, rz1, C);
  const rim = M(0x221c20, { roughness: 0.4, metalness: 0.4 });
  slab(x0 - 0.2, x1 + 0.2, -0.4, 0.3, z0 - 0.2, z0, rim); slab(x0 - 0.2, x1 + 0.2, -0.4, 0.3, z1, z1 + 0.2, rim); slab(x0 - 0.2, x0, -0.4, 0.3, z0, z1, rim); slab(x1, x1 + 0.2, -0.4, 0.3, z0, z1, rim);
  step(8);
}
let snowCover;
function snowMask(src) { const c = CAN(W * 4, H * 4), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#666'; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (isRoadC(ground[y][x]) || ground[y][x] === 'a') g.fillRect(x * 4, y * 4, 4, 4); if (ground[y][x] === 'p') { g.fillStyle = '#000'; g.fillRect(x * 4, y * 4, 4, 4); g.fillStyle = '#666'; } } const t = new THREE.CanvasTexture(c); return t; }

// 인도·광장을 살짝 올린 블록 (줄 단위로 합쳐 한 덩어리)
function buildSidewalks() {
  const geos = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!raised(ground[y][x])) { x++; continue; }
      let e = x; while (e < W && raised(ground[y][e])) e++;
      const g = new THREE.BoxGeometry(e - x, SW_H, 1); g.translate(TX(x) + (e - x) / 2, SW_H / 2, TZ(y) + 0.5); geos.push(g); x = e;
    }
  }
  const merged = mergeGeometries(geos); geos.forEach((g) => g.dispose());
  const m = snowy(wet(M(0x9c9284, { roughness: 0.85 })));
  const mesh = new THREE.Mesh(merged, m); mesh.receiveShadow = true; mesh.castShadow = false; L.ground.add(mesh);
  // 위 면에 보도블록 무늬 대신 지면 텍스처가 보이도록 윗면은 살짝 투명 → 간단히 같은 색 유지
  step(4);
}

/* ───────────── 건물 ───────────── */
function facadeTex(o) {
  // 4가지 무늬 × 8층, 1칸 너비에 창 2개
  const cw = 64, fh = 24, rows = 8, c = CAN(cw * 4, fh * rows), e = CAN(cw * 4, fh * rows), g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = o.wall; g.fillRect(0, 0, c.width, c.height); ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  for (let r = 0; r < rows; r++) for (let v = 0; v < 4; v++) for (let k = 0; k < 2; k++) {
    const x = v * cw + k * 32 + 5, y = r * fh + 5, w = 22, h = fh - 10;
    const lit = Math.random() < o.lit; const col = WARM[(Math.random() * 5) | 0];
    g.fillStyle = lit ? col : o.glass; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x, y, w, 2);
    if (o.balcony) { g.fillStyle = 'rgba(40,40,45,.5)'; g.fillRect(x - 3, y + h - 2, w + 6, 3); }
    if (lit) { ge.fillStyle = col; ge.fillRect(x, y, w, h); if (Math.random() < 0.35) { ge.fillStyle = 'rgba(0,0,0,.6)'; ge.fillRect(x + w * Math.random(), y, 4, h); } }
    g.fillStyle = o.band; g.fillRect(v * cw, r * fh + fh - 2, cw, 2);
  }
  const t = texOf(c), te = texOf(e); for (const x of [t, te]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(0.25, 1 / rows); }
  return { t, te };
}
const KIND = {
  apartments: { wall: '#d8d2c8', glass: '#2a3846', lit: 0.38, balcony: true, band: 'rgba(0,0,0,.16)', fh: 0.3, roof: 0x8d8780 },
  commercial: { wall: '#3a3438', glass: '#1d2830', lit: 0.7, band: 'rgba(255,255,255,.08)', fh: 0.8, roof: 0x55504c },
  school: { wall: '#e6dccb', glass: '#34465a', lit: 0.55, band: 'rgba(120,60,40,.25)', fh: 0.8, roof: 0x6e5a4c },
  public: { wall: '#cfc8bc', glass: '#2a3846', lit: 0.5, band: 'rgba(0,0,0,.15)', fh: 0.8, roof: 0x7a746c },
};
function buildBuildings() {
  const cells = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ch = GRID.bldg[y][x]; if (ch !== '.') (cells[ch] ||= []).push([x, y]); }
  const SCHOOL = { b: ['school', 4, '인천가현초등학교'], c: ['school', 3.2, '가현초 체육관'], m: ['school', 4, '가현중학교'] };
  const groups = {};
  for (const [ch, list] of Object.entries(cells)) {
    const b = GRID.buildings[ch.charCodeAt(0) - 48] || { kind: 'public', levels: 3 };
    let kind = KIND[b.kind] ? b.kind : 'public', floors;
    if (SCHOOL[ch]) { kind = 'school'; floors = SCHOOL[ch][1]; }
    else if (kind === 'apartments') floors = clamp(Math.round((b.levels || 20) * 0.9), 12, 26);
    else floors = b.levels || 3;
    const h = floors * KIND[kind].fh;
    (groups[kind] ||= []).push({ ch, list, h, b, floors });
  }
  for (const [kind, arr] of Object.entries(groups)) {
    const K = KIND[kind], ft = facadeTex(K);
    const pos = [], nor = [], uv = [], Lw = [], Lr = [];
    const quad = (a, b, c, d, n, uvs, list) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); for (let j = 0; j < 4; j++) nor.push(...n); uv.push(...uvs); list.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (const B of arr) {
      const set = new Set(B.list.map(([x, y]) => x + ',' + y)); const h = B.h;
      for (const [cx, cy] of B.list) {
        const x0 = TX(cx), x1 = TX(cx + 1), z0 = TZ(cy), z1 = TZ(cy + 1);
        quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], [0, 0, 0, 1, 1, 1, 1, 0], Lr);
        const nb = (dx, dy) => set.has((cx + dx) + ',' + (cy + dy));
        const faces = [];
        if (!nb(0, 1)) faces.push([[x0, z1], [x1, z1], [0, 0, 1]]);
        if (!nb(0, -1)) faces.push([[x1, z0], [x0, z0], [0, 0, -1]]);
        if (!nb(1, 0)) faces.push([[x1, z1], [x1, z0], [1, 0, 0]]);
        if (!nb(-1, 0)) faces.push([[x0, z0], [x0, z1], [-1, 0, 0]]);
        faces.forEach(([[ax, az], [bx, bz], n], fi) => {
          const v = (hash(cx * 3 + fi, cy * 5) * 4) | 0, vv = h / K.fh;
          quad([ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az], n, [v, 0, v + 1, 0, v + 1, vv, v, vv], Lw);
        });
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([...Lw, ...Lr]); g.addGroup(0, Lw.length, 0); g.addGroup(Lw.length, Lr.length, 1);
    const wm = seeThrough(nglow(new THREE.MeshStandardMaterial({ map: ft.t, emissive: 0xffffff, emissiveMap: ft.te, emissiveIntensity: 0.5, roughness: 0.75 }), kind === 'commercial' ? 0.8 : 0.5, 0.0));
    const rm = seeThrough(snowy(M(K.roof)));
    const mesh = new THREE.Mesh(g, [wm, rm]); mesh.castShadow = mesh.receiveShadow = true; L.build.add(mesh);
    buildingMeshes.push(mesh);
  }
  // 옥상 기계실·물탱크, 동 번호, 학교 이름
  for (const arr of Object.values(groups)) for (const B of arr) {
    if (B.list.length < 3) continue;
    const xs = B.list.map((c) => c[0]), ys = B.list.map((c) => c[1]);
    const mid = B.list[B.list.length >> 1], sx = TX(mid[0] + 0.5), sz = TZ(mid[1] + 0.5);
    if (B.b.kind === 'apartments' && !SCHOOL[B.ch]) {
      box(1.3, 0.9, 1.0, M(0xbfc4c8), sx, B.h + 0.45, sz, L.roof);
      cyl(0.35, 0.35, 0.6, M(0x5b8fc8), sx + 1.1, B.h + 0.3, sz - 0.2, L.roof, 10);
      const nm = (B.b.name || '').replace(/동$/, '');
      if (/^\d{3,4}$/.test(nm)) {
        const maxY = Math.max(...ys), row = B.list.filter((c) => c[1] === maxY).map((c) => c[0]).sort((a, b) => a - b);
        sign(nm + '동', TX(row[row.length >> 1] + 0.5), B.h - 0.45, TZ(maxY + 1) + 0.05, 0.5, { bg: '#15161a', fg: '#ffffff', fs: 60 }, L.build);
      }
    }
    if (SCHOOL[B.ch]) {
      const maxY = Math.max(...ys), row = B.list.filter((c) => c[1] === maxY).map((c) => c[0]).sort((a, b) => a - b);
      sign(SCHOOL[B.ch][2], TX((row[0] + row[row.length - 1] + 1) / 2), B.h - 0.5, TZ(maxY + 1) + 0.05, 0.55, { bg: '#21314a', fg: '#ffffff', fs: 64 }, L.build);
    }
  }
  step(14);
}
const buildingMeshes = [];
// 내 캐릭터를 가리는 건물은 점무늬로 비쳐 보이게 (따라가기 시점)
const ST = { uP: { value: new THREE.Vector3(0, -99, 0) }, uC: { value: new THREE.Vector3() } };
function seeThrough(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uP = ST.uP; sh.uniforms.uC = ST.uC;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform vec3 uP; uniform vec3 uC;').replace('void main() {', `void main() {
      vec3 d = uP - uC; float t = clamp(dot(vW - uC, d) / dot(d, d), 0.0, 1.0);
      float dist = length(vW - (uC + d * t));
      if (uP.y > -50.0 && t < 0.94 && dist < 2.4 && vW.y > 0.25) { if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0 || dist < 1.4) discard; }`);
  };
  return m;
}

/* ───────────── 땅속·지하주차장 ───────────── */
function buildUnder() {
  slab(-W2 - 1, W2 + 1, -7.4, -6, -D2 - 1, D2 + 1, M(0x1a1618, { roughness: 0.5, metalness: 0.3 }), L.under);
  slab(-W2 - 0.6, W2 + 0.6, -6.05, -5.95, -D2 - 0.6, D2 + 0.6, M(0xb08a4c, { metalness: 0.8, roughness: 0.3 }), L.under);
  sign('인천가현초등학교 둘레 · 루원시티   1:300', 0, -6.7, D2 + 1.01, 0.8, { bg: '#b08a4c', fg: '#2a2118', fs: 56, weight: 700, lit: false }, L.under).castShadow = false;
  const gx0 = TX(GAR.x0), gx1 = TX(GAR.x1), gz0 = TZ(GAR.y0), gz1 = D2;
  slab(gx1, W2, -6, -0.4, -D2, D2, mat.earth, L.under);
  slab(gx0, gx1, -6, -0.4, -D2, gz0, mat.earth, L.under);
  slab(gx0, gx1, -6, GAR.bot, gz0, gz1, mat.earth, L.under);
  const gfloor = M(0x5f7a6e, { roughness: 0.35, metalness: 0.1 }), gwall = M(0xb9b4ab, { roughness: 0.9 }), ystrip = M(0xe2b23a);
  slab(gx0, gx1, GAR.bot, GAR.bot + 0.04, gz0, gz1, gfloor, L.under);
  slab(gx1 - 0.08, gx1, GAR.bot, GAR.top, gz0, gz1, gwall, L.under);
  slab(gx0, gx1, GAR.bot, GAR.top, gz0, gz0 + 0.08, gwall, L.under);
  for (let x = gx0 + 2; x < gx1 - 1; x += 4) for (const z of [gz0 + 4, gz0 + 9.5]) {
    if (x > TX(RAMP.x0) - 0.8 && x < TX(RAMP.x1) + 0.8 && z > TZ(RAMP.y0) - 1 && z < TZ(RAMP.y1) + 1) continue;
    slab(x - 0.25, x + 0.25, GAR.bot, GAR.top, z - 0.25, z + 0.25, gwall, L.under); slab(x - 0.26, x + 0.26, GAR.bot, GAR.bot + 0.6, z - 0.26, z + 0.26, ystrip, L.under);
  }
  for (let x = gx0 + 0.5; x < gx1 - 0.5; x += 1) { slab(x, x + 0.04, GAR.bot + 0.04, GAR.bot + 0.05, gz0 + 0.3, gz0 + 2.2, mat.white, L.under, { cast: false }); }
  for (let x = gx0 + 0.5; x < TX(RAMP.x0) - 0.5; x += 1) { slab(x, x + 0.04, GAR.bot + 0.04, GAR.bot + 0.05, gz0 + 6.5, gz0 + 8.5, mat.white, L.under, { cast: false }); }
  for (let x = gx0 + 1; x < gx1 - 1; x += 3) for (const z of [gz0 + 3, gz0 + 7.5, gz0 + 12.5]) slab(x, x + 1.6, GAR.top - 0.08, GAR.top - 0.02, z - 0.06, z + 0.06, mat.garageLight, L.under, { cast: false });
  if (!MOBILE) for (const [x, z] of [[gx0 + 4, gz0 + 5], [gx0 + 11, gz0 + 5], [gx0 + 7, gz0 + 12]]) { const p = new THREE.PointLight(0xdcecff, 3, 12, 1.4); p.position.set(x, GAR.top - 0.4, z); L.under.add(p); }
  for (const [x, z] of [[1, 1.2], [3, 1.2], [5, 1.2], [9, 1.2], [12, 1.2], [2, 7.5], [4, 7.5]]) { const c = car('car'); c.position.set(gx0 + x, GAR.bot + 0.04, gz0 + z); c.rotation.y = Math.PI / 2; L.under.add(c); }
  sign('B1  루원시티 지하주차장', gx0 + 8, GAR.top - 0.55, gz0 + 0.1, 0.45, { bg: '#1d4f8a', fg: '#fff', fs: 54 }, L.under);
  // 유리 앞면·옆면
  slab(gx0, gx1, GAR.bot, GAR.top, gz1 - 0.06, gz1 - 0.02, mat.glass, L.under, { cast: false }).renderOrder = 5;
  slab(gx0 + 0.02, gx0 + 0.06, GAR.bot, GAR.top, gz0, gz1, mat.glass, L.under, { cast: false }).renderOrder = 5;
  // 경사로 (북쪽 위 → 남쪽 아래)
  const rx = (TX(RAMP.x0) + TX(RAMP.x1)) / 2, rz0 = TZ(RAMP.y0), rz1 = TZ(RAMP.y1), len = Math.hypot(rz1 - rz0, RAMP.depth);
  const ramp = box(RAMP.x1 - RAMP.x0, 0.2, len, mat.concrete, rx, -RAMP.depth / 2 - 0.1, (rz0 + rz1) / 2, L.under); ramp.rotation.x = Math.atan2(RAMP.depth, rz1 - rz0);
  slab(TX(RAMP.x0) - 0.15, TX(RAMP.x0), -RAMP.depth, 0.6, rz0, rz1, mat.concrete, L.ground); slab(TX(RAMP.x1), TX(RAMP.x1) + 0.15, -RAMP.depth, 0.6, rz0, rz1, mat.concrete, L.ground);
  slab(TX(RAMP.x0) - 0.15, TX(RAMP.x1) + 0.15, 1.6, 1.72, rz0, rz0 + 1.0, M(0x2b3440), L.ground);
  sign('P  지하주차장 · 출차주의', rx, 1.45, rz0 - 0.02, 0.28, { bg: '#1d4f8a', fg: '#fff', fs: 46, width: 3.0, ry: Math.PI }, L.ground);
  rampWarn = nglow(GLOW(0xffb020, 0), 0, 0); cyl(0.1, 0.1, 0.1, rampWarn, TX(RAMP.x1) - 0.2, 1.8, rz0 + 0.5, L.ground);
  step(6);
}

/* ───────────── 동네 소품 ───────────── */
let rampWarn, crane, craneTop, craneHook, craneCable, craneLoad, craneBeacon, wheel, swings = [], seesaw, sigMats = {};
const treeSpots = [], colliders = [], puddles = [];
function bench(x, z, ry) { const g = new THREE.Group(); g.position.set(x, hY(x, z), z); g.rotation.y = ry; L.ground.add(g); box(0.8, 0.05, 0.24, mat.wood, 0, 0.24, 0, g); box(0.8, 0.2, 0.04, mat.wood, 0, 0.38, -0.11, g); for (const sx of [-0.32, 0.32]) box(0.04, 0.24, 0.22, mat.pole, sx, 0.12, 0, g); }
const T2 = (tx, ty) => [TX(tx), TZ(ty)];
function buildProps() {
  // 가로수
  const nearRoad = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isRoadC(tileAt(x + dx, y + dy))) return true; return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (blocks[y * W + x] || cwAt(x, y) || cwAt(x, y - 1) || cwAt(x, y + 1)) continue;
    const c = ground[y][x]; let t = null;
    if (c === 'g' && (y === 33 || y === 39) && x % 4 === 1 && x > 23) t = [0.8, 2];
    else if (c === 'g' && (x === 17 || x === 22) && y % 4 === 2 && (y < 33 || y > 39) && y !== DRIVE && y !== DRIVE - 1 && y !== DRIVE + 1) t = [0.8, 2];
    else if ((c === 'y' || c === 'g') && hash(x, y) > 0.94 && !nearRoad(x, y) && !(x >= PARK.x0 - 1 && x <= PARK.x1 + 1 && y >= PARK.y0 - 1 && y <= PARK.y1 + 1) && !(x >= SITE.x0 - 2 && x <= SITE.x1 + 2 && y >= SITE.y0 - 2 && y <= SITE.y1 + 2) && !(x >= GAR.x0 && x <= GAR.x1 && y >= DRIVE - 1 && y <= RAMP.y1)) t = [0.75 + hash(y, x) * 0.4, (hash(x * 3, y) * 2) | 0];
    if (t) { const [wx2, wz2] = T2(x + 0.5, y + 0.5); tree(wx2, wz2, t[0], t[1]); treeSpots.push([wx2, wz2]); colliders.push({ x: wx2, z: wz2, r: 0.35 }); }
  }
  step(5);
  // 가로등
  for (let x = 26; x < W; x += 8) { lamp(...T2(x, 34.15), -Math.PI / 2, x % 16 === 10); lamp(...T2(x + 4, 38.85), Math.PI / 2, x % 16 === 2); }
  for (let y = 4; y < H; y += 9) { if (Math.abs(y - 36) < 3) continue; lamp(...T2(17.6, y), 0, false); }
  // 가현초 정문·표지석·울타리
  const [gx, gz] = T2(42, 33.6);
  for (const dx of [-2.6, 2.6]) slab(gx + dx - 0.2, gx + dx + 0.2, 0, 1.3, gz - 0.2, gz + 0.2, M(0x8d6e58));
  sign('인천가현초등학교', ...T2(37.6, 33.4).flatMap((v, i) => (i === 0 ? [v, 0.45] : [v])), 0.36, { bg: '#e8e0cf', fg: '#2c2a26', fs: 60, lit: false, width: 2.4 }, L.ground);
  const fenceM = M(0x2e6b4a);
  for (let x = 24; x < 46; x += 0.5) { if (x > 39 && x < 45) continue; slab(TX(x), TX(x) + 0.04, 0, 0.7, TZ(33.8), TZ(33.8) + 0.04, fenceM, L.ground, { cast: false }); }
  slab(TX(24), TX(39), 0.66, 0.7, TZ(33.8), TZ(33.8) + 0.05, fenceM); slab(TX(45), TX(46), 0.66, 0.7, TZ(33.8), TZ(33.8) + 0.05, fenceM);
  for (const x of [26.4, 35.6]) { const [px, pz] = T2(x, 21.6); slab(px - 0.04, px + 0.04, 0, 0.9, pz - 0.7, pz + 0.7, mat.white); slab(px - 0.04, px + 0.04, 0.86, 0.9, pz - 0.7, pz + 0.7, mat.white); }
  for (const x of [25, 25.5, 26]) cyl(0.03, 0.03, 2.4, mat.metal, ...T2(x, 25.2).flatMap((v, i) => (i === 0 ? [v, 1.2] : [v])), L.ground, 6);
  // 상가 간판 (염곡로 쪽 동면 x=15.4)
  const shops = [['튼튼약국', 9.0, '#ffffff', '#1d8a5a'], ['가현분식', 13.5, '#d8352a', '#fff3c4'], ['태권도', 18.2, '#111111', '#ff4a3a'], ['CAFE 루원', 26.4, '#2b1d16', '#ffcf8a'], ['수학·영어 학원', 28.6, '#111111', '#62d6ff']];
  for (const [n, ty, bg, fg] of shops) { const x = ty > 25 ? 16.05 : 15.05; sign(n, TX(x), 1.25, TZ(ty), 0.3, { bg, fg, fs: 54, ry: Math.PI / 2, glow: bg === '#111111', width: 1.8 }, L.build); slab(TX(x) - 0.02, TX(x) + 0.02, 0.05, 0.9, TZ(ty) - 0.8, TZ(ty) + 0.8, nglow(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe2b5, emissiveIntensity: 0.9 }), 0.9, 0.12), L.build, { cast: false }); }
  sign('24시 편의점', TX(10.5), 1.2, TZ(33.05), 0.32, { bg: '#1f8a4c', fg: '#ffffff', fs: 54, width: 2.4 }, L.build);
  sign('아동안전지킴이집', TX(12.6), 0.75, TZ(33.06), 0.16, { bg: '#ffd400', fg: '#1a1410', fs: 44, width: 1.0 }, L.build);
  slab(TX(8.6), TX(12.2), 0.05, 0.9, TZ(33.02), TZ(33.06), nglow(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff4e0, emissiveIntensity: 1 }), 1.0, 0.15), L.build, { cast: false });
  sign('노래방', TX(15.05), 2.0, TZ(21.5), 0.42, { bg: '#1a0f0f', fg: '#ffd04a', fs: 70, glow: true, ry: Math.PI / 2 }, L.build);
  sign('PC방', TX(16.05), 2.0, TZ(30.5), 0.42, { bg: '#1a0f2a', fg: '#e78bff', fs: 70, glow: true, ry: Math.PI / 2 }, L.build);
  // 안전 집결지
  cyl(0.03, 0.03, 1.6, mat.pole, ...T2(2.2, 33.4).flatMap((v, i) => (i === 0 ? [v, 0.9] : [v])), L.ground, 6);
  sign('안전 집결지', TX(2.6), 1.55, TZ(33.4), 0.24, { bg: '#16a34a', fg: '#fff', fs: 48, width: 1.0 }, L.ground);
  // 버스정류장
  const bs = new THREE.Group(); bs.position.set(TX(72), SW_H, TZ(33.6)); L.ground.add(bs);
  box(2.4, 0.05, 0.8, M(0x2b3440), 0, 1.2, 0, bs); box(2.4, 1.0, 0.03, mat.glass, 0, 0.65, -0.38, bs);
  box(0.5, 0.9, 0.05, nglow(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9fd6ff, emissiveIntensity: 1.6 }), 1.8, 0.4), -0.9, 0.62, -0.34, bs);
  box(1.4, 0.05, 0.26, mat.wood, 0.3, 0.36, -0.2, bs); for (const x of [-1.15, 1.15]) box(0.05, 1.2, 0.05, mat.pole, x, 0.6, 0.35, bs);
  sign('가현초·루원시티 정류장', TX(72), 1.55, TZ(33.6) + 0.42, 0.22, { bg: '#1d4f8a', fg: '#fff', fs: 42 }, L.ground);
  // 신호등 (횡단보도마다)
  for (const c of CW) {
    const mats = { carR: GLOW(0xff2a1a, 0), carY: GLOW(0xffb020, 0), carG: GLOW(0x22ff88, 0), pedR: GLOW(0xff2a1a, 0), pedG: GLOW(0x22ff88, 0) }; sigMats[c.id] = mats;
    const spots = c.axis === 'v' ? [[c.x0 - 0.4, c.y0 - 1.3, Math.PI / 2], [c.x1 + 1.4, c.y1 + 1.3, -Math.PI / 2]] : [[c.x0 - 1.3, c.y1 + 1.4, 0], [c.x1 + 1.3, c.y0 - 0.4, Math.PI]];
    for (const [sx, sy, ry] of spots) {
      const g = new THREE.Group(); const [px, pz] = T2(sx, sy); g.position.set(px, SW_H, pz); g.rotation.y = ry; L.ground.add(g);
      cyl(0.04, 0.04, 2.5, mat.pole, 0, 1.25, 0, g, 6); box(0.04, 0.04, 1.0, mat.pole, 0, 2.4, 0.5, g);
      box(0.18, 0.2, 0.56, M(0x22242a), 0, 2.4, 0.9, g);
      box(0.02, 0.13, 0.13, mats.carR, 0.1, 2.4, 1.08, g, { cast: false }); box(0.02, 0.13, 0.13, mats.carY, 0.1, 2.4, 0.9, g, { cast: false }); box(0.02, 0.13, 0.13, mats.carG, 0.1, 2.4, 0.72, g, { cast: false });
      box(0.16, 0.4, 0.16, M(0x22242a), 0, 1.4, 0, g); box(0.02, 0.14, 0.12, mats.pedR, -0.09, 1.5, 0, g, { cast: false }); box(0.02, 0.14, 0.12, mats.pedG, -0.09, 1.3, 0, g, { cast: false });
    }
  }
  // 30 표지판
  for (const [x, y] of [[38.5, 34.1], [46, 38.9]]) { const [px, pz] = T2(x, y); cyl(0.025, 0.025, 1.6, mat.pole, px, 0.9, pz, L.ground, 6); const s = cyl(0.22, 0.22, 0.03, M(0xffffff), px, 1.75, pz, L.ground, 20); s.rotation.x = Math.PI / 2; sign('30', px, 1.75, pz + 0.025, 0.22, { bg: '#ffffff', fg: '#d42a22', fs: 70, lit: false, width: 0.26 }, L.ground); }
  step(5);
  // 오리 놀이터
  const [slx, slz] = T2(41, 50.2), slide = new THREE.Group(); slide.position.set(slx, 0, slz); L.ground.add(slide);
  box(0.8, 0.9, 0.8, M(0xf2c230), 0, 0.45, 0, slide); box(0.9, 0.1, 0.9, M(0xe0543a), 0, 0.95, 0, slide); const sl = box(0.45, 0.05, 1.5, M(0x2f8ad0), 0, 0.5, 1.0, slide); sl.rotation.x = 0.62;
  for (let i = 0; i < 4; i++) box(0.45, 0.04, 0.16, mat.wood, 0, 0.2 + i * 0.2, -0.5 - i * 0.09, slide);
  const [swx, swz] = T2(45.3, 49.5), sw = new THREE.Group(); sw.position.set(swx, 0, swz); L.ground.add(sw);
  for (const x of [-0.9, 0.9]) box(0.06, 1.3, 0.06, M(0xd42a22), x, 0.65, 0, sw); box(1.9, 0.06, 0.06, M(0xd42a22), 0, 1.3, 0, sw);
  for (const x of [-0.4, 0.4]) { const pv = new THREE.Group(); pv.position.set(x, 1.28, 0); sw.add(pv); box(0.015, 0.95, 0.015, mat.pole, -0.12, -0.47, 0, pv); box(0.015, 0.95, 0.015, mat.pole, 0.12, -0.47, 0, pv); box(0.3, 0.04, 0.16, M(0x2c2b31), 0, -0.95, 0, pv); swings.push(pv); }
  seesaw = box(1.7, 0.06, 0.18, M(0x46a36b), ...T2(45.5, 53.6).flatMap((v, i) => (i === 0 ? [v, 0.35] : [v])), L.ground); seesaw.rotation.y = Math.PI / 2;
  for (const [x, y] of [[39.2, 48.4], [40.2, 52.6], [38.9, 51.2]]) { const d = new THREE.Group(); const [px, pz] = T2(x, y); d.position.set(px, 0, pz); L.ground.add(d); cyl(0.025, 0.025, 0.3, mat.metal, 0, 0.15, 0, d, 6); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M(0xf2c230)); b.position.y = 0.38; b.scale.set(1.3, 0.8, 0.8); d.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M(0xf2c230)); hd.position.set(0.24, 0.6, 0); d.add(hd); ducks.push(d); }
  sign('오리 놀이터', ...T2(42.5, 47.2).flatMap((v, i) => (i === 0 ? [v, 1.2] : [v])), 0.3, { bg: '#f59e0b', fg: '#fff', fs: 50 }, L.ground);
  // 분수대, 수차공원
  const [fx2, fz2] = T2(36.2, 56.2); cyl(0.9, 1.0, 0.25, mat.concrete, fx2, 0.12, fz2, L.ground, 20); const fw = cyl(0.8, 0.8, 0.05, mat.water, fx2, 0.24, fz2, L.ground, 20); fw.castShadow = false; cyl(0.1, 0.15, 0.7, mat.concrete, fx2, 0.5, fz2, L.ground, 8);
  const [wwx, wwz] = T2(48.4, 40.4); const pond = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), mat.water); pond.rotation.x = -Math.PI / 2; pond.position.set(wwx - 1, 0.03, wwz + 0.3); L.ground.add(pond);
  wheel = new THREE.Group(); wheel.position.set(wwx, 0.75, wwz); L.ground.add(wheel); wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.05, 6, 20), mat.wood));
  for (let i = 0; i < 8; i++) { const b = box(0.06, 1.3, 0.24, mat.wood, 0, 0, 0, wheel); b.rotation.z = i * Math.PI / 8; }
  sign('수차공원', wwx, 1.8, wwz, 0.26, { bg: '#3f8f5a', fg: '#fff', fs: 48 }, L.ground);
  // 공사장 울타리·크레인
  const fenceTex = signTex('안전제일 · 공사중 · 출입금지', { bg: '#f2c230', fg: '#1a1410', fs: 60 });
  const fm = new THREE.MeshStandardMaterial({ map: fenceTex.tex, roughness: 0.8 });
  const sx0 = TX(SITE.x0), sx1 = TX(SITE.x1 + 1), sz0 = TZ(SITE.y0), sz1 = TZ(SITE.y1 + 1);
  slab(sx0, sx1, 0, 0.8, sz0, sz0 + 0.05, fm); slab(sx0, sx1, 0, 0.8, sz1 - 0.05, sz1, fm); slab(sx0, sx0 + 0.05, 0, 0.8, sz0, sz1, fm); slab(sx1 - 0.05, sx1, 0, 0.8, sz0, sz1, fm);
  for (let f = 0; f < 3; f++) for (const [x, z] of [[sx0 + 1, sz0 + 1], [sx1 - 1, sz0 + 1], [sx0 + 1, sz1 - 1.6], [sx1 - 1, sz1 - 1.6], [(sx0 + sx1) / 2, sz0 + 1]]) slab(x - 0.1, x + 0.1, f * 1.0, f * 1.0 + 1.0, z - 0.1, z + 0.1, M(0xa9a39a), L.build);
  for (let f = 1; f <= 3; f++) slab(sx0 + 0.8, sx1 - 0.8, f - 0.1, f, sz0 + 0.8, sz1 - 1.4, M(0x9c968c), L.build);
  crane = new THREE.Group(); crane.position.set(sx1 - 0.8, 0, sz0 + 0.6);
  const cy = M(0xf2c230);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.05, 9, 0.05, cy, a * 0.2, 4.5, b * 0.2, crane);
  for (let y = 0; y < 9; y += 0.45) { box(0.4, 0.03, 0.03, cy, 0, y, 0.2, crane); box(0.4, 0.03, 0.03, cy, 0, y, -0.2, crane); }
  craneTop = new THREE.Group(); craneTop.position.y = 9; crane.add(craneTop);
  box(8, 0.24, 0.28, cy, -2.6, 0, 0, craneTop); box(0.9, 0.6, 0.6, M(0xe8e0d0), 0.2, -0.4, 0, craneTop); box(0.8, 0.5, 0.45, M(0x6c7178), 1.6, -0.15, 0, craneTop);
  craneHook = new THREE.Group(); craneHook.position.set(-4.5, 0, 0); craneTop.add(craneHook);
  craneCable = box(0.02, 1, 0.02, mat.pole, 0, -0.5, 0, craneHook); craneLoad = box(0.9, 0.14, 0.3, M(0xb35a2e), 0, -5, 0, craneHook);
  craneBeacon = nglow(GLOW(0xff2a1a, 3), 3, 0.5); box(0.12, 0.12, 0.12, craneBeacon, -6.5, 0.2, 0, craneTop, { cast: false });
  L.roof.add(crane);
  sign('단지 보수공사 · 출입금지', (sx0 + sx1) / 2, 1.0, sz0 - 0.03, 0.26, { bg: '#d42a22', fg: '#fff', fs: 48, ry: Math.PI }, L.ground);
  // 단지 출입구 · 경비실 · 볼록거울
  const [bx2, bz2] = T2(13.3, 56.6); slab(bx2 - 0.8, bx2 + 0.8, 0, 1.0, bz2 - 0.6, bz2 + 0.6, M(0xe6dccb)); slab(bx2 - 0.9, bx2 + 0.9, 1.0, 1.1, bz2 - 0.7, bz2 + 0.7, mat.roof);
  slab(bx2 - 0.6, bx2 + 0.4, 0.45, 0.85, bz2 + 0.6, bz2 + 0.62, nglow(new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xfff0c8, emissiveIntensity: 1.3 }), 1.4, 0.2), L.ground, { cast: false });
  sign('경비실', bx2, 1.25, bz2 + 0.72, 0.2, { bg: '#21314a', fg: '#fff', fs: 46 }, L.ground);
  colliders.push({ x: bx2, z: bz2, r: 0.9 });
  const [mx, mz] = T2(17.4, 57.4); cyl(0.025, 0.025, 1.8, mat.pole, mx, 0.9, mz, L.ground, 6);
  const mir = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05 })); mir.rotation.set(Math.PI / 2, 0, Math.PI * 0.75); mir.position.set(mx, 1.85, mz); L.ground.add(mir);
  cyl(0.29, 0.29, 0.05, M(0xff8a20), mx, 1.85, mz - 0.02, L.ground, 16).rotation.x = Math.PI / 2;
  // 단지 정문 표지
  for (const [x, y, n, ry] of [[55.2, 41.6, '루원시티 루에블리', Math.PI], [59.6, 32.4, '루원시티 센트럴타운', 0]]) { const [px, pz] = T2(x, y); for (const dx of [-1.4, 1.4]) slab(px + dx - 0.18, px + dx + 0.18, 0, 1.3, pz - 0.18, pz + 0.18, M(0x8d7a66)); slab(px - 1.6, px + 1.6, 1.3, 1.52, pz - 0.2, pz + 0.2, M(0x5a4a3c)); sign(n, px, 1.41, pz + (ry ? -0.22 : 0.22), 0.17, { bg: '#5a4a3c', fg: '#ffe9c0', fs: 44, width: 2.8, ry }, L.ground); }
  // 우리 집
  sign('🏠 우리 집', ...T2(46.5, 64.4).flatMap((v, i) => (i === 0 ? [v, 1.1] : [v])), 0.3, { bg: '#ffffff', fg: '#2c2a26', fs: 50 }, L.ground);
  // 벤치
  for (const [x, y, r] of [[39.5, 54.6, 0], [36.4, 51, Math.PI / 2], [9.5, 35.3, 0], [44, 62, 0], [48.6, 51.5, Math.PI / 2]]) bench(...T2(x, y), r);
  // 웅덩이
  for (const [x, y, r] of [[30, 36.6, 0.6], [50, 35.5, 0.5], [58, 37.4, 0.7], [72, 36.2, 0.5], [19.6, 30, 0.5], [20.4, 52, 0.6], [44, 38.6, 0.4], [60, 34.3, 0.4], [33, 38.5, 0.35]]) {
    const [px, pz] = T2(x, y); const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0 }));
    p.rotation.x = -Math.PI / 2; p.position.set(px, hY(px, pz) + 0.012, pz); p.scale.set(1, 0.6 + hash(x, y) * 0.5, 1); L.ground.add(p); puddles.push(p);
  }
  step(8);
}
const ducks = [];

/* ───────────── 교통 (우측 통행, 예전 가현편 차선) ───────────── */
const LANES = {
  E: { axis: 'x', dir: 1, c: 37.2, from: 18, to: 92, stops: [['S', 40.5], ['E', 64.5]] },
  Wb: { axis: 'x', dir: -1, c: 35.8, from: 92, to: 19.4, stops: [['E', 67.5], ['S', 43.5]], turn: 'Sb' },
  N: { axis: 'y', dir: -1, c: 20.6, from: 73, to: -3, stops: [['N', 48.5], ['W', 28.5]] },
  Sb: { axis: 'y', dir: 1, c: 19.4, from: -3, to: 73, stops: [['W', 25.5], ['N', 45.5]] },
};
const cars = [];
const PH = [['carG', 9], ['carY', 1.6], ['allR', 1], ['pedG', 9], ['pedBlink', 2.5], ['allR2', 1]];
const CYCLE = PH.reduce((a, p) => a + p[1], 0);
const sigClock = { t: 0, hold: {} };
function phaseOf(id) { const c = CW.find((k) => k.id === id); let t = ((sigClock.t + c.off) % CYCLE + CYCLE) % CYCLE; for (const [n, d] of PH) { if (t < d) return n; t -= d; } return 'carG'; }
const carGo = (id) => { const p = phaseOf(id); return p === 'carG' || p === 'carY'; };
const pedGo = (id) => { const p = phaseOf(id); return p === 'pedG' || p === 'pedBlink'; };
function updateSignals(dt, t) {
  sigClock.t += dt;
  for (const c of CW) {
    const p = phaseOf(c.id), s = sigMats[c.id], on = 3.2;
    s.carG.emissiveIntensity = p === 'carG' ? on : 0; s.carY.emissiveIntensity = p === 'carY' ? on : 0; s.carR.emissiveIntensity = p !== 'carG' && p !== 'carY' ? on : 0;
    s.pedG.emissiveIntensity = p === 'pedG' || (p === 'pedBlink' && Math.sin(t * 12) > 0) ? on : 0; s.pedR.emissiveIntensity = !pedGo(c.id) ? on : 0;
  }
}
function lanePos(L, p) { return L.axis === 'x' ? [TX(p), TZ(L.c)] : [TX(L.c), TZ(p)]; }
function laneRot(L) { return L.axis === 'x' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? -Math.PI / 2 : Math.PI / 2); }
function spawnCar(lane, kind, o = {}) {
  const L = LANES[lane], g = car(kind); const p = o.at ?? L.from;
  const [x, z] = lanePos(L, p); g.position.set(x, 0.0, z); g.rotation.y = laneRot(L); L2.ground.add(g);
  const c = { g, lane, L, p, v: o.v ?? 4, vmax: o.vmax ?? rand(3.5, 5), len: g.userData.len / 1, kind, ...o };
  cars.push(c); return c;
}
const L2 = L; // 레이어 묶음 별칭 (LANES 변수 L과 헷갈리지 않게)
function removeCar(c) { L2.ground.remove(c.g); cars.splice(cars.indexOf(c), 1); }
const carTimer = { E: 1, Wb: 2, N: 0.5, Sb: 3 }; let busTimer = 8;
const KINDS = ['car', 'car', 'car', 'taxi', 'car', 'truck', 'car'];
function updateTraffic(dt, t) {
  for (const k in carTimer) if ((carTimer[k] -= dt) <= 0) { carTimer[k] = rand(2.5, 5); if (!cars.some((c) => c.lane === k && Math.abs(c.p - LANES[k].from) < 4)) spawnCar(k, KINDS[(Math.random() * KINDS.length) | 0]); }
  if ((busTimer -= dt) <= 0) { busTimer = 50; if (!cars.some((c) => c.kind === 'bus')) { const b = spawnCar('Wb', 'bus', { vmax: 3.6 }); b.busStop = 73.5; } }
  const ppx = player.g ? player.g.position.x : 1e9, ppz = player.g ? player.g.position.z : 1e9;
  for (const c of [...cars]) {
    const L = c.L; let target = c.vmax; const front = c.p + L.dir * c.len / 2;
    for (const [id, sp] of L.stops) { const d = (sp - front) * L.dir; if (d > -0.2 && d < 5 && !carGo(id)) target = Math.min(target, Math.max(0, d - 0.1) * 1.6); }
    if (c.busStop != null) { const d = (c.busStop - c.p) * L.dir; if (d > -0.1 && d < 6) { target = Math.min(target, Math.max(0, d) * 1.2); if (d < 0.08) { c.hold = c.hold ?? 6; } } }
    if (c.stopAt != null) { const d = (c.stopAt - c.p) * L.dir; target = Math.min(target, Math.max(0, d) * 1.3); if (d < 0.06) c.arrived = true; }
    if (c.hold > 0) { c.hold -= dt; target = 0; if (c.hold <= 0) { c.busStop = null; c.hold = -1; } }
    for (const o of cars) { if (o === c || o.lane !== c.lane) continue; const gap = (o.p - c.p) * L.dir - (o.len + c.len) / 2; if (gap > -0.3 && gap < 3.5) target = Math.min(target, Math.max(0, gap - 0.4) * 1.6); }
    // 사람(나) 앞에서 멈춤
    const [cx, cz] = lanePos(L, c.p + L.dir * (c.len / 2 + 0.8));
    if (Math.hypot(cx - ppx, cz - ppz) < 1.1) target = 0;
    c.v = lerp(c.v, target, 1 - Math.exp(-dt * 3)); c.p += c.v * dt * L.dir;
    if (L.turn && (c.p - LANES[L.turn].c) * L.dir <= 0.0) { c.lane = L.turn; c.L = LANES[L.turn]; c.p = 35.8; c.g.rotation.y = laneRot(c.L); }
    else if (c.lane === 'N' && !c.turned && c.p <= 37.2 && c.p > 36.6 && hash(c.g.id, 1) > 0.5) { c.turned = true; c.lane = 'E'; c.L = LANES.E; c.p = 20.6; c.g.rotation.y = laneRot(c.L); }
    const [x, z] = lanePos(c.L, c.p); c.g.position.x = x; c.g.position.z = z;
    c.g.visible = Math.abs(x) < W2 - 0.6 && Math.abs(z) < D2 - 0.6;
    if (c.g.userData.beacons) { const b = Math.sin(t * 14) > 0; c.g.userData.beacons[0].emissiveIntensity = b ? 5 : 0.2; c.g.userData.beacons[1].emissiveIntensity = b ? 0.2 : 5; }
    if (c.g.userData.hazard) c.g.userData.hazard[0].emissiveIntensity = Math.sin(t * 6) > 0 ? 3 : 0;
    if ((c.p - c.L.to) * c.L.dir > 0 && !c.keep) removeCar(c);
  }
}
// 지하주차장 출차: 주차장 안 → 경사로 위로 → 단지 찻길 동쪽 → 정지선 → 염곡로(남행)
const gcar = { g: null, s: 0, wait: 4, stop: 0, waited: false };
const RAMP_ANG = () => Math.atan2(RAMP.depth, RAMP.y1 - RAMP.y0);
function updateGarageCar(dt, t) {
  if (!gcar.g) { rampWarn.emissiveIntensity = 0; gcar.wait -= dt; if (gcar.wait > 0) return; gcar.g = car('car'); gcar.g.rotation.order = 'YXZ'; L.under.add(gcar.g); gcar.s = 0; gcar.stop = 0; gcar.waited = false; }
  const g = gcar.g, rx = (TX(RAMP.x0) + TX(RAMP.x1)) / 2;
  if (gcar.stop > 0) { gcar.stop -= dt; if (gcar.block) gcar.stop = Math.max(gcar.stop, 0.3); } else gcar.s += dt * 2.4;
  const s = gcar.s, y0 = GAR.bot + 0.04, aisleZ = TZ(66.5);
  const A = 7, B = 1.2, C = RAMP.y1 - RAMP.y0, Dl = 15.2 - RAMP.x1 + 1.5;
  if (s < A) { g.position.set(TX(1) + s, y0, aisleZ); g.rotation.set(0, 0, 0); }
  else if (s < A + B) { const k = (s - A) / B; g.position.set(lerp(TX(1) + A, rx, k), y0, lerp(aisleZ, TZ(RAMP.y1), k)); g.rotation.set(0, k * Math.PI / 2, 0); }
  else if (s < A + B + C) { const k = (s - A - B) / C; const z = lerp(TZ(RAMP.y1), TZ(RAMP.y0), k); g.position.set(rx, -RAMP.depth * (1 - k) + 0.04, z); g.rotation.set(0, Math.PI / 2, RAMP_ANG()); }
  else {
    if (g.parent !== L.ground) { L.under.remove(g); L.ground.add(g); }
    const k = s - (A + B + C);
    if (k < 1.0) { g.position.set(rx, 0.03, TZ(RAMP.y0) - k * 0.5); g.rotation.set(0, Math.PI / 2 - k * Math.PI / 2, 0); }
    else {
      const x = rx + (k - 1) * 1.0;
      if (!gcar.waited && x >= TX(14.2)) { gcar.waited = true; gcar.stop = 2.4; }
      g.position.set(Math.min(x, TX(19.4)), 0.03, TZ(DRIVE + 0.5)); g.rotation.set(0, 0, 0);
      if (x >= TX(19.4)) { L.ground.remove(g); spawnCar('Sb', 'car', { at: DRIVE + 0.5, v: 1.0 }); gcar.g = null; gcar.wait = rand(10, 16); }
    }
  }
  gcar.moving = !!gcar.g && s > A && gcar.stop <= 0;
  rampWarn.emissiveIntensity = gcar.g && s > A ? (Math.sin(t * 10) > 0 ? 4 : 0) : 0;
}

// 걸어 다니는 사람들 (인도 위)
const walkers = [];
function spawnWalkers() {
  const routes = [[34.6, 23, 88, 'x'], [38.4, 23, 88, 'x'], [16.6, 0, 69, 'y'], [22.6, 0, 33, 'y'], [22.6, 39, 69, 'y'], [57.5, 39, 69, 'y']];
  for (let i = 0; i < (MOBILE ? 14 : 26); i++) {
    const r = routes[i % routes.length], kid = Math.random() < 0.5;
    const p = person({ kid, bag: !kid && Math.random() < 0.3 });
    const w = { g: p, r, d: Math.random() < 0.5 ? 1 : -1, p: rand(r[1], r[2]), v: rand(0.7, 1.1), off: rand(-0.3, 0.3) };
    L.ground.add(p); walkers.push(w);
  }
}
function updateWalkers(dt, t) {
  for (const w of walkers) {
    const [c, a, b, ax] = w.r; w.p += w.d * w.v * dt; if (w.p > b) { w.p = b; w.d = -1; } if (w.p < a) { w.p = a; w.d = 1; }
    const x = ax === 'x' ? TX(w.p) : TX(c + w.off), z = ax === 'x' ? TZ(c + w.off) : TZ(w.p);
    w.g.position.set(x, hY(x, z), z); w.g.rotation.y = ax === 'x' ? (w.d > 0 ? Math.PI / 2 : -Math.PI / 2) : (w.d > 0 ? 0 : Math.PI);
    animWalk(w.g, t, true);
  }
}

/* ───────────── 나 (플레이어) ───────────── */
const player = { g: null, x: 0, z: 0, face: Math.PI, speed: 0, safe: [0, 0], frozen: 0, ride: false, mask: false };
const keys = new Set();
const joy = { on: false, x: 0, y: 0, id: null, cx: 0, cy: 0 };
function makePlayer() {
  const g = person({ kid: true, shirt: 0xe0543a, pants: 0x1d2d4a, cap: 0xffd23f, bag: true, bagColor: 0x2f6fd0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03 / PS; g.add(ring);
  helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0x46c36b)); helmetMesh.position.y = 0.6; helmetMesh.visible = false; g.add(helmetMesh);
  maskMesh = box(0.12, 0.06, 0.03, M(0xffffff), 0, 0.5, 0.07, g); maskMesh.visible = false;
  scooter = new THREE.Group(); box(0.1, 0.03, 0.5, M(0x2f8ad0), 0, 0.05, 0, scooter); box(0.03, 0.5, 0.03, mat.pole, 0, 0.3, 0.22, scooter); scooter.visible = false; g.add(scooter);
  const [x, z] = T2(46.5, 63.5); player.x = x; player.z = z; player.safe = [x, z];
  g.position.set(x, hY(x, z), z); L.ground.add(g); player.g = g;
  const d = document.createElement('div'); d.className = 'me'; d.textContent = '나'; const o = new CSS2DObject(d); o.position.set(0, 1.25 / PS, 0); g.add(o);
}
let helmetMesh, maskMesh, scooter;
function blockedAt(x, z) {
  if (inRoom) return roomBlocked(x, z);
  const tx = FX(x), ty = FZ(z);
  if (tx < 0.3 || ty < 0.3 || tx > W - 0.3 || ty > H - 0.3) return true;
  if (blocks[(ty | 0) * W + (tx | 0)]) return true;
  if (ground[ty | 0][tx | 0] === 'p') return true;
  for (const c of colliders) if (Math.hypot(c.x - x, c.z - z) < c.r) return true;
  return false;
}
let warnT = 0;
function warn(msg) { if (warnT > 0) return; warnT = 1.6; toast(msg); audio.bad(); if (cur) cur.mistakes++; }
function updatePlayer(dt, t) {
  if (!player.g) return;
  warnT -= dt;
  let ix = 0, iz = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) ix -= 1; if (keys.has('ArrowRight') || keys.has('KeyD')) ix += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) iz -= 1; if (keys.has('ArrowDown') || keys.has('KeyS')) iz += 1;
  if (joy.on) { ix += joy.x; iz += joy.y; }
  const len = Math.hypot(ix, iz);
  const slow = keys.has('ShiftLeft') || keys.has('ShiftRight') || slowBtn;
  let vmax = (player.ride ? 4.6 : 2.6) * (slow ? 0.45 : 1);
  if (onIce()) vmax = Math.min(vmax, slow ? 0.9 : 1.6);
  if (player.frozen > 0) { player.frozen -= dt; ix = iz = 0; }
  if (len > 0.05 && player.frozen <= 0 && !dialogOpen()) {
    // 카메라 방향 기준
    const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const nx = ix / Math.max(1, len), nz = iz / Math.max(1, len);
    const dx = nx * Math.cos(yaw) + nz * Math.sin(yaw), dz = -nx * Math.sin(yaw) + nz * Math.cos(yaw);
    const sp = vmax * Math.min(1, len);
    player.speed = sp;
    player.face = Math.atan2(dx, dz);
    let x2 = player.x + dx * sp * dt, z2 = player.z + dz * sp * dt;
    if (!blockedAt(x2, player.z)) player.x = x2; if (!blockedAt(player.x, z2)) player.z = z2;
  } else player.speed = 0;
  const g = player.g; g.position.set(player.x, inRoom ? 0.04 : hY(player.x, player.z), player.z);
  g.rotation.y = lerpAngle(g.rotation.y, player.face, 1 - Math.exp(-dt * 12)); animWalk(g, t, player.speed > 0.1);
  scooter.visible = player.ride && !player.bike;
  if (inRoom) return;
  // 차도 안전 규칙
  const tx = FX(player.x), ty = FZ(player.z), c = tileAt(tx, ty), cw = cwAt(tx, ty);
  if (isRoadC(c) && !cw) { warn('🚫 찻길로 건너면 위험해요! 횡단보도로 건너요.'); player.x = player.safe[0]; player.z = player.safe[1]; player.frozen = 0.5; }
  else if (cw && !pedGo(cw.id) && !player.onCw) { warn('🔴 빨간불이에요! 초록불이 켜질 때까지 기다려요.'); player.x = player.safe[0]; player.z = player.safe[1]; player.frozen = 0.5; }
  else if (c === 'a' && gcar.moving && gcar.g && gcar.g.parent === L.ground && Math.abs(gcar.g.position.x - player.x) < 2.2) { warn('🚗 차가 나와요! 노란 선에서 멈추고 볼록거울을 봐요.'); player.x = player.safe[0]; player.z = player.safe[1]; player.frozen = 0.6; }
  else if (!isRoadC(c) && !cw && c !== 'a') player.safe = [player.x, player.z];
  player.onCw = !!cw;
  for (const ca of cars) { if (!ca.g.visible) continue; const d = Math.hypot(ca.g.position.x - player.x, ca.g.position.z - player.z); if (d < 0.7 && ca.v > 1) { warn('💥 차와 부딪칠 뻔했어요! 차가 멈춘 걸 확인하고 건너요.'); player.x = player.safe[0]; player.z = player.safe[1]; player.frozen = 0.6; } }
  // 미션 시작: NPC 가까이
  if (!cur) for (const id of ORDER) { const n = npcObjs[id]; if (n && !state.done[id] && Math.hypot(n.position.x - player.x, n.position.z - player.z) < 1.0) { startMission(id, true); break; } }
  gcar.block = Math.abs(player.x - TX(15.8)) < 1.2 && Math.abs(player.z - TZ(DRIVE + 0.5)) < 1.4;
}
const lerpAngle = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
let slowBtn = false;
function onIce() { return fx.ice && fx.ice.some(([x, z]) => Math.abs(x - player.x) < 0.6 && Math.abs(z - player.z) < 0.6); }
/* ───────────── 날씨 ───────────── */
const env = { weather: 'rain', time: 'night', haze: 0 };
const wx = { rain: 1, snow: 0, day: 0, haze: 0 }; // 부드럽게 바뀌는 값
const BOX = { x: 40, y0: 0, y1: 30, z: 30 };
let rain, snow, splashes;
function buildWeather() {
  const N = MOBILE ? 2500 : 6000;
  const rp = new Float32Array(N * 6), rv = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = rand(-BOX.x, BOX.x), y = rand(0, BOX.y1), z = rand(-BOX.z, BOX.z); rp.set([x, y, z, x - 0.02, y - 0.4, z + 0.01], i * 6); rv[i] = rand(22, 30); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb0d6, transparent: true, opacity: 0.3 })); rain.userData.v = rv; rain.frustumCulled = false; root.add(rain);
  const S = MOBILE ? 1800 : 4500; const sp = new Float32Array(S * 3), sv = new Float32Array(S);
  for (let i = 0; i < S; i++) { sp.set([rand(-BOX.x, BOX.x), rand(0, BOX.y1), rand(-BOX.z, BOX.z)], i * 3); sv[i] = rand(0, 6); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sc = CAN(32, 32), g = sc.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.22, map: texOf(sc), transparent: true, depthWrite: false, opacity: 0 })); snow.userData.v = sv; snow.frustumCulled = false; root.add(snow);
  // 빗방울 튀김
  const R = 260; splashes = new THREE.InstancedMesh(new THREE.RingGeometry(0.03, 0.045, 10), new THREE.MeshBasicMaterial({ color: 0xc9d6f0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }), R);
  splashes.userData.t = new Float32Array(R).map(() => Math.random()); splashes.userData.p = Array.from({ length: R }, () => new THREE.Vector3(rand(-BOX.x, BOX.x), 0.06, rand(-BOX.z, BOX.z)));
  splashes.frustumCulled = false; L.ground.add(splashes);
  for (const p of [rain, snow]) p.position.y = 0;
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
  scene.fog.color.copy(tmpC); scene.fog.density = 0.0014 + wx.rain * 0.0008 + wx.snow * 0.0012 + wx.haze * 0.012;
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
  for (const m of snowMats) { m.color.copy(m.userData.base).lerp(snowWhite, wx.snow * 0.6); }
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
    for (let i = 0; i < T.length; i++) { T[i] += dt * 2.2; if (T[i] > 1) { T[i] = 0; { const sx = rand(-BOX.x, BOX.x), sz = rand(-BOX.z, BOX.z); P[i].set(sx, hY(sx, sz) + 0.02, sz); } }
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
  for (const u of umbrellas) u.visible = wx.rain > 0.4 && !inRoom;
  tilt.uniforms.amount.value = view === 'follow' ? 0.55 : 1.0;
  snowCover.material.opacity = wx.snow * 0.55;
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

/* ───────────── 미션 ───────────── */
const NPC = {
  guard: { vest: true, cap: 0xf2c230, shirt: 0x46a36b, face: '🦺' }, student: { shirt: 0x1d2d4a, bag: true, face: '🧑‍🎓' }, bro: { kid: true, shirt: 0x2f6fd0, helmet: 0x46c36b, face: '🧒' },
  keeper: { shirt: 0x2b3440, cap: 0x2b3440, face: '🧓' }, friend: { kid: true, shirt: 0xff8fb1, face: '👧' }, stranger: { shirt: 0x2a2a2a, cap: 0x111111, face: '🕶️' },
  manager: { shirt: 0xffffff, cap: 0xffffff, face: '👨‍🍳' }, teacher: { shirt: 0x8a4fd0, face: '👩‍🏫' }, worker: { vest: true, helmet: 0xf2c230, shirt: 0x3a6fb8, face: '👷' },
  kid3: { kid: true, shirt: 0xf0c13a, face: '👧' }, grandma: { shirt: 0x9b6b8a, hair: 0xcfcfcf, face: '👵' }, medic: { shirt: 0xf2f2ee, face: '🧑‍⚕️' },
  mom: { shirt: 0xd88a5a, face: '👩' }, officer: { shirt: 0x1d2d5a, cap: 0x1d2d5a, face: '👮' }, kid2: { kid: true, shirt: 0x46a36b, face: '👦' }, little: { kid: true, shirt: 0xffd36b, face: '🧒' },
};
const NAMES = { guard: '등굣길 지킴이 이모', student: '중학생 형', bro: '옆 반 친구 준호', keeper: '경비 아저씨', friend: '친구 서연', stranger: '모르는 아저씨', manager: '분식집 사장님', teacher: '담임 선생님', worker: '공사장 아저씨', kid3: '친구 하은', grandma: '지나가던 할머니', medic: '구급대원', mom: '엄마', officer: '경찰관', kid2: '친구 민준', little: '길 잃은 동생' };
// at: NPC 자리(칸), goals: 걸어가야 할 노란 고리(칸) — 예전 가현편과 같은 자리
const MI = {
  cross: { npc: 'guard', at: [40.2, 39.6], goals: [[42, 31.4]], go: '신호를 보고 횡단보도로 건너서 학교 정문(노란 고리)까지 가 보자!', rule: '서기 · 보기 · 걷기! 초록불이어도 좌우를 살피고, 손을 들고 건너요.' },
  bus: { npc: 'student', at: [75.4, 32.8], goals: [[71, 39.6]], go: '버스가 떠난 뒤, 루원시티 앞 횡단보도로 건너서 길 건너편 고리까지 가 보자.', rule: '버스 앞·뒤로 건너지 않아요. 버스가 떠난 뒤, 가까운 횡단보도로!', fx: 'bus' },
  kick: { npc: 'bro', at: [57.6, 39.6], goals: [[58.8, 40.6], [48.6, 48.2]], go: '먼저 초록 헬멧(노란 고리)을 쓰고, 오리 놀이터까지 킥보드로 가 보자. 사람 옆에서는 천천히!', rule: '킥보드는 안전모·보호대를 쓰고, 사람 옆에서는 천천히!', fx: 'kick' },
  park: { npc: 'keeper', at: [15.0, 61], goals: [[16.5, 52.5]], go: '단지 출입구 노란 정지선에서 멈췄다가, 차가 지나간 뒤 북쪽 고리까지 가 보렴.', rule: '주차장 출입구에서는 노란 선에 멈추고, 볼록거울과 좌우를 살펴요.', fx: 'park' },
  play: { npc: 'friend', at: [43.6, 56.2], goals: [[41, 48.9], [45.5, 55.2]], go: '미끄럼틀 계단(노란 고리)으로 올라갔다가, 그네를 피해서 시소 옆으로 와!', rule: '미끄럼틀은 계단으로 올라 앉아서 내려오고, 그네 앞뒤는 멀리 돌아가요.', fx: 'play' },
  stranger: { npc: 'stranger', at: [22.9, 31.4], goals: [[12.4, 34.6]], go: '"싫어요!" 하고 떠나자. 아동안전지킴이집(편의점)으로 가서 알려야 해. 횡단보도로 건너요!', rule: '"싫어요! 안 돼요!" 크게 거절하고, 아동안전지킴이집으로 가서 알려요.', fx: 'stranger' },
  fire: { npc: 'manager', at: [16.6, 15.2], goals: [[4.5, 34.3]], go: '119에는 내가 신고했어! 연기 속에서는 몸을 낮추고(Shift·천천히), 편의점 옆 안전 집결지로 대피해!', rule: '"불이야!" 외치고, 코와 입을 막고 몸을 낮춰 계단으로 대피해요.', fx: 'fire' },
  quake: { npc: 'teacher', at: [28.6, 23.0], goals: [[31, 21.6]], go: '곧 흔들려요! 건물에서 떨어진 운동장 가운데(노란 고리)로!', rule: '흔들리면 머리를 감싸고, 건물·담장에서 먼 넓은 곳으로.', fx: 'quake' },
  site: { npc: 'worker', at: [22.6, 38.9], goals: [[25.8, 46.4]], go: '착하구나! 공사장 울타리 바깥으로 돌아서 남쪽 고리까지 가 보렴.', rule: '공사장 안 지름길은 절대 안 돼요. 조금 멀어도 울타리 바깥으로!', fx: 'site' },
  aid: { npc: 'grandma', at: [60.6, 45.4], goals: [[60.5, 38.8]], go: '구급차가 교육로로 오고 있어! 길가(노란 고리)에 서서 손을 흔들어 위치를 알려 줘!', rule: '어른을 부르고 119! 있는 곳·상황을 말하고, 끊으라고 할 때까지 기다려요.', fx: 'aid' },
  dog: { npc: 'kid2', at: [54.1, 50.4], goals: [[55.3, 64.2]], go: '산책길 아래쪽(노란 고리)으로 가야 해. 개가 오면 나무처럼 가만히 서 있어!', rule: '모르는 개가 다가오면 나무처럼 가만히, 눈을 마주치지 않아요.', fx: 'dog' },
  storm: { npc: 'officer', at: [47.2, 38.6], goals: [[40, 43.4]], go: '나무를 피해서 저 아파트 공동현관(노란 고리) 안으로 대피하렴!', rule: '번개가 치면 나무 밑·넓은 곳은 피하고, 가까운 건물 안으로!', fx: 'storm' },
  dust: { npc: 'mom', at: [48.6, 63.4], goals: [[43.0, 60.3], [42, 32.4]], fx: 'dust', rule: 'KF80 이상 마스크를 코까지 꼭 맞게! 다녀와서 손·얼굴을 씻어요.' },
  ice: { npc: 'grandma', at: [58.4, 34.6], goals: [[44.6, 34.5]], go: '빙판에서는 종종걸음(Shift·천천히 버튼)으로, 정문 쪽 고리까지 가 보렴.', rule: '빙판길은 주머니에서 손을 빼고, 보폭을 좁게 천천히 걸어요.', fx: 'ice' },
  lost: { npc: 'little', at: [47.4, 57.4], goals: [[15.4, 54.8]], rule: '길 잃은 동생은 경비실·아동안전지킴이집 어른에게 함께 가서 알려요.', fx: 'lost', go: '동생 손 잡고 경비실(서쪽 단지 출입구)까지! 동생이 따라오게 천천히, 횡단보도로 건너요.' },
};
const ORDER = ['cross', 'bus', 'kick', 'park', 'play', 'stranger', 'fire', 'quake', 'site', 'aid', 'dog', 'storm', 'dust', 'ice', 'lost'];
const state = { done: {}, name: '', rooms: {} };
try { const s = JSON.parse(localStorage.getItem('gahyeon-box2') || '{}'); if (s.done) state.done = s.done; if (s.name) state.name = s.name; if (s.rooms) state.rooms = s.rooms; } catch (e) { /* 저장 불가 */ }
const save = () => { try { localStorage.setItem('gahyeon-box2', JSON.stringify(state)); } catch (e) { /* 저장 불가 */ } };
const pins = {}, npcObjs = {};
function setupMissions() {
  ORDER.forEach((id) => {
    const m = MI[id], T = TALK[id];
    const [x, z] = T2(...m.at), y = hY(x, z);
    const fig = id === 'aid' ? 'kid3' : m.npc;
    const p = person(NPC[fig]); p.position.set(x, y, z); p.rotation.y = Math.PI; L.ground.add(p); npcObjs[id] = p;
    if (id === 'aid') { p.rotation.set(0, 0, Math.PI / 2); p.position.y = y + 0.12; const gm = person(NPC.grandma); gm.position.set(x + 0.6, y, z + 0.3); gm.rotation.y = -Math.PI / 2; L.ground.add(gm); }
    const d = document.createElement('div'); d.className = 'pin'; d.innerHTML = `<div class="bub">${T.icon}</div><div class="tag">${T.title}</div>`;
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    d.addEventListener('click', (e) => { e.stopPropagation(); startMission(id, false); });
    const o = new CSS2DObject(d); o.position.set(x, y + 1.35, z); L.ground.add(o); pins[id] = { o, d };
    const li = document.createElement('li'); li.dataset.id = id; li.innerHTML = `<span class="ic">${T.icon}</span><span class="t">${T.title}</span><span class="s"></span>`;
    li.onclick = () => startMission(id, false); $('mlist').appendChild(li);
  });
  // 노란 고리 (목표)
  goalObj = new THREE.Group(); goalObj.visible = false; L.ground.add(goalObj);
  const gm = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), gm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; goalObj.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 3; goalObj.add(beam); goalObj.userData.ring = ring;
  const gl = document.createElement('div'); gl.className = 'goal'; gl.textContent = '🎯'; const go = new CSS2DObject(gl); go.position.y = 1.6; goalObj.add(go);
  refreshProgress();
}
let goalObj;
function refreshProgress() {
  let n = 0, st = 0;
  for (const id of ORDER) { const s = state.done[id]; pins[id].d.classList.toggle('done', !!s); const li = document.querySelector(`#mlist li[data-id="${id}"]`); li.classList.toggle('done', !!s); li.querySelector('.s').textContent = s ? '★'.repeat(s) : ''; if (s) { n++; st += s; } }
  $('done').textContent = n; $('stars').textContent = '★ ' + st; $('prog-head').querySelector('em').textContent = '/' + ORDER.length;
}

let cur = null;
function dialogOpen() { return cur && !cur.walking && !cur.ruleShown ? true : (cur && cur.ruleShown); }
function startMission(id, byWalk) {
  if (cur && cur.id === id) return;
  if (cur) endMission();
  audio.click();
  const m = MI[id], T = TALK[id];
  cur = { id, step: 0, mistakes: 0, talk: [...T.talk], gi: 0, walking: false };
  if (m.go) cur.talk.push({ who: m.npc, say: m.go });
  cur.talk.push({ walk: true });
  document.body.classList.add('busy');
  for (const k in pins) pins[k].d.classList.toggle('active', k === id);
  $('c-icon').textContent = T.icon; $('c-title').textContent = T.title; $('c-no').textContent = 'MISSION ' + String(ORDER.indexOf(id) + 1).padStart(2, '0');
  $('card').classList.remove('hidden', 'walk'); viewShift();
  // 내 캐릭터를 NPC 앞에 세우고 카메라를 따라가기로
  const n = npcObjs[id].position;
  if (!byWalk) { let px = n.x, pz = n.z + 1.1; for (const [dx, dz] of [[0, 1.1], [0, -1.1], [1.1, 0], [-1.1, 0], [0.8, 0.8], [-0.8, 0.8]]) { if (!blockedAt(n.x + dx, n.z + dz) && !isRoadC(tileAt(FX(n.x + dx), FZ(n.z + dz)))) { px = n.x + dx; pz = n.z + dz; break; } } player.x = px; player.z = pz; player.safe = [px, pz]; }
  player.face = Math.atan2(n.x - player.x, n.z - player.z);
  if (view !== 'follow') setView('follow', true); else followSnap(1.2);
  fxStart(m.fx, id); newFxStart(m.fx);
  showStep();
}
function showStep() {
  const s = cur.talk[cur.step];
  const ch = $('c-choices'), why = $('c-why'), nx = $('c-next');
  ch.innerHTML = ''; why.className = 'hidden'; why.textContent = ''; nx.classList.add('hidden');
  if (s.walk) { beginWalk(); return; }
  if (s.roomEnd) { const id = cur.id; roomObjs[id].quiz = true; endMission(); checkBadge(id); roomHud(); if (!state.rooms[id] && roomObjs[id].R.task && !roomObjs[id].taskDone) toast('💬 이야기 완료! 이제 ' + roomObjs[id].R.task.title + ' (물건을 누르거나 가까이 가서 살펴보기)'); return; }
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
  }
}
function next() { audio.click(); cur.step++; showStep(); }
function beginWalk() {
  cur.walking = true; cur.gi = 0; $('card').classList.add('walk');
  $('c-face').textContent = '🎯'; $('c-name').textContent = '직접 가 보기';
  placeGoal(); fxWalk(MI[cur.id].fx); newFxWalk(MI[cur.id].fx);
}
function placeGoal() {
  const g = MI[cur.id].goals[cur.gi], [x, z] = T2(...g);
  goalObj.position.set(x, hY(x, z), z); goalObj.visible = true;
  const last = cur.gi === MI[cur.id].goals.length - 1;
  $('c-text').textContent = (MI[cur.id].goals.length > 1 ? `${cur.gi + 1}/${MI[cur.id].goals.length} ` : '') + '노란 고리까지 걸어가요 🎯' + (last ? '' : '');
}
function updateMission(dt, t) {
  if (!cur || !cur.walking) return;
  const d = Math.hypot(goalObj.position.x - player.x, goalObj.position.z - player.z);
  $('c-why').className = 'dist'; $('c-why').textContent = `남은 거리 약 ${Math.round(d * 6)}m · 방향키·WASD (태블릿: 왼쪽 조이스틱)`;
  goalObj.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  if (d < 0.75) {
    audio.good(); fxGoal(cur.id, cur.gi);
    cur.gi++;
    if (cur.gi < MI[cur.id].goals.length) { placeGoal(); return; }
    goalObj.visible = false; cur.walking = false; cur.ruleShown = true;
    const stars = Math.max(1, 3 - cur.mistakes);
    $('card').classList.remove('walk'); $('c-face').textContent = '📌'; $('c-name').textContent = '기억해요!'; $('c-text').textContent = '';
    const why = $('c-why'); why.className = 'rule'; why.textContent = MI[cur.id].rule;
    const nx = $('c-next'); nx.textContent = `미션 완료 ${'★'.repeat(stars)}`; nx.classList.remove('hidden'); nx.onclick = () => finishMission(stars);
  }
}
function finishMission(stars) {
  const id = cur.id; state.done[id] = Math.max(state.done[id] || 0, stars); save();
  audio.good(); toast(`${TALK[id].icon} ${TALK[id].title} 완료! ${'★'.repeat(stars)}`);
  endMission(); refreshProgress();
  if (ORDER.every((k) => state.done[k])) setTimeout(showCert, 900);
}
function endMission() {
  if (!cur) return; if (cur.kind !== 'room') fxEnd(MI[cur.id].fx);
  goalObj.visible = false; cur = null; $('card').classList.add('hidden'); document.body.classList.remove('busy'); viewShift();
  for (const k in pins) pins[k].d.classList.remove('active');
}
$('c-close').onclick = () => endMission();

/* ───────────── 미션 효과 ───────────── */
const fx = { saved: null, fireOn: false, shake: 0, stormT: 0, dog: null, amb: null, truck: null, bus: null, van: null, swing: false, smoke: null, flames: null, crane: false, ice: null, quake: null, follow: null, helmet: null, maskItem: null };
function fxStart(kind) {
  fx.saved = { weather: env.weather, time: env.time };
  if (kind === 'bus' && !cars.some((c) => c.kind === 'bus')) { const b = spawnCar('Wb', 'bus', { vmax: 3.6, at: 88 }); b.busStop = 73.5; }
  if (kind === 'park') gcar.wait = Math.min(gcar.wait, 1);
  if (kind === 'play') fx.swing = true;
  if (kind === 'stranger') { fx.van = car('van'); const [x, z] = T2(22.5, 28.6); fx.van.position.set(x, 0, z); fx.van.rotation.y = Math.PI / 2; L.ground.add(fx.van); }
  if (kind === 'fire') fireOn(true);
  if (kind === 'site') fx.crane = true;
  if (kind === 'storm') { setEnv('weather', 'rain'); fx.stormT = 1.5; }
  if (kind === 'dust') { env.haze = 1; if (env.weather === 'rain') setEnv('weather', 'clear'); }
  if (kind === 'ice') { setEnv('weather', 'snow'); iceOn(); }
}
function fxWalk(kind) {
  if (kind === 'fire' && !fx.truck) { fx.truck = spawnCar('Sb', 'fire', { vmax: 6, keep: true, at: -3 }); fx.truck.stopAt = 13.5; toast('🚒 소방차 출동!'); }
  if (kind === 'aid' && !fx.amb) { fx.amb = spawnCar('E', 'amb', { vmax: 6, keep: true, at: 18 }); fx.amb.stopAt = 61.2; toast('🚑 구급차가 오고 있어요!'); }
  if (kind === 'quake') { fx.quake = { t: 0, phase: 'pre' }; }
  if (kind === 'stranger') fx.follow = { obj: npcObjs.stranger, t: 7 };
  if (kind === 'lost') fx.follow = { obj: npcObjs.lost, t: 1e9, kid: true };
  if (kind === 'kick') { fx.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x46c36b)); const [x, z] = T2(58.8, 40.6); fx.helmet.position.set(x, hY(x, z) + 0.05, z); L.ground.add(fx.helmet); }
  if (kind === 'dust') { fx.maskItem = box(0.3, 0.12, 0.2, M(0xffffff), ...(() => { const [x, z] = T2(43, 60.3); return [x, hY(x, z) + 0.3, z]; })(), L.ground); toast('😷 벤치 위 마스크를 먼저 써요!'); }
  if (kind === 'dog') { dogOn(); }
  if (kind === 'ice') toast('🧊 빙판이에요! Shift(태블릿: 천천히 버튼)로 종종걸음!');
  if (kind === 'fire') toast('😷 연기 속에서는 Shift(태블릿: 천천히 버튼)로 몸을 낮춰요!');
}
function fxGoal(id, gi) {
  if (id === 'kick' && gi === 0) { player.ride = true; helmetMesh.visible = true; if (fx.helmet) { L.ground.remove(fx.helmet); fx.helmet = null; } toast('🛴 헬멧 착용! 사람 옆에서는 천천히!'); }
  if (id === 'dust' && gi === 0) { player.mask = true; maskMesh.visible = true; if (fx.maskItem) { L.ground.remove(fx.maskItem); fx.maskItem = null; } env.haze = 0.6; toast('😷 마스크 착용! 이제 학교 정문으로!'); }
  if (id === 'play' && gi === 0) toast('슝~ 🛝 이제 그네를 피해서 시소 옆으로!');
}
function fxEnd(kind) {
  newFxEnd(kind);
  if (kind === 'fire') { fireOn(false); if (fx.truck) { fx.truck.stopAt = null; fx.truck.keep = false; fx.truck = null; } }
  if (kind === 'stranger' && fx.van) { L.ground.remove(fx.van); fx.van = null; fx.follow = null; resetNpc('stranger'); }
  if (kind === 'play') fx.swing = false;
  if (kind === 'quake') fx.quake = null;
  if (kind === 'site') fx.crane = false;
  if (kind === 'aid' && fx.amb) { fx.amb.stopAt = null; fx.amb.keep = false; fx.amb = null; }
  if (kind === 'dog') dogOff();
  if (kind === 'storm') { fx.stormT = 0; setEnv('weather', fx.saved.weather); }
  if (kind === 'dust') { env.haze = 0; player.mask = false; maskMesh.visible = false; if (fx.maskItem) { L.ground.remove(fx.maskItem); fx.maskItem = null; } }
  if (kind === 'ice') { setEnv('weather', fx.saved.weather); iceOff(); }
  if (kind === 'lost') { fx.follow = null; resetNpc('lost'); }
  if (kind === 'kick') { player.ride = false; helmetMesh.visible = false; if (fx.helmet) { L.ground.remove(fx.helmet); fx.helmet = null; } }
}
function resetNpc(id) { const [x, z] = T2(...MI[id].at); npcObjs[id].position.set(x, hY(x, z), z); }
function fireOn(on) {
  fx.fireOn = on; fireLight.intensity = 0;
  const [fx0, fz0] = T2(15.3, 13.5);
  if (on && !fx.flames) {
    fx.flames = new THREE.Group(); fx.flames.position.set(fx0, 0.1, fz0); L.build.add(fx.flames);
    const fm = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), fm); f.position.set(rand(0, 0.25), rand(0.2, 0.6), rand(-0.5, 0.5)); f.userData.p = Math.random() * 6; fx.flames.add(f); }
    fx.fireLight = fireLight;
    const sm = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 });
    fx.smoke = []; for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), sm); s.userData = { t: Math.random() * 4 }; L.build.add(s); fx.smoke.push(s); }
    fx.smokeO = [fx0, fz0];
  }
  if (fx.flames) fx.flames.visible = on; if (fx.smoke) fx.smoke.forEach((s) => (s.visible = on));
}
function iceOn() { fx.ice = []; fx.iceMeshes = []; for (const x of [48, 50, 52, 54, 56]) { const [px, pz] = T2(x, 34.5); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0xdff1ff, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(px, SW_H + 0.01, pz); L.ground.add(m); fx.iceMeshes.push(m); fx.ice.push([px, pz]); } }
function iceOff() { (fx.iceMeshes || []).forEach((m) => L.ground.remove(m)); fx.ice = null; fx.iceMeshes = null; }
function dogOn() {
  const g = new THREE.Group(); const fur = M(0x8a5a2b);
  box(0.7, 0.32, 0.3, fur, 0, 0.45, 0, g); box(0.28, 0.26, 0.24, fur, 0.42, 0.66, 0, g); box(0.14, 0.1, 0.14, M(0x2a1a10), 0.6, 0.62, 0, g);
  for (const [x, z] of [[-0.25, -0.1], [-0.25, 0.1], [0.25, -0.1], [0.25, 0.1]]) box(0.08, 0.3, 0.08, fur, x, 0.15, z, g);
  g.scale.setScalar(PS); const [x, z] = T2(55.3, 60.8); g.position.set(x, hY(x, z), z); L.ground.add(g); fx.dog = { g, phase: 'idle', t: 0 };
}
function dogOff() { if (fx.dog) { L.ground.remove(fx.dog.g); fx.dog = null; } }
const nearBuilding = (x, z, r) => { const tx = FX(x), ty = FZ(z); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = (tx + dx) | 0, Y = (ty + dy) | 0; if (X >= 0 && Y >= 0 && X < W && Y < H && blocks[Y * W + X]) return true; } return false; };
function updateFx(dt, t) {
  newFxUpdate(dt);
  const amp = fx.swing ? 0.75 : 0.15; swings.forEach((s, i) => (s.rotation.x = Math.sin(t * 2.1 + i * 1.3) * amp));
  seesaw.rotation.z = Math.sin(t * 1.1) * 0.2; ducks.forEach((d, i) => (d.rotation.z = Math.sin(t * 3 + i) * 0.12));
  wheel.rotation.z -= dt * 0.8; craneTop.rotation.y = Math.sin(t * 0.12) * 0.6;
  const sway = fx.crane ? Math.sin(t * 2.3) * 0.35 : Math.sin(t * 0.9) * 0.05; craneHook.rotation.x = sway; craneHook.position.x = -4.5 + Math.sin(t * 0.25) * 1.5;
  const drop = fx.crane ? 3.5 : 5 + Math.sin(t * 0.3) * 1.5; craneLoad.position.y = -drop; craneCable.scale.y = drop; craneCable.position.y = -drop / 2;
  craneBeacon.emissiveIntensity = Math.sin(t * 4) > 0.3 ? 4 : 0.2;
  if (fx.fireOn && fx.flames) {
    fx.flames.children.forEach((f) => { if (f.isMesh) { f.scale.setScalar(0.7 + Math.sin(t * 13 + f.userData.p) * 0.35); f.position.y = 0.3 + Math.abs(Math.sin(t * 7 + f.userData.p)) * 0.35; } });
    fireLight.intensity = fx.flames.visible ? 6 + Math.random() * 6 : 0;
    fx.smoke.forEach((s) => { s.userData.t += dt; if (s.userData.t > 4) s.userData.t = 0; const k = s.userData.t / 4; s.position.set(fx.smokeO[0] + 0.4 + k * 2.5 + Math.sin(k * 5 + s.id) * 0.4, 0.9 + k * 5, fx.smokeO[1] + Math.cos(k * 4 + s.id) * 0.5); s.scale.setScalar(0.5 + k * 2); });
  }
  if (fx.truck && fx.truck.arrived && !fx.truck.done) { fx.truck.done = true; toast('🚒 소방관이 불을 끄고 있어요!'); setTimeout(() => { if (fx.fireOn) fireOn(false); }, 4000); }
  // 위험 규칙 (걸어가는 동안)
  if (cur && cur.walking) {
    const id = cur.id, slow = keys.has('ShiftLeft') || keys.has('ShiftRight') || slowBtn;
    if (id === 'fire' && fx.fireOn) { const tx = FX(player.x), ty = FZ(player.z); if (tx > 14.5 && tx < 21 && ty > 9 && ty < 19 && !slow && player.speed > 0.2) warn('😷 콜록! 연기는 위로 올라가요. 몸을 낮춰요(Shift·천천히)!'); }
    if (id === 'site') { const tx = FX(player.x), ty = FZ(player.z); if (tx >= SITE.x0 && tx < SITE.x1 + 1 && ty >= SITE.y0 && ty < SITE.y1 + 1) { warn('💥 위에서 자재가 떨어져요! 공사장 안으로는 들어가지 않아요.'); const [x, z] = T2(22.6, 39.6); player.x = x; player.z = z; player.frozen = 0.6; } }
    if (id === 'play' && fx.swing) { const [sx, sz] = T2(45.3, 49.5); if (Math.hypot(player.x - sx, (player.z - sz) * 1.6) < 1.3) { warn('💥 그네 앞뒤로 지나가면 부딪쳐요! 멀리 돌아가요.'); player.x = player.safe[0]; player.z = player.safe[1] + 0.5; player.frozen = 0.5; } }
    if (id === 'storm') { const tr = treeSpots.find(([x, z]) => Math.hypot(x - player.x, z - player.z) < 1.2); if (tr) { lightning(); warn('⚡ 나무 밑은 번개가 떨어질 수 있어요! 나무에서 멀리 떨어져요.'); } }
    if (id === 'ice' && onIce() && !slow && player.speed > 1.2) { warn('🧊 꽈당! 빙판에서는 천천히(Shift·천천히 버튼)!'); player.frozen = 0.9; }
    if (id === 'kick' && player.ride && !slow) for (const w of walkers) { if (Math.hypot(w.g.position.x - player.x, w.g.position.z - player.z) < 0.8 && player.speed > 2.5) { warn('😵 사람 옆을 빠르게 지나면 부딪쳐요! 천천히(Shift·천천히)!'); break; } }
    if (id === 'quake' && fx.quake) {
      const q = fx.quake; q.t += dt;
      if (q.phase === 'pre' && q.t > 1.5) { q.phase = 'shake'; q.t = 0; toast('🌏 흔들려요! 머리를 감싸고 건물에서 먼 운동장 가운데로!'); }
      if (q.phase === 'shake') { fx.shake = 0.18; if (nearBuilding(player.x, player.z, 1)) { warn('💥 건물 가까이는 유리와 물건이 떨어져요! 넓은 곳으로!'); const [x, z] = T2(29.5, 22.5); player.x = x; player.z = z; player.frozen = 0.5; } if (q.t > 9) { q.phase = 'after'; toast('흔들림이 멈췄어요. 가운데 고리에 모여요!'); } }
    }
    if (id === 'dust' && !player.mask && player.speed > 0.3) { fx.dustLv = (fx.dustLv || 0) + dt; if (fx.dustLv > 6) { fx.dustLv = 0; warn('😷 콜록! 마스크부터 써요!'); } }
  }
  if (!(cur && cur.id === 'quake' && fx.quake && fx.quake.phase === 'shake')) fx.shake *= 0.9;
  if (fx.stormT > 0) { fx.stormT -= dt; if (fx.stormT <= 0) { lightning(); fx.stormT = rand(2.5, 5); } }
  // 따라오는 사람 (모르는 아저씨 / 길 잃은 동생)
  if (fx.follow && cur && cur.walking) {
    const f = fx.follow, o = f.obj.position; f.t -= dt;
    if (f.t > 0) { const dx = player.x - o.x, dz = player.z - o.z, d = Math.hypot(dx, dz); const keep = f.kid ? 0.7 : 1.6; if (d > keep) { const v = f.kid ? Math.min(2.6, d * 1.6) : 1.6; const nx = o.x + dx / d * v * dt, nz = o.z + dz / d * v * dt; if (!isRoadC(tileAt(FX(nx), FZ(nz))) || cwAt(FX(nx), FZ(nz))) { o.x = nx; o.z = nz; } f.obj.rotation.y = Math.atan2(dx, dz); animWalk(f.obj, t, true); o.y = hY(o.x, o.z); } if (f.kid && d > 6) { f.wt = (f.wt || 0) - dt; if (f.wt <= 0) { f.wt = 3; toast('🧒 "같이 가!" 동생이 못 따라와요. 천천히 함께 가요.'); } } }
  }
  if (fx.dog) {
    const D = fx.dog, g = D.g, dx = player.x - g.position.x, dz = player.z - g.position.z, d = Math.hypot(dx, dz); D.t += dt;
    if (D.phase === 'idle' && d < 4) { D.phase = 'come'; toast('🐕 멍멍! 개가 달려와요! 나무처럼 가만히 서 있어요.'); }
    if (D.phase === 'come') { if (d > 0.8) { g.position.x += dx / d * 2.6 * dt; g.position.z += dz / d * 2.6 * dt; g.rotation.y = Math.atan2(-dz, dx); } else { D.phase = 'sniff'; D.t = 0; } }
    if (D.phase === 'sniff') { g.rotation.y += Math.sin(t * 9) * 0.05; if (player.speed > 0.3) { warn('🐕 왈왈! 움직이면 개가 흥분해요. 나무처럼 가만히!'); D.t = 0; player.frozen = 0.6; } if (D.t > 2.5) { D.phase = 'leave'; toast('주인이 왔어요! "죄송해요, 목줄 할게요." 이제 지나가요.'); } }
    if (D.phase === 'leave') { g.position.x -= 2.5 * dt; g.rotation.y = Math.PI; if (D.t > 6) dogOff(); }
  }
}
function lightning() {
  flashLight.intensity = 9; const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.5';
  requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; });
  setTimeout(() => (flashLight.intensity = 0), 120); setTimeout(() => { flashLight.intensity = 5; setTimeout(() => (flashLight.intensity = 0), 80); }, 220);
  setTimeout(() => audio.thunder(), 500);
}
let toastT = 0;
function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }

/* ───────────── 레이어 설명표 (분해도) ───────────── */
const layerLines = [];
function layerTags() {
  const tags = [
    ['under', -3, 'LAYER 01 · B1', '지하주차장 · 땅속', '경사로를 올라온 차는 운전석에서 어린이가 잘 안 보여요.'],
    ['ground', 0.4, 'LAYER 02 · 지면', '교육로 · 염곡로 · 스쿨존', '빨간 길은 어린이 보호구역. 횡단보도 4곳 · 신호등 · 정류장.'],
    ['build', 5, 'LAYER 03 · 건물', '가현초 · 가현중 · 루원시티', '아동안전지킴이집(편의점), 공사장, 경비실을 찾아봐요.'],
    ['roof', 9, 'LAYER 04 · 옥상', '크레인 · 옥상 기계실', '번개는 높은 곳에 떨어져요. 크레인 아래는 위험 구역!'],
  ];
  for (const [k, y, sm, b, s] of tags) {
    const d = document.createElement('div'); d.className = 'layer-tag'; d.innerHTML = `<small>${sm}</small><b>${b}</b><span>${s}</span>`;
    const o = new CSS2DObject(d); o.position.set(-W2 - 14, y, 0); L[k].add(o);
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W2 - 6, y, 0), new THREE.Vector3(-W2 + 0.5, y, 0)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd9a55b, transparent: true, opacity: 0 })); L[k].add(line); layerLines.push(line);
  }
}

/* ───────────── 새 퀘스트 (가현 안전상자에서 추가) ───────────── */
const TALK2 = {
  phone: { icon: '📱', title: '스마트폰 보며 걷지 않기', talk: [
    { who: 'kid4', say: '잠깐만, 이 영상 끝까지 보고 갈게…\n어? 벌써 초록불이네! 보면서 건너면 되겠지?' },
    { who: 'kid4', ask: '길을 걸을 때 스마트폰은 어떻게 할까?', choices: [
      { t: '화면을 보면서 천천히 걸으면 괜찮다', why: '화면을 보면 시야가 아주 좁아져서 다가오는 차·자전거를 못 봐요.' },
      { t: '가방에 넣고, 횡단보도에서는 좌우를 살핀다', ok: true, why: '맞아요! 꼭 써야 하면 안전한 곳에 멈춰 서서 써요.' },
      { t: '이어폰을 크게 켜고 걷는다', why: '경적이나 차 소리를 못 들어요.' }] }] },
  bike: { icon: '🚲', title: '자전거는 내려서 끌고', talk: [
    { who: 'bro2', say: '내 자전거 타 볼래? 길 건너 센트럴타운 쪽까지만 갔다 와!' },
    { who: 'bro2', ask: '자전거를 타기 전에 꼭 할 일은?', choices: [
      { t: '안전모를 쓰고 브레이크가 잘 되는지 확인한다', ok: true, why: '맞아요! 밝은 옷을 입고 밤에는 전조등을 켜요.' },
      { t: '더우니까 안전모는 안 쓴다', why: '넘어지면 머리를 크게 다칠 수 있어요.' }] },
    { who: 'bro2', ask: '자전거로 횡단보도를 건널 때는?', choices: [
      { t: '빨리 페달을 밟아 건넌다', why: '횡단보도에서 자전거를 타면 사람과 부딪치고, 차를 피하기도 어려워요.' },
      { t: '자전거에서 내려서 끌고 건넌다', ok: true, why: '맞아요! 횡단보도에서는 나도 보행자예요.' },
      { t: '한 손으로 휴대폰을 보며 탄다', why: '두 손으로 핸들을 잡고 앞을 봐야 해요.' }] }] },
  flood: { icon: '🌊', title: '집중호우 물웅덩이', talk: [
    { who: 'staff', say: '비가 너무 많이 와서 길 곳곳에 물이 고였어.\n물속에 뚜껑 열린 맨홀이 숨어 있을지도 몰라!' },
    { who: 'staff', ask: '집중호우로 물이 고인 길은 어떻게 할까?', choices: [
      { t: '얼마나 깊은지 들어가 본다', why: '물속에 열린 맨홀·구멍이 있을 수 있어요. 빠지면 아주 위험해요.' },
      { t: '물웅덩이를 피해 높고 안전한 길로 돌아간다', ok: true, why: '맞아요! 하천·지하차도·지하 계단에도 가지 않아요.' },
      { t: '우산으로 깊이를 재며 건넌다', why: '물살에 넘어질 수 있어요. 들어가지 않아요.' }] }] },
  heat: { icon: '🥵', title: '폭염 그늘 쉼터', talk: [
    { who: 'pe', say: '오늘 낮 기온이 35도! 폭염 경보야.\n운동장 흙이 달걀을 익힐 만큼 뜨거워.' },
    { who: 'pe', ask: '폭염일 때 바깥 활동은 어떻게 할까?', choices: [
      { t: '물을 자주 마시고 그늘에서 쉬며, 어지러우면 바로 알린다', ok: true, why: '맞아요! 모자를 쓰고 한낮(12~17시) 활동은 줄여요.' },
      { t: '땀을 많이 흘려야 건강해지니 계속 뛴다', why: '열사병이 올 수 있어요. 쉬어야 해요.' },
      { t: '목마를 때까지 참았다가 한 번에 마신다', why: '목마르기 전에 조금씩 자주 마셔요.' }] }] },
};
Object.assign(TALK, TALK2);
Object.assign(NPC, {
  kid4: { kid: true, shirt: 0xff8fb1, bag: true, face: '👧' }, bro2: { shirt: 0x3ab0c8, helmet: 0xe0543a, face: '🧑' }, staff: { vest: true, shirt: 0x5a6a7a, cap: 0x2b3440, face: '🦺' }, pe: { shirt: 0x2f6fd0, pants: 0x2f6fd0, cap: 0xffffff, face: '🧑‍🏫' },
  clerk: { shirt: 0x1f8a4c, face: '🧑‍💼' }, owner: { shirt: 0xd8352a, cap: 0xffffff, face: '👩‍🍳' }, pharmacist: { shirt: 0xf2f2ee, face: '🧑‍⚕️' }, master: { shirt: 0xf2f2ee, pants: 0xf2f2ee, face: '🥋' },
  scientist: { shirt: 0xf2f2ee, face: '🧑‍🔬' }, pe_teacher: { shirt: 0x2f6fd0, pants: 0x2f6fd0, face: '🧑‍🏫' }, nurse: { shirt: 0xf2f2ee, cap: 0xffffff, face: '👩‍⚕️' }, cook: { shirt: 0xf2f2ee, cap: 0xffffff, face: '🧑‍🍳' },
  tutor: { shirt: 0x6b4fd0, face: '🧑‍🏫' }, barista: { shirt: 0x2b1d16, face: '☕' },
});
Object.assign(NAMES, { kid4: '친구 지아', bro2: '자전거 탄 형', staff: '구청 직원', pe: '체육 선생님', clerk: '편의점 점원', owner: '분식집 사장님', pharmacist: '약사 선생님', master: '태권도 관장님', scientist: '과학 선생님', pe_teacher: '체육 선생님', nurse: '보건 선생님', cook: '조리사님', tutor: '학원 선생님', barista: '바리스타' });
Object.assign(MI, {
  phone: { npc: 'kid4', at: [69.6, 33.2], goals: [[66.5, 39.6]], go: '휴대폰은 가방에 쏙! 루원시티 앞 횡단보도로 건너서 길 건너편 고리까지 가 보자.', rule: '걸을 때 스마트폰은 가방에! 꼭 써야 하면 멈춰 서서 써요.', fx: 'phone' },
  bike: { npc: 'bro2', at: [52, 38.6], goals: [[65.5, 33.6]], go: '안전모 쓰고 출발! 횡단보도에서는 꼭 내려서 끌고(Shift·천천히 버튼) 건너야 해.', rule: '자전거는 안전모를 쓰고, 횡단보도에서는 내려서 끌고 건너요.', fx: 'bike' },
  flood: { npc: 'staff', at: [23.2, 47.6], goals: [[33, 49.5]], go: '큰 물웅덩이는 밟지 말고 돌아서, 단지 안 고리까지 가 보렴.', rule: '집중호우 땐 물 고인 길·하천·지하차도를 피하고 높은 길로 돌아가요.', fx: 'flood' },
  heat: { npc: 'pe', at: [36.8, 23.5], goals: [[43.4, 26.4]], go: '저기 그늘막(노란 고리)으로 가서 물 마시고 쉬자!', rule: '폭염엔 물 자주 마시기 · 그늘에서 쉬기 · 모자 쓰기 · 어지러우면 바로 알리기!', fx: 'heat' },
});
ORDER.push('phone', 'bike', 'flood', 'heat');
const floods = [[26, 48.3, 1.4], [29.6, 50.3, 1.2], [30.8, 47.4, 1.0]];
let floodMeshes = null;
function newFxStart(kind) {
  if (kind === 'flood') { setEnv('weather', 'rain'); floodMeshes = floods.map(([x, y, r]) => { const [px, pz] = T2(x, y); const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.92 })); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.03, pz); L.ground.add(m); return m; }); const [mx, mz] = T2(29.6, 50.3); const mh = cyl(0.3, 0.3, 0.04, M(0x111111), mx, 0.04, mz, L.ground, 16); floodMeshes.push(mh); }
  if (kind === 'heat') { setEnv('weather', 'clear'); setEnv('time', 'day'); }
}
function newFxWalk(kind) {
  if (kind === 'bike') { player.ride = true; player.bike = true; helmetMesh.visible = true; scooter.visible = false; bikeMesh.visible = true; }
  if (kind === 'phone') toast('📱 휴대폰은 가방에 넣었어요. 좌우를 살피고 건너요!');
}
function newFxEnd(kind) {
  if (kind === 'flood') { (floodMeshes || []).forEach((m) => L.ground.remove(m)); floodMeshes = null; setEnv('weather', fx.saved.weather); }
  if (kind === 'heat') { setEnv('weather', fx.saved.weather); setEnv('time', fx.saved.time); }
  if (kind === 'bike') { player.ride = false; player.bike = false; helmetMesh.visible = false; bikeMesh.visible = false; }
}
function newFxUpdate(dt) {
  if (!cur || !cur.walking) return;
  const slow = keys.has('ShiftLeft') || keys.has('ShiftRight') || slowBtn;
  if (cur.id === 'bike') { const cw = cwAt(FX(player.x), FZ(player.z)); if (cw && !slow && player.speed > 1.3) { warn('🚲 횡단보도에서는 자전거에서 내려서 끌고 건너요! (Shift·천천히)'); player.frozen = 0.5; } }
  if (cur.id === 'flood') for (const [x, y, r] of floods) { const [px, pz] = T2(x, y); if (Math.hypot(px - player.x, pz - player.z) < r * 0.85) { warn('🌊 물웅덩이 속에 맨홀이 있을 수 있어요! 돌아서 가요.'); player.x = player.safe[0]; player.z = player.safe[1]; player.frozen = 0.5; break; } }
}
let bikeMesh;
function buildNewProps() {
  // 폭염 그늘막
  const [px, pz] = T2(43.4, 26.4), tent = new THREE.Group(); tent.position.set(px, 0, pz); L.ground.add(tent);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.06, 1.4, 0.06, mat.pole, a * 0.9, 0.7, b * 0.9, tent);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 4), M(0x2f8ad0, { side: THREE.DoubleSide })); roof.rotation.y = Math.PI / 4; roof.position.y = 1.62; roof.castShadow = true; tent.add(roof);
  cyl(0.1, 0.1, 0.4, M(0x5bc0eb), 0.4, 0.2, 0.2, tent, 10);
  sign('그늘 쉼터', px, 2.1, pz + 0.01, 0.22, { bg: '#2f8ad0', fg: '#fff', fs: 44 }, L.ground);
  // 자전거 (내 캐릭터에 붙임)
  bikeMesh = new THREE.Group(); const fr = M(0xe0543a);
  for (const z of [-0.3, 0.3]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), mat.dark); w.position.set(0, 0.16, z); w.rotation.y = Math.PI / 2; bikeMesh.add(w); }
  box(0.04, 0.04, 0.6, fr, 0, 0.3, 0, bikeMesh); box(0.03, 0.3, 0.03, fr, 0, 0.42, 0.28, bikeMesh); box(0.3, 0.03, 0.03, mat.pole, 0, 0.58, 0.28, bikeMesh);
  bikeMesh.visible = false; player.g.add(bikeMesh);
}

/* ───────────── 건물 안 (인형집처럼 잘린 실내) ───────────── */
const ROOM_IDS = Object.keys(ROOMS);
const ITEM = { // 과제 물건 → [이모지, 색, 크기]
  bag_floor: ['🎒', 0xe0543a, 0.4], multitap: ['🔌', 0xffffff, 0.3], scissors: ['✂️', 0xb0b0b0, 0.25], puddle: ['💧', 0x6fb0e0, 0.6], box_stack: ['📦', 0xb08a5a, 0.6], cable_floor: ['➰', 0x222222, 0.5],
  pot_handle: ['🍳', 0x555555, 0.4], pill_bottle: ['💊', 0xff8a8a, 0.25], syrup: ['🧴', 0xd88a5a, 0.25], gummy_jar: ['🍬', 0xff8fb1, 0.3], shoe_loose: ['👟', 0xffffff, 0.3], dumbbell: ['🏋️', 0x444444, 0.35],
  elev_panel: ['🔔', 0xff2a1a, 0.35], stairs_door: ['🚪', 0x2fa84f, 0.8], elevator: ['🛗', 0x9aa0a6, 0.9], goggles: ['🥽', 0x5bc0eb, 0.25], lab_coat: ['🥼', 0xf2f2ee, 0.45], alcohol_lamp: ['🔥', 0xffa040, 0.3],
  beaker: ['🧪', 0x7fd18b, 0.3], ball_floor: ['🏀', 0xe0743a, 0.35], vault_box: ['📦', 0xd8b23a, 0.7], sink: ['🚰', 0xdfe6ea, 0.5], first_aid_kit: ['🧰', 0xff4a3a, 0.35], bandage: ['🩹', 0xf0c9a0, 0.25],
  tray_stack: ['🍽️', 0x9aa0a6, 0.4], hot_soup: ['🍲', 0xd8352a, 0.35], cafe_table: ['🪑', 0x8a6a4a, 0.6], exit_sign_blocked: ['🚪', 0x2fa84f, 0.7], heater: ['♨️', 0xff6a3a, 0.5], hot_cup: ['☕', 0xffffff, 0.25],
};
const ROOM_BASE_X = 220;
const roomObjs = {}, doorLabels = {};
let inRoom = null;
function roomOrigin(i) { return [ROOM_BASE_X + i * 26, 0]; }
function buildRooms() {
  ROOM_IDS.forEach((id, i) => {
    const R = ROOMS[id], g = new THREE.Group(), [ox, oz] = roomOrigin(i); g.position.set(ox, 0, oz); g.visible = false; scene.add(g);
    const w = R.w, h = R.h, wall = M(new THREE.Color(R.wall)), floor = M(new THREE.Color(R.floor), { roughness: 0.5 });
    slab(-0.3, w + 0.3, -0.6, 0, -0.3, h + 0.3, M(0x2a2228), g); slab(0, w, 0, 0.04, 0, h, floor, g);
    slab(-0.2, w + 0.2, 0, 1.4, -0.2, 0, wall, g); slab(-0.2, 0, 0, 1.4, 0, h, wall, g); slab(w, w + 0.2, 0, 0.5, 0, h, wall, g);
    slab(-0.2, w + 0.2, 1.4, 1.48, -0.2, 0.1, M(0x8d7a66), g);
    slab(w * 0.3, w * 0.7, 1.32, 1.36, 0.05, 0.15, GLOW(0xfff4e0, 1.2), g, { cast: false });
    sign(R.name.replace(/^\S+ /, ''), w / 2, 1.18, 0.03, 0.2, { bg: '#21314a', fg: '#fff', fs: 54 }, g);
    const cols = []; // 가구 충돌 [x0,z0,x1,z1]
    const furn = (x0, z0, x1, z1, y1, m) => { slab(x0, x1, 0, y1, z0, z1, m, g); cols.push([x0, z0, x1, z1]); };
    const desk = M(0xc8a27a), dark = M(0x3a3438), white = M(0xf2f2ee), shelf = M(0xd9d2c6);
    if (id === 'class' || id === 'acad') { slab(w * 0.25, w * 0.75, 0.42, 1.02, 0.02, 0.08, M(id === 'class' ? 0x2f5a3a : 0xffffff), g); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) furn(1.6 + c * 2.4, 2.6 + r * 1.7, 2.6 + c * 2.4, 3.2 + r * 1.7, 0.3, desk); }
    if (id === 'sci') { for (const c of [0, 1]) furn(2.6 + c * 3.4, 3.4, 4.6 + c * 3.4, 4.4, 0.38, dark); slab(0.1, 0.6, 0, 1.0, 4.6, 6.4, shelf, g); }
    if (id === 'conv' || id === 'pharm') { furn(0.6, 0.1, w - 0.6, 0.6, 0.9, shelf); furn(0.8, 2.6, 3.6, 3.0, 0.6, shelf); furn(w - 2.2, 3.4, w - 0.4, 4.2, 0.45, white); if (id === 'conv') slab(w - 1.4, w - 0.2, 0, 1.05, 0.1, 0.8, GLOW(0xbfe3ff, 0.8), g); }
    if (id === 'snack' || id === 'coffee' || id === 'cafe') { furn(2.0, 0.1, w - 0.6, 0.8, 0.5, white); for (const [x, z] of [[1.4, 3.6], [3.4, 3.8], [5.6, 3.4]]) if (x < w - 1) furn(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0.3, desk); }
    if (id === 'tkd') { slab(0.3, w - 0.3, 0.04, 0.07, 0.6, h - 0.8, M(0xd8352a), g); cyl(0.2, 0.2, 0.75, M(0x2b2520), 1.2, 0.5, 1.4, g, 12); cols.push([0.9, 1.1, 1.5, 1.7]); }
    if (id === 'gym') { slab(w / 2 - 0.5, w / 2 + 0.5, 0.95, 1.35, 0.05, 0.1, white, g); cyl(0.22, 0.22, 0.03, M(0xe0543a), w / 2, 0.92, 0.35, g, 16); slab(1, 3.5, 0.04, 0.12, h - 2, h - 0.8, M(0x2f6fd0), g); }
    if (id === 'nurse') { for (const x of [1.0, 2.8]) furn(x, 0.3, x + 1.2, 2.2, 0.3, white); slab(w - 1.4, w - 0.2, 0, 1.05, 0.1, 0.6, shelf, g); }
    if (id === 'apt') { slab(3.0, 4.4, 0, 1.2, 0.02, 0.1, M(0x9aa0a6, { metalness: 0.7, roughness: 0.3 }), g); slab(0.4, 1.6, 0.4, 0.9, 0.02, 0.2, M(0x8d7a66), g); slab(6.0, 7.2, 0, 1.15, 0.02, 0.1, M(0x2fa84f), g); }
    // 사람
    const n = person(NPC[R.npc.who] || {}); n.position.set(R.npc.x, 0.04, R.npc.y); g.add(n);
    // 나가는 문 (앞쪽 가운데)
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6 })); ex.rotation.x = -Math.PI / 2; ex.position.set(w / 2, 0.06, h - 0.45); g.add(ex);
    const el = document.createElement('div'); el.className = 'roomtag'; el.textContent = '🚪 나가기'; const eo = new CSS2DObject(el); eo.position.set(w / 2, 0.5, h - 0.45); g.add(eo);
    el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.onclick = (e) => { e.stopPropagation(); exitRoom(); };
    // 과제 물건
    const items = [];
    if (R.task) R.task.items.forEach((it, k) => {
      const [emo, col, sz] = ITEM[it.spr] || ['❓', 0xffffff, 0.3];
      const ix = clamp(it.x, 0.3, w - 0.3), iz = clamp(it.y, 0.3, h - 0.3);
      const mesh = it.spr === 'puddle' ? new THREE.Mesh(new THREE.CircleGeometry(sz, 18), new THREE.MeshStandardMaterial({ color: col, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.7 })) : new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), M(col));
      if (it.spr === 'puddle') { mesh.rotation.x = -Math.PI / 2; mesh.position.set(ix, 0.05, iz); } else { mesh.position.set(ix, iz < 0.4 ? 0.6 : sz / 2 + 0.04, iz); mesh.castShadow = true; }
      g.add(mesh);
      const d = document.createElement('button'); d.className = 'item'; d.innerHTML = `<span>${emo}</span>`; const o = new CSS2DObject(d); o.position.set(ix, (iz < 0.4 ? 0.6 : sz) + 0.45, iz); g.add(o);
      d.addEventListener('pointerdown', (e) => e.stopPropagation()); d.onclick = (e) => { e.stopPropagation(); pickItem(id, k); };
      items.push({ it, d, x: ix, z: iz });
    });
    g.traverse((o) => { if (o.isCSS2DObject) o.visible = false; });
    roomObjs[id] = { g, R, cols, npc: n, items, found: new Set(), stepN: 1, quiz: false, origin: [ox, oz] };
    // 바깥 문 표시
    const [dx, dz] = T2(R.door[0], R.door[1]);
    const dm = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.85, depthWrite: false })); dm.rotation.x = -Math.PI / 2; dm.position.set(dx, hY(dx, dz) + 0.03, dz); L.ground.add(dm);
    const dl = document.createElement('div'); dl.className = 'door'; dl.innerHTML = `🚪 <b>${R.name.replace(/^\S+ /, '')}</b>`; const dlo = new CSS2DObject(dl); dlo.position.set(dx, hY(dx, dz) + 0.9, dz); L.ground.add(dlo);
    dl.addEventListener('pointerdown', (e) => e.stopPropagation()); dl.onclick = (e) => { e.stopPropagation(); enterRoom(id); };
    doorLabels[id] = dl;
  });
  const hd = document.createElement('li'); hd.className = 'sep'; hd.textContent = '🏠 건물 안 탐험 (배지)'; $('mlist').appendChild(hd);
  for (const id of ROOM_IDS) { const li = document.createElement('li'); li.dataset.room = id; const R = ROOMS[id]; li.innerHTML = `<span class="ic">${R.name.split(' ')[0]}</span><span class="t">${R.name.replace(/^\S+ /, '')}</span><span class="s"></span>`; li.onclick = () => enterRoom(id); $('mlist').appendChild(li); }
  refreshRooms();
}
function nearDoor() { if (inRoom || cur) return null; let best = null, bd = 1.3; for (const id of ROOM_IDS) { const [dx, dz] = T2(...ROOMS[id].door); const d = Math.hypot(dx - player.x, dz - player.z); if (d < bd) { bd = d; best = id; } } return best; }
function enterRoom(id) {
  if (cur) endMission();
  { const O2 = roomObjs[id]; roomLight.position.set(O2.origin[0] + O2.R.w / 2, 3, O2.origin[1] + O2.R.h / 2); roomLight.intensity = 5; }
  const O = roomObjs[id]; inRoom = id; O.g.visible = true; root.visible = false; for (const k of ROOM_IDS) roomObjs[k].g.traverse((o) => { if (o.isCSS2DObject) o.visible = k === id; });
  player.prevOut = player.x === undefined ? null : [player.x, player.z];
  const [dx, dz] = T2(...ROOMS[id].door); player.outPos = [dx, dz + 0.0];
  L.ground.remove(player.g); O.g.add(player.g); player.x = O.R.w / 2; player.z = O.R.h - 0.55; player.face = Math.PI; player.safe = [player.x, player.z];
  document.body.classList.add('inroom');
  view = 'follow'; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === 'follow'));
  explodeGoal = 0;
  const c = new THREE.Vector3(O.origin[0] + O.R.w / 2, 0.6, O.origin[1] + O.R.h / 2);
  flyTo(c.clone().add(new THREE.Vector3(0, 8, 10)), c, 1.0);
  audio.click();
  const T = O.R.task; toast(`${O.R.name}에 들어왔어요! 💬 사람에게 다가가 말 걸기${T ? ' · 🔍 ' + T.title : ''}`);
  roomHud();
}
function exitRoom() {
  if (!inRoom) return; const O = roomObjs[inRoom]; if (cur && cur.kind === 'room') endMission();
  O.g.visible = false; root.visible = true; roomLight.intensity = 0; O.g.traverse((o) => { if (o.isCSS2DObject) o.visible = false; }); O.g.remove(player.g); L.ground.add(player.g);
  inRoom = null; const [dx, dz] = player.outPos; let px = dx, pz = dz;
  for (const [ax, az] of [[0, 0.8], [0.8, 0], [-0.8, 0], [0, -0.8], [0.6, 0.6], [-0.6, 0.6]]) if (!blockedAt(dx + ax, dz + az)) { px = dx + ax; pz = dz + az; break; }
  player.x = px; player.z = pz; player.safe = [px, pz]; document.body.classList.remove('inroom'); $('roomhud').classList.add('hidden');
  lastP = null; followSnap(1.0); audio.click();
}
function roomHud() {
  if (!inRoom) return; const O = roomObjs[inRoom], T = O.R.task; const h = $('roomhud'); h.classList.remove('hidden');
  const done = state.rooms[inRoom];
  h.innerHTML = `<b>${O.R.name}</b><span>${O.quiz ? '✅' : '💬'} 이야기·퀴즈</span>` + (T ? `<span>${T.mode === 'hunt' ? '🔍' : '🔢'} ${T.title} ${T.mode === 'hunt' ? O.found.size + '/' + T.items.length : (O.taskDone ? '완료' : (O.stepN - 1) + '/' + T.items.filter((i) => !i.bad).length)}</span>` : '') + (done ? '<span class="ok">🏅 배지 획득!</span>' : '') + '<button id="rh-exit">🚪 나가기</button>';
  $('rh-exit').onclick = () => exitRoom();
}
function pickItem(id, k) {
  const O = roomObjs[id], T = O.R.task, I = O.items[k]; if (!T || O.taskDone) return;
  if (T.mode === 'hunt') { if (O.found.has(k)) return; O.found.add(k); I.d.classList.add('ok'); audio.good(); toast(`🔍 ${I.it.name} — ${I.it.why}`); if (O.found.size === T.items.length) { O.taskDone = true; toast(`🎉 ${T.title} 성공!`); } }
  else {
    if (I.it.bad) { I.d.classList.add('no'); audio.bad(); toast(`❌ ${I.it.name} — ${I.it.why}`); return; }
    if (I.it.step === O.stepN) { O.stepN++; I.d.classList.add('ok'); I.d.querySelector('span').textContent = String(I.it.step); audio.good(); toast(`⭕ ${I.it.step}. ${I.it.name} — ${I.it.why}`); if (O.stepN > T.items.filter((i) => !i.bad).length) { O.taskDone = true; toast(`🎉 ${T.title} 성공!`); } }
    else { audio.bad(); toast(`🤔 순서가 달라요! ${O.stepN}번째로 할 일을 찾아봐요.`); }
  }
  checkBadge(id); roomHud();
}
function checkBadge(id) {
  const O = roomObjs[id]; if (state.rooms[id] || !O.quiz || (O.R.task && !O.taskDone)) return;
  state.rooms[id] = true; save(); refreshRooms(); audio.good(); setTimeout(() => toast(`🏅 ${O.R.name} 탐험 배지! (${Object.keys(state.rooms).length}/${ROOM_IDS.length})`), 900);
}
function refreshRooms() {
  for (const id of ROOM_IDS) { doorLabels[id].classList.toggle('done', !!state.rooms[id]); const li = document.querySelector(`#mlist li[data-room="${id}"]`); if (li) { li.classList.toggle('done', !!state.rooms[id]); li.querySelector('.s').textContent = state.rooms[id] ? '🏅' : ''; } }
  $('rdone').textContent = Object.keys(state.rooms).length;
}
function startRoomTalk(id) {
  const O = roomObjs[id]; if (cur) return;
  cur = { kind: 'room', id, step: 0, mistakes: 0, talk: [...O.R.talk, { roomEnd: true }], walking: false };
  $('c-icon').textContent = O.R.name.split(' ')[0]; $('c-title').textContent = O.R.name.replace(/^\S+ /, ''); $('c-no').textContent = 'INSIDE · 건물 탐험';
  $('card').classList.remove('hidden', 'walk'); viewShift(); showStep();
}
function updateRoom(dt, t) {
  if (!inRoom) return; const O = roomObjs[inRoom];
  const np = O.npc.position; if (!cur && Math.hypot(np.x - player.x, np.z - player.z) < 1.1 && !O.talkCool) { O.talkCool = true; startRoomTalk(inRoom); }
  if (Math.hypot(np.x - player.x, np.z - player.z) > 1.8) O.talkCool = false;
  O.npc.rotation.y = Math.atan2(player.x - np.x, player.z - np.z);
  if (!cur && player.z > O.R.h - 0.5 && Math.abs(player.x - O.R.w / 2) < 0.7 && player.speed > 0.1 && Math.abs(Math.cos(player.face)) > 0.5 && Math.cos(player.face) > 0) exitRoom();
  // 가까운 물건은 Space/버튼으로 살펴보기
  let near = -1, bd = 0.9; O.items.forEach((I, k) => { const d = Math.hypot(I.x - player.x, I.z - player.z); if (d < bd) { bd = d; near = k; } }); O.nearItem = near;
}
function roomBlocked(x, z) { const O = roomObjs[inRoom]; if (x < 0.25 || x > O.R.w - 0.25 || z < 0.45 || z > O.R.h - 0.1) return true; for (const [a, b, c, d] of O.cols) if (x > a - 0.15 && x < c + 0.15 && z > b - 0.15 && z < d + 0.15) return true; return false; }
// 행동 버튼 (문 들어가기 · 물건 살펴보기 · 나가기)
function updateAct() {
  const b = $('act'); let lbl = null, fn = null;
  if (inRoom) { const O = roomObjs[inRoom]; if (O.nearItem >= 0 && O.R.task && !O.taskDone) { lbl = '🔍 살펴보기'; const k = O.nearItem; fn = () => pickItem(inRoom, k); } else if (player.z > O.R.h - 1.2 && Math.abs(player.x - O.R.w / 2) < 1.2) { lbl = '🚪 나가기'; fn = exitRoom; } }
  else { const id = nearDoor(); if (id) { lbl = '🚪 ' + ROOMS[id].name.replace(/^\S+ /, '') + ' 들어가기'; fn = () => enterRoom(id); } }
  if (lbl) { b.textContent = lbl; b.classList.remove('hidden'); b.onclick = fn; actFn = fn; } else { b.classList.add('hidden'); actFn = null; }
}
let actFn = null;
/* ───────────── 시점 ───────────── */
let view = 'overview';
const fly = { t: 1, dur: 1, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
function flyTo(pos, target, dur = 1.6) { if (camera.aspect < 1) pos = target.clone().add(pos.clone().sub(target).multiplyScalar(1.5)); fly.p0.copy(camera.position); fly.t0.copy(controls.target); fly.p1.copy(pos); fly.t1.copy(target); fly.t = 0; fly.dur = dur; }
const FOLLOW_OFF = new THREE.Vector3(0, 15, 11);
function followSnap(dur = 1.4) { const t = player.g.getWorldPosition(new THREE.Vector3()); t.y = 0.5; const off = camera.position.clone().sub(controls.target); if (view !== 'follow' || off.length() > 30 || off.length() < 4) off.copy(FOLLOW_OFF); flyTo(t.clone().add(off), t, dur); }
const VIEWS = {
  overview: () => { flyTo(new THREE.Vector3(58, 112, 104), new THREE.Vector3(0, 0, 4)); controls.autoRotate = !cur; explodeGoal = 0; },
  follow: () => { controls.autoRotate = false; explodeGoal = 0; followSnap(); },
  exploded: () => { flyTo(new THREE.Vector3(120, 96, 168), new THREE.Vector3(-10, 6, 0)); controls.autoRotate = false; explodeGoal = 1; },
};
function setView(v, silent) {
  if (inRoom && v !== 'follow') exitRoom();
  if (v === 'tour') { const id = ORDER.find((k) => !state.done[k]) || ORDER[0]; startMission(id, false); return; }
  if (v === 'exploded' && cur && !silent) endMission();
  view = v; VIEWS[v]();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  document.body.classList.toggle('exploded', v === 'exploded');
}
let lastP = null;
function followCam() {
  if (!player.g) return;
  const p = player.g.getWorldPosition(new THREE.Vector3()); p.y = 0.5;
  if (view === 'follow' && fly.t >= 1 && lastP) { const d = p.clone().sub(lastP); camera.position.add(d); controls.target.add(d); }
  else if (view === 'follow' && fly.t < 1) { fly.t1.copy(p); }
  lastP = p;
}

/* ───────────── UI 연결 ───────────── */
document.querySelectorAll('#seg-weather button').forEach((b) => (b.onclick = () => { audio.click(); setEnv('weather', b.dataset.w); }));
document.querySelectorAll('#seg-time button').forEach((b) => (b.onclick = () => { audio.click(); setEnv('time', b.dataset.t); }));
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => { audio.click(); setView(b.dataset.v); }));
$('snd').onclick = () => audio.toggle();
$('prog-head').onclick = () => { $('prog').classList.toggle(MOBILE ? 'open' : 'fold'); };
labelR.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; if (view !== 'follow') fly.t = 1; });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (/^(Arrow|Key[WASD])/.test(e.code) && view !== 'follow' && view !== 'exploded') setView('follow');
  if (e.code === 'Escape' && cur) endMission();
  if ((e.code === 'Enter' || e.code === 'Space') && cur && !$('c-next').classList.contains('hidden')) $('c-next').click();
  else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && !cur && actFn) actFn();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// 조이스틱 (터치)
const joyEl = $('joy'), knob = joyEl.querySelector('i');
joyEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); joy.on = true; joy.id = e.pointerId; const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyEl.setPointerCapture(e.pointerId); moveJoy(e); if (view !== 'follow' && view !== 'exploded') setView('follow'); });
joyEl.addEventListener('pointermove', (e) => { if (joy.on && e.pointerId === joy.id) moveJoy(e); });
const endJoy = () => { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const r = 46, d = Math.hypot(dx, dy); if (d > r) { dx = dx / d * r; dy = dy / d * r; } joy.x = dx / r; joy.y = dy / r; knob.style.transform = `translate(${dx}px, ${dy}px)`; }
const slowEl = $('slow');
slowEl.addEventListener('pointerdown', (e) => { e.preventDefault(); slowBtn = true; slowEl.classList.add('on'); });
const endSlow = () => { slowBtn = false; slowEl.classList.remove('on'); };
slowEl.addEventListener('pointerup', endSlow); slowEl.addEventListener('pointercancel', endSlow); slowEl.addEventListener('pointerleave', endSlow);
function showCert() {
  $('cert-name').textContent = state.name || '탐험대원'; $('cert-n').textContent = ORDER.length;
  const st = ORDER.reduce((a, k) => a + (state.done[k] || 0), 0); $('cert-stars').textContent = '★'.repeat(Math.max(1, Math.round(st / ORDER.length))) + `  (${st} / ${ORDER.length * 3})  ·  🏅 건물 ${Object.keys(state.rooms).length}/${ROOM_IDS.length}`;
  const d = new Date(); $('cert-date').textContent = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.  인천가현초등학교`;
  $('cert').classList.remove('hidden');
}
$('again').onclick = () => $('cert').classList.add('hidden');
$('print').onclick = () => print();
$('name').value = state.name;
let audioAsked = false;
$('start').onclick = () => {
  state.name = $('name').value.trim(); save(); $('title').classList.add('hidden');
  if (!audioAsked) { audioAsked = true; audio.toggle(); }
  setView('follow');
  toast('🧒 빨간 옷이 나예요! 방향키·WASD로 걸어서 빛나는 아이콘 친구에게 가 봐요');
};

/* ───────────── 크기 맞춤 ───────────── */
function viewShift() { const w = innerWidth, h = innerHeight; if (cur && w < h) camera.setViewOffset(w, h, 0, h * 0.18, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
function resize() {
  const w = innerWidth, h = innerHeight; camera.aspect = w / h; camera.fov = w / h < 1 ? 46 : 30; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); labelR.setSize(w, h); tilt.uniforms.res.value.set(w, h); viewShift();
}
addEventListener('resize', resize);

/* ───────────── 돌리기 ───────────── */
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  updatePlayer(dt, t); followCam();
  if (view === 'follow' && player.g) { ST.uP.value.set(player.x, 0.5, player.z).add(L.build.position); ST.uC.value.copy(camera.position); } else ST.uP.value.y = -99;
  if (fly.t < 1) { fly.t = Math.min(1, fly.t + dt / fly.dur); const k = ease(fly.t); camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); }
  explodeT = lerp(explodeT, explodeGoal, 1 - Math.exp(-dt * 3));
  for (const k in L) L[k].position.y = EXPLODE[k] * explodeT;
  for (const l of layerLines) l.material.opacity = explodeT;
  updateSignals(dt, t); updateTraffic(dt, t); updateGarageCar(dt, t); updateWalkers(dt, t); updateFx(dt, t); updateMission(dt, t); updateRoom(dt, t); updateAct(); updateWeather(dt, t);
  controls.update();
  if (fx.shake > 0.005) root.position.set(rand(-1, 1) * fx.shake, 0, rand(-1, 1) * fx.shake); else root.position.set(0, 0, 0);
  composer.render(); labelR.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ───────────── 시작 ───────────── */
(async function init() {
  try { await Promise.race([Promise.all([document.fonts.load("900 40px 'Noto Sans KR'"), document.fonts.load("700 40px 'Noto Sans KR'")]), new Promise((r) => setTimeout(r, 3500))]); } catch (e) { /* 글꼴 없이도 진행 */ }
  GRID = await (await fetch('../data/gahyeon_grid.json')).json();
  W = GRID.W; H = GRID.H; W2 = W / 2; D2 = H / 2;
  Object.assign(BOX, { x: W2, z: D2 });
  lp(5);
  const tasks = [prepMap, buildGroundPlane, buildSidewalks, buildUnder, buildBuildings, buildProps, buildWeather, layerTags, spawnWalkers, makePlayer, buildNewProps, setupMissions, buildRooms];
  for (const f of tasks) { f(); await new Promise((r) => setTimeout(r, 0)); }
  for (const k of ['E', 'Wb', 'N', 'Sb']) for (let i = 0; i < 3; i++) { const Ln = LANES[k]; spawnCar(k, KINDS[i % KINDS.length], { at: Ln.from + Ln.dir * (10 + i * 18), v: 3 }); }
  resize(); setEnv('weather', 'rain');
  camera.position.set(58, 112, 104); if (camera.aspect < 1) camera.position.multiplyScalar(1.5);
  lp(100); $('loading').classList.add('gone');
  $('start').disabled = false; $('start').textContent = state.name || Object.keys(state.done).length ? '이어서 탐험하기' : '상자 열고 출발!';
  frame();
})();
window.__box = { MI, enterRoom, exitRoom, roomObjs, pickItem, get inRoom() { return inRoom; }, ORDER, phaseOf, T2, sigClock, setView, startMission, setEnv, state, cars, player, keys, get cur() { return cur; }, tp: (tx, ty) => { const [x, z] = T2(tx, ty); player.x = x; player.z = z; player.safe = [x, z]; } };
