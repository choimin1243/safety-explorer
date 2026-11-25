// 송명 안전 탐험대 — 인천송명초 둘레 실제 지도(OSM) + 스프라이트 스택 3D 안전교육 게임
// 디버그: ?auto 제목 건너뜀, ?mute 무음, F3 디버그 패널, window.G 테스트 훅
import * as THREE from 'three';
import { keys, pressed, touch, pinch, endFrame, debugPanel } from './input.js';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

// ================= 렌더러 =================
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3f5);
scene.fog = new THREE.Fog(0xbfe3f5, 90, 190);
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x8a9a6a, 1.6));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 160 });
sun.shadow.bias = -0.0008; scene.add(sun, sun.target);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 58 : 42; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ================= 좌표 =================
const T = 4;                         // 지도 1칸(실제 6m) = 4 단위
let GRID, W, H;
const wx = (tx) => (tx - W / 2) * T, wz = (ty) => (ty - H / 2) * T;
const tx = (x) => x / T + W / 2, ty = (z) => z / T + H / 2;
const SPR = 0.87;                    // 스프라이트 1m → 0.87 단위 (사람·차를 지도보다 조금 크게)

// ================= 불러오기 =================
let MAN;
const sprGeo = {}, sprMat = {}, sprInfo = {};
async function loadAll() {
  GRID = await (await fetch('data/songmyeong_grid.json')).json();
  W = GRID.W; H = GRID.H;
  MAN = await (await fetch('sprites/manifest.json')).json();
  const names = Object.keys(MAN).filter((n) => !/^bld_gahyeon/.test(n)); let done = 0;
  const loader = new THREE.TextureLoader();
  await Promise.all(names.map((n) => new Promise((res) => loader.load('sprites/' + n + '.png', (tex) => {
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    buildSprite(n, tex); $('lp').textContent = Math.round(++done / names.length * 100) + '%'; res();
  }, undefined, () => res()))));
}
// 슬라이스 띠 → 납작한 면 2N장을 쌓은 지오메트리 하나 (그리기 호출 1번)
function buildSprite(name, tex) {
  const m = MAN[name], s = m.note === 'world' ? m.vox : m.vox * SPR * (m.note === 'person' ? 1.75 : 1), w = m.w * s, l = m.l * s, n = m.n;
  const pos = [], uv = [], idx = [];
  const tw = m.w * n;
  for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
    const y = (i + k * 0.5) * s + 0.02, b = pos.length / 3;
    const u0 = (i * m.w + 0.02) / tw, u1 = ((i + 1) * m.w - 0.02) / tw;
    pos.push(-w / 2, y, -l / 2, w / 2, y, -l / 2, w / 2, y, l / 2, -w / 2, y, l / 2);
    uv.push(u0, 1, u1, 1, u1, 0, u0, 0);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  sprGeo[name] = g; sprInfo[name] = { w, l, h: n * s };
  sprMat[name] = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  if (m.note === 'world') addSeeThrough(sprMat[name]);
}
const shadowGeo = new THREE.CircleGeometry(1, 20), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
function sprite(name, x, z, rot = 0, { shadow = true, add = true, scale = 1 } = {}) {
  const g = new THREE.Group(); const m = new THREE.Mesh(sprGeo[name], sprMat[name]); m.scale.setScalar(scale); g.add(m); g.userData.mesh = m; g.userData.name = name;
  if (shadow) { const s = new THREE.Mesh(shadowGeo, shadowMat); s.rotation.x = -Math.PI / 2; s.position.y = 0.03; const i = sprInfo[name]; s.scale.set(i.w * 0.55, i.l * 0.55, 1); g.add(s); }
  g.position.set(x, 0, z); g.rotation.y = rot; if (add) scene.add(g); return g;
}
function setSprite(g, name) { if (g.userData.name !== name && sprGeo[name]) { g.userData.mesh.geometry = sprGeo[name]; g.userData.mesh.material = sprMat[name]; g.userData.name = name; } }
// 같은 소품 여러 개 = InstancedMesh
function instanced(name, list) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(sprGeo[name], sprMat[name], list.length), o = new THREE.Object3D();
  list.forEach(([x, z, r = 0], i) => { o.position.set(x, 0, z); o.rotation.y = r; o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  scene.add(im); return im;
}

// ================= 지도 =================
let ground, blocks;                  // ground[y][x] 문자, blocks: 막힌 칸
const CW = [
  { id: 'S', x0: 46, x1: 47, y0: 35, y1: 37, axis: 'v', off: 0, name: '송명초 정문 앞 횡단보도' },
  { id: 'E', x0: 70, x1: 71, y0: 35, y1: 37, axis: 'v', off: 9, name: '능허대중 앞 횡단보도' },
  { id: 'W', x0: 18, x1: 21, y0: 26, y1: 27, axis: 'h', off: 4, name: '상가 앞 횡단보도' },
  { id: 'N', x0: 18, x1: 21, y0: 46, y1: 47, axis: 'h', off: 13, name: '아파트 쪽 횡단보도' },
];
const cwAt = (x, y) => CW.find((c) => x >= c.x0 && x < c.x1 + 1 && y >= c.y0 && y < c.y1 + 1);
const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : ground[y | 0][x | 0];
const isRoad = (c) => c === 'r' || c === 'z';
const SITE = { x0: 23, x1: 28, y0: 40, y1: 44 };                // 공사 현장
const PARK = { x0: 63, x1: 72, y0: 41, y1: 49 };                // 근린공원 놀이터

function buildMap() {
  ground = GRID.ground.map((r) => r.split(''));
  blocks = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (GRID.bldg[y][x] !== '.') blocks[y * W + x] = 1;
  const nearField = (x, y) => { for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const c = GRID.ground[y + dy]?.[x + dx]; if (c === 'h') return true; } return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground[y][x] === 'r' && nearField(x, y)) ground[y][x] = 'z';   // 스쿨존(빨간 길)
  for (let y = PARK.y0; y <= PARK.y1; y++) for (let x = PARK.x0; x <= PARK.x1; x++) { ground[y][x] = 'd'; blocks[y * W + x] = 0; }
  for (let y = SITE.y0; y <= SITE.y1; y++) for (let x = SITE.x0; x <= SITE.x1; x++) { ground[y][x] = 'k'; blocks[y * W + x] = 0; }
  for (let y = 33; y <= 34; y++) for (let x = 1; x <= 8; x++) { if (!blocks[y * W + x]) ground[y][x] = 'm'; }        // 안전 집결지 광장
  // 지면 텍스처 (1칸 = 16px, 픽셀아트)
  const P = 16, cv = document.createElement('canvas'); cv.width = W * P; cv.height = H * P; const g = cv.getContext('2d');
  const COL = { y: '#c9d7a6', g: '#8cc56a', h: '#d7b98a', r: '#4a4f57', z: '#9a4a46', s: '#d9d2c3', v: '#cbbf9f', d: '#e8d39a', k: '#a07c52', m: '#d8cfe6' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = ground[y][x]; g.fillStyle = COL[c] || '#8cc56a'; g.fillRect(x * P, y * P, P, P);
    const h = hash(x, y);
    if (c === 'g' || c === 'y') { g.fillStyle = 'rgba(40,90,30,.12)'; for (let i = 0; i < 5; i++) g.fillRect(x * P + ((h * 97 + i * 37) % 14 | 0), y * P + ((h * 53 + i * 29) % 14 | 0), 2, 2); }
    if (c === 's' || c === 'm') { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x * P, y * P + 7, P, 1); g.fillRect(x * P + ((y % 2) ? 4 : 11), y * P, 1, 7); g.fillRect(x * P + ((y % 2) ? 11 : 4), y * P + 8, 1, 8); }
    if (c === 'h') { g.fillStyle = 'rgba(120,80,40,.10)'; g.fillRect(x * P + (h * 12 | 0), y * P + (h * 7 | 0), 3, 2); }
    if (c === 'k' && h > 0.5) { g.fillStyle = '#7a5a36'; g.fillRect(x * P + 3, y * P + 9, 8, 3); }
    if (c === 'd' && h > 0.6) { g.fillStyle = '#d4bd80'; g.fillRect(x * P + 6, y * P + 6, 3, 3); }
  }
  // 차선: 교육로(가로) 가운데 노란 두 줄, 28번길(세로)
  g.fillStyle = '#ffd34d';
  for (let x = 22; x < W; x++) { g.fillRect(x * P, 36 * P + 7, P, 1); g.fillRect(x * P, 36 * P + 9, P, 1); }
  for (let y = 0; y < H; y++) if (y < 35 || y > 37) { g.fillRect(19 * P + 15, y * P, 1, P); g.fillRect(20 * P, y * P, 1, P); }
  g.fillStyle = 'rgba(255,255,255,.8)';
  for (let x = 22; x < W; x += 2) { g.fillRect(x * P + 2, 35 * P + 8, 10, 1); g.fillRect(x * P + 2, 37 * P + 7, 10, 1); }
  // 스쿨존 글씨 · 30
  g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
  for (const x of [40, 55, 78]) { g.fillText('어린이 보호구역', x * P, 37 * P + 12); g.fillText('어린이 보호구역', x * P + 160, 35 * P + 9); }
  g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif'; for (const x of [34, 62]) g.fillText('30', x * P, 36 * P + 4);
  // 횡단보도 줄무늬 + 노란 발자국(정지선)
  for (const c of CW) {
    g.fillStyle = COL.r; g.fillRect(c.x0 * P, c.y0 * P, (c.x1 - c.x0 + 1) * P, (c.y1 - c.y0 + 1) * P);
    g.fillStyle = '#f4f4f0';
    if (c.axis === 'v') for (let y = c.y0 * P + 2; y < (c.y1 + 1) * P; y += 8) g.fillRect(c.x0 * P + 2, y, (c.x1 - c.x0 + 1) * P - 4, 4);
    else for (let x = c.x0 * P + 2; x < (c.x1 + 1) * P; x += 8) g.fillRect(x, c.y0 * P + 2, 4, (c.y1 - c.y0 + 1) * P - 4);
    g.fillStyle = '#ffd34d';
    if (c.axis === 'v') { g.fillRect(c.x0 * P + 4, (c.y0 - 1) * P + 9, 6, 4); g.fillRect(c.x0 * P + 18, (c.y0 - 1) * P + 9, 6, 4); g.fillRect(c.x0 * P + 4, (c.y1 + 1) * P + 3, 6, 4); g.fillRect(c.x0 * P + 18, (c.y1 + 1) * P + 3, 6, 4); }
  }
  // 운동장 선
  const track = (r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(44 * P, (26.5 - r) * P); g.lineTo(52 * P, (26.5 - r) * P); g.arc(52 * P, 26.5 * P, r * P, -Math.PI / 2, Math.PI / 2); g.lineTo(44 * P, (26.5 + r) * P); g.arc(44 * P, 26.5 * P, r * P, Math.PI / 2, Math.PI * 1.5); g.stroke(); };
  track(3.6, '#c8624a', 1.4 * P); for (const r of [2.95, 3.4, 3.85, 4.3]) track(r, 'rgba(255,255,255,.85)', 1.5);
  g.fillStyle = '#7fb85a'; g.beginPath(); g.moveTo(44 * P, 23.6 * P); g.lineTo(52 * P, 23.6 * P); g.arc(52 * P, 26.5 * P, 2.9 * P, -Math.PI / 2, Math.PI / 2); g.lineTo(44 * P, 29.4 * P); g.arc(44 * P, 26.5 * P, 2.9 * P, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.strokeRect(43 * P, 24.4 * P, 10 * P, 4.2 * P); g.beginPath(); g.moveTo(48 * P, 24.4 * P); g.lineTo(48 * P, 28.6 * P); g.stroke(); g.beginPath(); g.arc(48 * P, 26.5 * P, 1 * P, 0, 7); g.stroke();
  // 주차장 출입구 정지선
  g.fillStyle = '#ffd34d'; g.fillRect(15 * P, 59 * P + 10, 3 * P, 3);
  g.fillStyle = '#3a3f47'; g.fillRect(6 * P, 58 * P, 12 * P, P);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W * T, H * T), new THREE.MeshLambertMaterial({ map: tex }));
  plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; scene.add(plane);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: 0x9bc77a })); outside.rotation.x = -Math.PI / 2; outside.position.y = -0.05; scene.add(outside);
  // 미니맵 바탕
  const mm = $('minimap').getContext('2d'); mm.imageSmoothingEnabled = false; mm.drawImage(cv, 0, 0, 180, 140);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (blocks[y * W + x]) { mm.fillStyle = '#7d8796'; mm.fillRect(x * 2, y * 2, 2, 2); }
  minimapBase = mm.getImageData(0, 0, 180, 140);
  buildBuildings();
}
let minimapBase;

// ---------- 건물: 바깥 벽만 만든 블록, 창문 질감, 플레이어를 가리면 점무늬로 비침 ----------
const seeThrough = { uP: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() } };
function windowTex(wall, win, lit) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, 16, 16); g.fillStyle = win; g.fillRect(3, 4, 4, 6); g.fillRect(9, 4, 4, 6);
  g.fillStyle = lit; g.fillRect(3, 4, 4, 1); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 14, 16, 2);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stMat(opts) { return addSeeThrough(new THREE.MeshLambertMaterial(opts)); }
function addSeeThrough(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uP = seeThrough.uP; sh.uniforms.uC = seeThrough.uC;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform vec3 uP; uniform vec3 uC;').replace('void main() {', `void main() {
      vec3 d = uP - uC; float t = clamp(dot(vW - uC, d) / dot(d, d), 0.0, 1.0);
      float dist = length(vW - (uC + d * t));
      if (t < 0.92 && dist < 5.5 && vW.y > 0.4) { if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0 || dist < 3.5) discard; }`);
  };
  return m;
}
const KIND = {
  apartments: { wall: '#eef1f4', win: '#8fb4cf', lit: '#cfe6f5', roof: 0xd5dbe2, h: (lv) => clamp(lv * 0.45, 6, 15) },
  school: { wall: '#f4e8cc', win: '#7aa6c4', lit: '#bfe0f2', roof: 0xc98f5a, h: () => 7 },
  kindergarten: { wall: '#ffe3bd', win: '#7aa6c4', lit: '#bfe0f2', roof: 0xe8a96a, h: () => 4 },
  commercial: { wall: '#f7e6b5', win: '#6f9fc0', lit: '#ffe9a0', roof: 0xc9a85a, h: (lv) => clamp(lv * 1.6, 4, 8) },
  public: { wall: '#e6e3dc', win: '#7f9db5', lit: '#cfe6f5', roof: 0xbdb6a8, h: () => 6 },
  house: { wall: '#efe6d8', win: '#7f9db5', lit: '#cfe6f5', roof: 0xb86a4a, h: () => 4 },
};
const SPRITE_BLDG = ['b', 'c', '\x92'];
function placeSchoolSprites() {
  for (let y = 13; y <= 16; y++) for (let x = 72; x <= 83; x++) blocks[y * W + x] = 1;      // 능허대중 교사 (OSM에 모양 없음)
  for (const n of ['bld_songmyeong', 'bld_songmyeong_gym', 'bld_cheomdan', 'bld_neunghuh']) {
    const m = MAN[n]; sprite(n, wx(m.bx) + m.tw * T / 2, wz(m.by) + m.th * T / 2, 0, { shadow: false });
  }
}
// 건물 벽 질감: 4가지 무늬를 가로로 이어 붙이고, 칸마다 u 범위를 골라 써서 똑같아 보이지 않게
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FACADE = {
  apartments: (K) => canvasTex(128, 32, (g) => {                 // 발코니 창: 유리 · 창틀 · 난간 · 바닥 띠, 커튼/불 켜진 집
    for (let v = 0; v < 4; v++) {
      const o = v * 32; g.fillStyle = K.wall; g.fillRect(o, 0, 32, 32);
      g.fillStyle = '#c9d3dc'; g.fillRect(o + 2, 3, 28, 22); g.fillStyle = K.win; g.fillRect(o + 3, 4, 26, 15);
      g.fillStyle = ['#cfe6f5', '#ffe9a0', '#f2c6c6', '#d6ecd2'][v]; g.fillRect(o + (v % 2 ? 4 : 17), 5, 11, 13);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(o + 5, 5, 2, 9);
      g.fillStyle = '#9aa7b3'; g.fillRect(o + 15, 4, 2, 15); g.fillRect(o + 2, 19, 28, 1);
      g.fillStyle = 'rgba(80,95,110,.55)'; for (let x = 3; x < 30; x += 3) g.fillRect(o + x, 20, 1, 5);
      g.fillStyle = '#7f8c98'; g.fillRect(o + 2, 25, 28, 2); g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(o, 29, 32, 3);
      if (v === 3) { g.fillStyle = '#a7b3bd'; g.fillRect(o + 22, 21, 6, 4); }      // 실외기
    }
  }),
  commercial: (K) => canvasTex(64, 16, (g) => {
    for (let v = 0; v < 4; v++) { const o = v * 16; g.fillStyle = K.wall; g.fillRect(o, 0, 16, 16); g.fillStyle = K.win; g.fillRect(o + 2, 3, 12, 8); g.fillStyle = K.lit; g.fillRect(o + 2, 3, 12, 2); g.fillStyle = '#8a7a5a'; g.fillRect(o + 7, 3, 2, 8); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(o, 14, 16, 2); }
  }),
};
const BASE = {     // 1층: 아파트 필로티·현관, 상가 유리 진열창
  apartments: canvasTex(64, 16, (g) => { for (let v = 0; v < 4; v++) { const o = v * 16; g.fillStyle = '#b9b2a6'; g.fillRect(o, 0, 16, 16); g.fillStyle = v === 1 ? '#5b7f9e' : '#6d6a64'; g.fillRect(o + 3, 3, 10, 13); if (v === 1) { g.fillStyle = '#a8d8f0'; g.fillRect(o + 4, 4, 3, 11); g.fillRect(o + 9, 4, 3, 11); } g.fillStyle = '#d9d2c3'; g.fillRect(o, 0, 16, 2); } }),
  commercial: canvasTex(64, 16, (g) => { for (let v = 0; v < 4; v++) { const o = v * 16; g.fillStyle = '#d8d2c4'; g.fillRect(o, 0, 16, 16); g.fillStyle = '#9fd0ea'; g.fillRect(o + 1, 3, 14, 13); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(o + 3, 5, 2, 8); g.fillStyle = '#5a5248'; g.fillRect(o + 7, 3, 2, 13); g.fillStyle = ['#e2463b', '#2fa84f', '#2f7de1', '#ff9f1c'][v]; g.fillRect(o, 0, 16, 3); } }),
};
const BAND = {     // 꼭대기: 아파트 색 띠, 상가 간판
  apartments: (col) => canvasTex(16, 8, (g) => { g.fillStyle = col; g.fillRect(0, 0, 16, 8); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 6, 16, 1); }),
  commercial: () => canvasTex(64, 16, (g) => { const cs = ['#e2463b', '#2f7de1', '#2fa84f', '#ff9f1c']; for (let v = 0; v < 4; v++) { const o = v * 16; g.fillStyle = cs[v]; g.fillRect(o, 1, 16, 14); g.fillStyle = '#fff'; for (let x = 2; x < 14; x += 3) g.fillRect(o + x, 5, 2, 6); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(o, 14, 16, 2); } }),
};
const ACCENT = ['#2f6fb3', '#3f8f5a', '#c8623a', '#7a5cc8'];
function buildBuildings() {
  const groups = {}, bld = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = GRID.bldg[y][x]; if (ch === '.') continue;
    if (!blocks[y * W + x] || SPRITE_BLDG.includes(ch)) continue;
    const id = ch.charCodeAt(0) - 48, b = GRID.buildings[id] || { kind: 'public', levels: 3 };
    const k = KIND[b.kind] ? b.kind : 'public', h = KIND[k].h(b.levels || 3), acc = id % ACCENT.length;
    const key = k === 'apartments' ? k + '|' + acc : k;
    (groups[key] ||= { k, acc, cells: [] }).cells.push({ x, y, id: ch, h });
    (bld[ch] ||= { k, h, b, cells: [] }).cells.push([x, y]);
  }
  for (const { k, acc, cells } of Object.values(groups)) {
    const fancy = k === 'apartments' || k === 'commercial';
    const BH = k === 'apartments' ? 2.2 : k === 'commercial' ? 2.0 : 0, TB = k === 'apartments' ? 0.8 : k === 'commercial' ? 1.1 : 0;
    const pos = [], nor = [], uv = [], L = [[], [], [], []];   // 0 벽 1 지붕 2 1층 3 꼭대기 띠
    const at = {}; cells.forEach((c) => (at[c.x + ',' + c.y] = c));
    const quad = (a, b, c, d, n, uvs, list) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); for (let j = 0; j < 4; j++) nor.push(...n); uv.push(...uvs); list.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (const c of cells) {
      const x0 = wx(c.x), x1 = wx(c.x + 1), z0 = wz(c.y), z1 = wz(c.y + 1), h = c.h;
      quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], [0, 0, 0, 1, 1, 1, 1, 0], L[1]);
      const nb = (dx, dy) => { const o = at[(c.x + dx) + ',' + (c.y + dy)]; return o && o.id === c.id; };
      const faces = [];
      if (!nb(0, 1)) faces.push([[x0, z1], [x1, z1], [0, 0, 1]]);
      if (!nb(0, -1)) faces.push([[x1, z0], [x0, z0], [0, 0, -1]]);
      if (!nb(1, 0)) faces.push([[x1, z1], [x1, z0], [1, 0, 0]]);
      if (!nb(-1, 0)) faces.push([[x0, z0], [x0, z1], [-1, 0, 0]]);
      faces.forEach(([[ax, az], [bx, bz], n], fi) => {
        const v = (hash(c.x * 3 + fi, c.y * 5) * 4) | 0, u0 = fancy ? v / 4 : 0, u1 = fancy ? (v + 1) / 4 : 1;
        const part = (y0, y1, list, vv) => quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], n, [u0, 0, u1, 0, u1, vv, u0, vv], list);
        if (BH) part(0, BH, L[2], 1);
        part(BH, h - TB, L[0], (h - TB - BH) / 2.6);
        if (TB) part(h - TB, h, L[3], 1);
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx = []; let off = 0; L.forEach((l, i) => { if (l.length) g.addGroup(off, l.length, i); off += l.length; idx.push(...l); }); g.setIndex(idx);
    const K = KIND[k];
    const mats = [stMat({ map: (FACADE[k] || ((K) => windowTex(K.wall, K.win, K.lit)))(K) }), stMat({ color: K.roof }),
      stMat({ map: BASE[k] || windowTex(K.wall, K.win, K.lit) }), stMat({ map: k === 'apartments' ? BAND.apartments(ACCENT[acc]) : (BAND[k] || (() => windowTex(K.wall, K.win, K.lit)))() })];
    const mesh = new THREE.Mesh(g, mats); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
  // 옥상(엘리베이터 기계실 · 물탱크 · 실외기)과 동 번호 판
  const boxes = [], tanks = [];
  for (const [ch, B] of Object.entries(bld)) {
    if (B.cells.length < 3) continue;
    const xs = B.cells.map((c) => c[0]), ys = B.cells.map((c) => c[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const has = (x, y) => B.cells.some((c) => c[0] === (x | 0) && c[1] === (y | 0));
    const sx = has(cx, cy) ? cx : B.cells[B.cells.length >> 1][0] + 0.5, sy = has(cx, cy) ? cy : B.cells[B.cells.length >> 1][1] + 0.5;
    if (B.k === 'apartments') { boxes.push([wx(sx), B.h, wz(sy), 2.6, 2.0, 2.2, 0xdfe3e6]); tanks.push([wx(sx) + 2.2, B.h, wz(sy) - 0.6]); boxes.push([wx(sx) - 2.4, B.h, wz(sy) + 0.6, 1.2, 0.8, 0.9, 0xb8c0c8]); }
    else if (B.k === 'commercial') { boxes.push([wx(sx), B.h, wz(sy), 1.4, 0.9, 1.0, 0xc8ced4]); }
    const nm = (B.b.name || '').replace(/동$/, '');
    if (B.k === 'apartments' && /^\d{3,4}$/.test(nm)) {                         // 남쪽(화면 앞) 벽 꼭대기에 '801동'
      const maxY = Math.max(...ys), row = B.cells.filter((c) => c[1] === maxY).map((c) => c[0]).sort((a, b) => a - b);
      const px = wx(row[row.length >> 1] + 0.5), pz = wz(maxY + 1) + 0.04;
      const t = canvasTex(64, 24, (g) => { g.fillStyle = '#ffffff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nm + '동', 32, 13); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.position.set(px, B.h - 0.4, pz); scene.add(m);
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  if (boxes.length) { const im = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), boxes.length), o = new THREE.Object3D(), col = new THREE.Color();
    boxes.forEach(([x, y, z, sx, sy, sz, c], i) => { o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.set(c)); }); im.castShadow = true; scene.add(im); }
  if (tanks.length) { const tg = new THREE.CylinderGeometry(0.8, 0.8, 1.3, 10); tg.translate(0, 0.65, 0); const im = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0x5b8fc8 }), tanks.length), o = new THREE.Object3D();
    tanks.forEach(([x, y, z], i) => { o.position.set(x, y, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); scene.add(im); }
}
// ---------- 이름표 ----------
function label(text, x, y, z, { bg = '#ffffff', fg = '#1d2a33', scale = 1 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = 'bold 44px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 48; c.width = w; c.height = 76;
  g.font = 'bold 44px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  g.fillStyle = bg; g.beginPath(); g.roundRect(3, 3, w - 6, 70, 30); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 4; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.renderOrder = 5;
  s.scale.set(w / 76 * 1.6 * scale, 1.6 * scale, 1); s.position.set(x, y, z); scene.add(s); return s;
}

// ================= 소품 배치 =================
const colliders = [];                // {x,z,r}
function prop(name, ttx, tty, rot = 0, r = 0.8) { const g = sprite(name, wx(ttx), wz(tty), rot, { shadow: false }); if (r) colliders.push({ x: g.position.x, z: g.position.z, r }); return g; }
const fences = [];
function placeProps() {
  // 가로수: 인도 옆 풀밭에 줄지어 (은행나무), 단지·공원 안에는 둥근 나무
  const ginkgo = [], round = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (blocks[y * W + x] || cwNear(x, y)) continue;
    const c = ground[y][x];
    if (c === 'g' && (y === 33 || y === 39) && x % 4 === 1 && x > 23 && !(y === 33 && x > 73 && x < 82)) ginkgo.push([wx(x + 0.5), wz(y + 0.5)]);
    else if (c === 'g' && (x === 17 || x === 22) && y % 4 === 2 && (y < 33 || y > 39)) ginkgo.push([wx(x + 0.5), wz(y + 0.5)]);
    else if ((c === 'y' || c === 'g') && hash(x, y) > 0.93 && !nearRoad(x, y) && !(x >= PARK.x0 - 1 && x <= PARK.x1 + 1 && y >= PARK.y0 - 1 && y <= PARK.y1 + 1) && !(x >= SITE.x0 - 2 && x <= SITE.x1 + 2 && y >= SITE.y0 - 2 && y <= SITE.y1 + 2)) round.push([wx(x + 0.5), wz(y + 0.5), hash(y, x) * 6]);
  }
  instanced('tree_ginkgo', ginkgo); instanced('tree_round', round);
  [...ginkgo, ...round].forEach(([x, z]) => colliders.push({ x, z, r: 0.9 }));
  // 교육로 가로등 · 스쿨존 울타리 · 표지판 · CCTV
  const lamps = []; for (let x = 26; x < W; x += 10) { lamps.push([wx(x), wz(34.2), Math.PI]); lamps.push([wx(x + 5), wz(38.8), 0]); }
  instanced('street_lamp', lamps);
  const sf = [];
  for (let x = 24; x < W - 2; x += 3) { if (Math.abs(x - 46.5) < 4 || Math.abs(x - 70.5) < 4 || Math.abs(x - 77) < 4) continue; sf.push([wx(x + 1.5), wz(34.05), 0]); sf.push([wx(x + 1.5), wz(38.95), 0]); }
  instanced('safety_fence', sf);
  prop('sign_school', 43.5, 34.1, 0, 0.3); prop('sign_30', 51, 38.9, Math.PI, 0.3); prop('cctv', 49.6, 34.1, 0, 0.3); prop('crosswalk_sign', 45.2, 38.9, Math.PI, 0.3);
  prop('crosswalk_sign', 69.2, 34.1, 0, 0.3);
  // 송명초 정문
  prop('school_gate', 47, 33.2, 0, 0); colliders.push({ x: wx(44.2), z: wz(33.2), r: 1.2 }, { x: wx(49.8), z: wz(33.2), r: 1.2 });
  label('🏫 인천송명초등학교', wx(47), 15, wz(15.5), { bg: '#2f7de1', fg: '#fff', scale: 1.4 });
  prop('soccer_goal', 43.2, 26.5, Math.PI / 2, 0); prop('soccer_goal', 52.8, 26.5, -Math.PI / 2, 0);
  prop('hoop', 55, 23, -Math.PI / 2, 0.5);
  // 버스 정류장 (교육로 북쪽 인도)
  prop('bus_shelter', 77, 33.4, Math.PI, 0); colliders.push({ x: wx(77), z: wz(33.2), r: 2.2 }); prop('busstop_sign', 79.6, 34.2, Math.PI, 0.3);
  label('🚌 송명초·능허대중 정류장', wx(77), 6, wz(33), { bg: '#2fa84f', fg: '#fff', scale: 0.8 });
  // 상가 (서쪽): 편의점 = 아동안전지킴이집, 분식집
  prop('shop_conv', 10.5, 33.3, 0, 0); for (let x = 9; x <= 12; x += 1) colliders.push({ x: wx(x), z: wz(33.35), r: 0.6 }); prop('safe_sign', 13.8, 33.6, 0, 0.3);
  label('🏪 편의점 · 아동안전지킴이집', wx(10.5), 7.5, wz(32.6), { bg: '#ffd23f', scale: 0.85 });
  prop('shop_snack', 15.4, 13.5, Math.PI / 2, 0); label('🍢 상가 분식집', wx(15.2), 7.5, wz(13.5), { bg: '#ff9f1c', fg: '#fff', scale: 0.85 });
  prop('extinguisher', 15.8, 16.6, 0, 0.3); prop('vending', 15.6, 10.3, Math.PI / 2, 0.6);
  prop('flag', 2.2, 33.4, 0, 0.3); label('🚩 안전 집결지', wx(4.5), 5, wz(33.6), { bg: '#16a34a', fg: '#fff', scale: 0.8 });
  prop('trash_bins', 16.2, 31.5, Math.PI / 2, 1); prop('postbox', 14.6, 34.8, 0, 0.5); prop('bench', 9.5, 35.3, 0, 1);
  prop('van', 27.4, 30.4, 0, 1.6);
  // 근린공원 놀이터
  label('🛝 근린공원 놀이터', wx(67.5), 6, wz(41.2), { bg: '#f59e0b', fg: '#fff', scale: 0.85 });
  playground.slide = prop('slide', 66, 44.2, 0, 0.6); playground.swing = prop('swing', 70.3, 43.5, 0, 0);
  colliders.push({ x: wx(68.9), z: wz(43.5), r: 0.5 }, { x: wx(71.8), z: wz(43.5), r: 0.5 });
  playground.seesaw = prop('seesaw', 70.5, 47.6, Math.PI / 2, 0.8); prop('bench', 64.5, 48.6, 0, 1); prop('bench', 61, 45, Math.PI / 2, 1);
  prop('aed', 62.6, 41.2, 0, 0.4); prop('planter', 59, 41.2, 0, 1.2); prop('bike_rack', 57.5, 42.2, 0, 1.6);
  // 공사 현장: 울타리 (북·남 가운데는 열린 '지름길' 틈), 비계, 굴착기
  // 둘레는 막고 북·남 가운데(x 25~26)만 열린 '지름길' 틈
  for (const x of [23, 24, 27, 28]) for (const y of [SITE.y0, SITE.y1]) { solidTile(x, y); prop('fence', x + 0.5, y + 0.5, 0, 0); }
  for (let y = SITE.y0 + 1; y < SITE.y1; y++) for (const x of [SITE.x0, SITE.x1]) { solidTile(x, y); prop('fence', x + 0.5, y + 0.5, Math.PI / 2, 0); }
  prop('scaffold', 26.6, 41.6, 0, 0); prop('excavator', 25.5, 42.6, 0.4, 0); prop('cone', 25.5, 39.4, 0, 0.3); prop('cone', 26.5, 39.4, 0, 0.3); prop('cone', 25.5, 45.6, 0, 0.3); prop('cone', 26.5, 45.6, 0, 0.3);
  label('🚧 단지 보수공사 (출입 금지)', wx(25.8), 7, wz(42.5), { bg: '#f5a623', fg: '#fff', scale: 0.8 });
  // 아파트 단지 출입구 (지하주차장)
  prop('guard_booth', 13.3, 56.6, 0, 2.2); prop('mirror', 17.4, 57.4, -Math.PI * 0.75, 0.3);
  label('🚗 단지 출입구 (지하주차장)', wx(12), 6, wz(56), { bg: '#64748b', fg: '#fff', scale: 0.8 });
  // 집 (출발)
  label('🏠 우리 집 (송도 더샵 그린스퀘어)', wx(46.5), 5, wz(65.2), { bg: '#ffffff', scale: 0.85 });
  prop('bench', 44, 62, 0, 1); prop('planter', 49, 62, 0, 1.2);
  // 첨단초 · 능허대중 이름표
  label('🏫 첨단초등학교', wx(48), 12, wz(47), { bg: '#7c3aed', fg: '#fff', scale: 1.1 });
  label('🏫 능허대중학교', wx(77.5), 6, wz(12), { bg: '#7c3aed', fg: '#fff', scale: 1.1 });
  // 소화전·볼라드
  [[30, 38.8], [60, 34.2], [84, 38.8]].forEach(([x, y]) => prop('hydrant', x, y, 0, 0.3));
  [[45, 38.6], [48, 38.6], [69, 38.6], [72, 38.6], [45, 34.4], [48, 34.4]].forEach(([x, y]) => prop('bollard', x, y, 0, 0.25));
  // ---- 송명초 운동장 ----
  prop('stage', 51.6, 22.2, 0, 2.2); prop('flagpoles', 40.6, 21.6, 0, 1.0); prop('statue', 43.4, 21.7, 0, 0.8);
  prop('bleachers', 39.7, 24.6, -Math.PI / 2, 0); prop('bleachers', 39.7, 28.6, -Math.PI / 2, 0); for (let y = 23.6; y <= 29.6; y += 1) colliders.push({ x: wx(39.6), z: wz(y), r: 1.0 });
  prop('pullup_bars', 54.6, 30.2, Math.PI / 2, 1.0); prop('jungle_gym', 44, 9.6, 0, 1.6); prop('garden', 40.7, 9.6, 0, 2.0); prop('pavilion', 53.4, 9.4, 0, 2.0);
  prop('shoe_rack', 47.6, 21.3, 0, 0.8); prop('bike_rack', 50.2, 33.1, 0, 1.2); prop('school_bus', 37.6, 31.2, Math.PI, 0); colliders.push({ x: wx(37.6), z: wz(30.4), r: 1.2 }, { x: wx(37.6), z: wz(32), r: 1.2 });
  for (const [x, y] of [[41.5, 22.3], [54.5, 22.3], [41.5, 30.7], [54.5, 30.7]]) prop('track_marker', x, y, 0, 0.2);
  label('🏃 송명초 운동장', wx(48), 4, wz(29.3), { bg: '#ffffff', scale: 0.7 });
  label('🏀 체육관', wx(52), 11, wz(13.6), { bg: '#a87a45', fg: '#fff', scale: 0.8 });
  // ---- 정문 앞 옐로카펫 (횡단보도 대기 공간) ----
  prop('yellow_carpet', 44.7, 39.1, 0, 0); prop('yellow_carpet', 49.3, 33.9, Math.PI, 0);
  // ---- 상가 앞면 더 ----
  prop('shop_pharmacy', 15.4, 9.0, Math.PI / 2, 0); prop('shop_taekwondo', 15.4, 18.2, Math.PI / 2, 0);
  prop('shop_cafe', 23.6, 19.4, -Math.PI / 2, 0); prop('shop_academy', 23.6, 22.2, -Math.PI / 2, 0); prop('shop_pharmacy', 15.6, 28.5, Math.PI / 2, 0);
  label('💊 약국', wx(16), 6.6, wz(9), { bg: '#2fa84f', fg: '#fff', scale: 0.6 }); label('🥋 태권도장', wx(16), 6.6, wz(18.2), { bg: '#e2463b', fg: '#fff', scale: 0.6 });
  label('☕ 카페', wx(23.2), 6.6, wz(19.4), { bg: '#7a4f2a', fg: '#fff', scale: 0.6 }); label('📚 영어·수학 학원', wx(23.2), 6.6, wz(22.2), { bg: '#5b8def', fg: '#fff', scale: 0.6 });
  // ---- 단지 · 공원 생활 소품 ----
  prop('outdoor_gym', 58.6, 47.6, 0, 1.6); prop('recycle_station', 35.6, 62.6, 0, 2.0); prop('recycle_station', 8.6, 45.6, Math.PI / 2, 2.0);
  prop('apt_entrance', 30.5, 29.95, 0, 0); prop('school_door', 40.55, 16.5, -Math.PI / 2, 0); prop('school_door', 42.2, 20.95, 0, 0); prop('school_door', 49.65, 19.5, Math.PI / 2, 0); prop('school_door', 52.5, 16.75, 0, 0);
  prop('parcel_locker', 51.2, 62.4, 0, 0.8); prop('apt_sign', 44.6, 62.6, 0, 0.4); prop('pavilion', 75, 47.5, 0, 2.0); prop('bench', 72.6, 45.5, Math.PI / 2, 1);
  // 단지 안 주차된 차 (같은 색끼리 묶어 그리기)
  const parked = { car_white: [], car_gray: [], car_black: [], car_blue: [], car_red: [] }, pn = Object.keys(parked);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (ground[y][x] !== 'y' || blocks[y * W + x] || nearRoad(x, y) || hash(x * 7, y * 3) < 0.955) continue;
    if (!blocks[y * W + x - 1] && !blocks[y * W + x + 1] && !blocks[(y - 1) * W + x] && !blocks[(y + 1) * W + x]) continue;   // 건물 옆에만
    if (Math.abs(x - 46.5) < 3 && Math.abs(y - 63) < 3) continue;
    const r = hash(y, x) > 0.5 ? 0 : Math.PI / 2; parked[pn[(hash(x, y * 5) * pn.length) | 0]].push([wx(x + 0.5), wz(y + 0.5), r]); colliders.push({ x: wx(x + 0.5), z: wz(y + 0.5), r: 1.6 });
  }
  for (const n of pn) instanced(n, parked[n]);
  // ---- 첨단초 앞마당 ----
  prop('flagpoles', 51.6, 55.8, 0, 1.0); prop('statue', 44.6, 55.8, 0, 0.8); prop('garden', 41.6, 59.2, 0, 2.0); prop('pullup_bars', 54.4, 59.6, Math.PI / 2, 1.0); prop('bench', 47, 59.8, 0, 1); prop('bike_rack', 49.5, 59.8, 0, 1.2);
  placeSchoolSprites();
}
const cwNear = (x, y) => CW.some((c) => x >= c.x0 - 2 && x <= c.x1 + 2 && y >= c.y0 - 2 && y <= c.y1 + 2);
const nearRoad = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isRoad(tile(x + dx, y + dy))) return true; return false; };
const extraSolid = new Set();
function solidTile(x, y) { extraSolid.add((x | 0) + ',' + (y | 0)); }
const playground = {};

// ================= 신호등 =================
const CYC = 22, PG = 9;               // 보행 초록 9초 (마지막 3초 깜빡임), 그다음 차 초록
const signals = [];                   // {cw, kind:'ped'|'car', g: Group, variants}
let simT = 0;
function sigState(c) {
  const t = (simT + c.off) % CYC, pedGreen = t < PG, blink = pedGreen && t > PG - 3;
  const car = t < PG + 1.5 ? 'red' : t < CYC - 2 ? 'green' : 'yellow';
  return { pedGreen, blink, car };
}
function placeSignals() {
  for (const c of CW) {
    let peds, cars;
    if (c.axis === 'v') { // 가로 도로를 남북으로 건넌다
      peds = [[c.x1 + 1.4, c.y0 - 1.1, Math.PI], [c.x0 - 0.4, c.y1 + 2.1, 0]];
      cars = [[c.x0 - 2, c.y0 - 1.2, Math.PI, 'W'], [c.x1 + 3, c.y1 + 2.2, 0, 'E']];
    } else {
      peds = [[c.x0 - 1.2, c.y0 - 0.4, -Math.PI / 2], [c.x1 + 2.2, c.y1 + 1.4, Math.PI / 2]];
      cars = [];
    }
    for (const [x, y, r] of peds) addSignal(c, 'ped', x, y, r, ['ped_signal_red', 'ped_signal_green', 'ped_signal_off']);
    for (const [x, y, r] of cars) addSignal(c, 'car', x, y, r, ['car_signal_red', 'car_signal_yellow', 'car_signal_green']);
  }
}
function addSignal(c, kind, x, y, r, names) {
  const g = new THREE.Group(); g.position.set(wx(x), 0, wz(y)); g.rotation.y = r; scene.add(g);
  const v = {}; names.forEach((n) => { const m = new THREE.Mesh(sprGeo[n], sprMat[n]); m.visible = false; g.add(m); v[n] = m; });
  signals.push({ c, kind, v }); colliders.push({ x: g.position.x, z: g.position.z, r: 0.35 });
}
let lastTick = 0;
function updateSignals(time) {
  for (const s of signals) {
    const st = sigState(s.c);
    if (s.kind === 'ped') { const on = st.pedGreen && !(st.blink && Math.sin(time * 10) < 0); s.v.ped_signal_red.visible = !st.pedGreen; s.v.ped_signal_green.visible = on; s.v.ped_signal_off.visible = st.pedGreen && !on; }
    else { s.v.car_signal_red.visible = st.car === 'red'; s.v.car_signal_yellow.visible = st.car === 'yellow'; s.v.car_signal_green.visible = st.car === 'green'; }
  }
  const near = CW.find((c) => Math.abs(player.tx - (c.x0 + c.x1 + 1) / 2) < 5 && Math.abs(player.ty - (c.y0 + c.y1 + 1) / 2) < 5);
  if (near && sigState(near).pedGreen && Math.floor(time * 2) !== lastTick) { lastTick = Math.floor(time * 2); sfx.tick(); }
}

// ================= 차량 =================
// 우측 통행: 교육로 동쪽행 = 남쪽 차선(ty 37.2), 서쪽행 = 북쪽 차선(ty 35.8). 28번길 북행 = 동쪽 차선(tx 20.6), 남행 = 서쪽 차선(tx 19.4)
const LANES = {
  E: { axis: 'x', dir: 1, c: 37.2, from: 23, to: 92, stops: [['S', 45.5], ['E', 69.5]] },
  Wb: { axis: 'x', dir: -1, c: 35.8, from: 92, to: 17, stops: [['E', 72.5], ['S', 48.5]] },
  N: { axis: 'y', dir: -1, c: 20.6, from: 72, to: -3, stops: [['N', 48.5], ['W', 28.5]] },
  Sb: { axis: 'y', dir: 1, c: 19.4, from: -3, to: 72, stops: [['W', 25.5], ['N', 45.5]] },
};
const cars = [];
const CAR_NAMES = ['car_white', 'car_blue', 'car_red', 'car_gray', 'car_black', 'taxi', 'car_white', 'delivery_truck', 'scooter', 'police_car'];
function spawnCar(lane, name, { at, speed = 9, special } = {}) {
  const L = LANES[lane], p = at ?? L.from;
  const rot = L.axis === 'x' ? (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (L.dir > 0 ? 0 : Math.PI);
  const x = L.axis === 'x' ? wx(p) : wx(L.c), z = L.axis === 'x' ? wz(L.c) : wz(p);
  const g = sprite(name, x, z, rot);
  const car = { g, lane, L, p, v: speed, vmax: speed, name, special, off: 0, len: sprInfo[name].l };
  cars.push(car); return car;
}
let carTimers = { E: 1, Wb: 2, N: 0.5, Sb: 3 }, busTimer = 6;
function updateCars(dt) {
  for (const k in carTimers) if ((carTimers[k] -= dt) <= 0) { carTimers[k] = 3.5 + Math.random() * 4; if (!cars.some((c) => c.lane === k && Math.abs(c.p - LANES[k].from) < 4)) spawnCar(k, CAR_NAMES[(Math.random() * CAR_NAMES.length) | 0]); }
  if ((busTimer -= dt) <= 0) { busTimer = 45; if (!cars.some((c) => c.name === 'bus')) spawnCar('Wb', 'bus', { speed: 7, special: 'bus' }); }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i], L = c.L, half = c.len / T / 2;
    const front = c.p + L.dir * half;
    let target = c.vmax;
    const emergency = c.special === 'fire' || c.special === 'amb';
    if (!emergency) {
      for (const [id, line] of L.stops) {                         // 신호 정지
        const cw = CW.find((q) => q.id === id), st = sigState(cw);
        const ahead = (line - front) * L.dir;
        if (st.car !== 'green' && ahead > -0.2 && ahead < 6) target = Math.min(target, ahead < 0.15 ? 0 : ahead * 3);
        // 횡단보도 위에 사람이 있으면 양보
        if (ahead > -0.2 && ahead < 5 && onCrosswalk(player.tx, player.ty) === cw) target = 0;
      }
      if (c.special === 'bus' && !c.served && L.axis === 'x') {   // 정류장에 선다
        const ahead = (78.5 - front) * L.dir;
        if (ahead > -0.2 && ahead < 8) { target = Math.min(target, ahead < 0.15 ? 0 : ahead * 1.5); if (ahead < 0.2) { c.wait = (c.wait || 0) + dt; if (c.wait > (c.holdFor || 5)) c.served = true; } }
      }
      // 긴급차가 같은 차선 뒤에 오면 가장자리로 비켜 선다
      const em = cars.find((o) => (o.special === 'fire' || o.special === 'amb') && o.lane === c.lane && (c.p - o.p) * L.dir > 0 && (c.p - o.p) * L.dir < 9);
      c.off = lerp(c.off, em ? 0.55 : 0, Math.min(1, dt * 3)); if (em) target = Math.min(target, 2);
    }
    if (c.stopAt !== undefined) { const ahead = (c.stopAt - front) * L.dir; target = Math.min(target, ahead < 0.15 ? 0 : ahead * 2); if (ahead < 0.15) c.arrived = true; }
    for (const o of cars) if (o !== c && o.lane === c.lane && o.off < 0.3 && !(emergency && o.off > 0.2)) {
      const gap = (o.p - c.p) * L.dir - (o.len + c.len) / T / 2; if (gap > -0.5 && gap < 3) target = Math.min(target, Math.max(0, (gap - 0.6) * 4));
    }
    // 사람이 차 바로 앞 찻길에 있으면 급정거
    if (isRoad(tile(player.tx, player.ty)) || onCrosswalk(player.tx, player.ty)) {
      const along = L.axis === 'x' ? player.tx : player.ty, across = L.axis === 'x' ? player.ty : player.tx;
      const ahead = (along - front) * L.dir; if (Math.abs(across - L.c) < 0.9 && ahead > 0 && ahead < 2.2) target = 0;
    }
    c.v = lerp(c.v, target, Math.min(1, dt * (target < c.v ? 5 : 1.6)));
    c.p += L.dir * c.v * dt / T;
    const side = (L.axis === 'x' ? 1 : -1) * L.dir * c.off;       // 오른쪽(길 가장자리)으로
    if (L.axis === 'x') c.g.position.set(wx(c.p), 0, wz(L.c + side)); else c.g.position.set(wx(L.c + side), 0, wz(c.p));
    if (c.special === 'fire' || c.special === 'amb') { c.siren = (c.siren || 0) - dt; if (c.siren <= 0 && !c.arrived) { c.siren = 0.9; beep(960, 0.4, 'triangle', 0.05); beep(720, 0.4, 'triangle', 0.05, 0.45); } }
    if ((c.p - L.to) * L.dir > 0) { scene.remove(c.g); cars.splice(i, 1); }
  }
}
const onCrosswalk = (x, y) => cwAt(x, y);

// ================= 사람들 (지나다니는 동네 사람) =================
const walkers = [];
function addWalker(name, path, speed = 1.6) {
  const g = sprite(name + '_0', wx(path[0][0]), wz(path[0][1]));
  walkers.push({ g, name, path, i: 1, speed, t: 0 });
}
function updateWalkers(dt) {
  for (const w of walkers) {
    const [x, y] = w.path[w.i], gx = wx(x), gz = wz(y), d = Math.hypot(gx - w.g.position.x, gz - w.g.position.z);
    if (d < 0.2) { w.i = (w.i + 1) % w.path.length; continue; }
    if (w.wait > 0) { w.wait -= dt; continue; }
    w.g.position.x += (gx - w.g.position.x) / d * w.speed * dt; w.g.position.z += (gz - w.g.position.z) / d * w.speed * dt;
    w.g.rotation.y = Math.atan2(gx - w.g.position.x, gz - w.g.position.z);
    w.t += dt; setSprite(w.g, w.name + '_' + (Math.floor(w.t * 4) % 2));
  }
}

// ================= 플레이어 =================
const player = { room: null, g: null, tx: 46.5, ty: 63.5, face: Math.PI, crouch: false, walk: 0, frozen: 0, ride: false, helmet: false, safe: [46.5, 63.5], crossedOn: null };
const START = [46.5, 63.2];
function blockedAt(x, y) {
  if (player.room) {
    const R = ROOMS[player.room]; if (x < R.ox + 0.35 || x > R.ox + R.w - 0.35 || y < R.oy + 0.7 || y > R.oy + R.h - 0.25) return true;
    const px = wx(x), pz = wz(y); for (const c of colliders) if ((px - c.x) ** 2 + (pz - c.z) ** 2 < (c.r + 0.35) ** 2) return true; return false;
  }
  if (x < 0.3 || y < 0.3 || x > W - 0.3 || y > H - 0.3) return true;
  const r = 0.16;
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const X = (x + dx) | 0, Y = (y + dy) | 0; if (blocks[Y * W + X] || extraSolid.has(X + ',' + Y)) return true; }
  const px = wx(x), pz = wz(y);
  for (const c of colliders) if ((px - c.x) ** 2 + (pz - c.z) ** 2 < (c.r + 0.35) ** 2) return true;
  for (const c of cars) if (c.arrived || c.special === 'bus' || c.v < 0.5) { const p = c.g.position, i = sprInfo[c.name]; const hor = Math.abs(Math.sin(c.g.rotation.y)) > 0.5; const hw = (hor ? i.l : i.w) / 2 + 0.3, hl = (hor ? i.w : i.l) / 2 + 0.3; if (Math.abs(px - p.x) < hw && Math.abs(pz - p.z) < hl) return true; }
  return false;
}
function updatePlayer(dt) {
  player.crouch = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC') || touch.crouch;
  let mx = 0, mz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  mx += touch.x; mz += touch.y;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  if (player.frozen > 0 || UI.dialog || !S.started || player.auto) { player.frozen -= dt; mx = mz = 0; }
  let vmax = player.ride ? (player.crouch ? 2.5 : 10) : (player.crouch ? 3 : 6.5);
  const v = Math.min(1, Math.hypot(mx, mz)) * vmax;
  player.speed = v;
  if (player.auto) {                                           // 미끄럼틀처럼 정해진 길로 움직일 때
    const a = player.auto; a.t += dt / a.dur; const k = Math.min(1, a.t);
    player.tx = lerp(a.x0, a.x1, k); player.ty = lerp(a.y0, a.y1, k); player.lift = a.lift ? a.lift * (1 - k) : 0;
    if (k >= 1) { player.auto = null; player.lift = 0; a.done && a.done(); }
  } else if (v > 0.05) {
    player.face = Math.atan2(mx, mz);
    const step = v * dt / T, dx = Math.sin(player.face) * step, dy = Math.cos(player.face) * step;
    const bx = blockedAt(player.tx + dx, player.ty), by = blockedAt(player.tx, player.ty + dy);
    if (!bx) player.tx += dx;
    if (!by) player.ty += dy;
    if ((by && Math.abs(dy) >= Math.abs(dx)) || (bx && Math.abs(dx) > Math.abs(dy))) bumpBuilding(dt); else bump.t = 0;
    player.walk += v * dt;
  }
  const g = player.g; g.position.set(wx(player.tx), player.lift || 0, wz(player.ty));
  let dr = player.face - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 14);
  const base = player.helmet ? 'kid_helmet' : 'kid';
  setSprite(g, player.crouch && !player.ride ? 'kid_duck' : base + '_' + (v > 0.05 && !player.ride ? Math.floor(player.walk * 1.4) % 2 : 0));
  g.userData.mesh.scale.y = player.crouch && !player.ride ? 0.72 : 1;
  board.visible = player.ride; board.position.copy(g.position); board.rotation.y = g.rotation.y;
  if (!isRoad(tile(player.tx, player.ty)) && !onCrosswalk(player.tx, player.ty)) player.safe = [player.tx, player.ty];
}
let board;

// ================= 길 건너기 규칙 (언제나 적용) =================
function roadRules() {
  if (player.frozen > 0 || player.auto || player.room) return;
  const c = tile(player.tx, player.ty), cw = onCrosswalk(player.tx, player.ty);
  if (cw) {
    const st = sigState(cw);
    if (player.crossedOn !== cw) {
      if (!st.pedGreen) return violation('🛑 <b>빨간불</b>이에요! 초록불이 켜질 때까지 인도에서 기다려요.');
      if (st.blink) return violation('⚠️ 초록불이 <b>깜빡이면</b> 새로 건너지 말고 다음 신호를 기다려요.');
      if (player.ride) return violation('🛴 횡단보도에서는 킥보드에서 <b>내려서 끌고</b> 건너요!');
      player.crossedOn = cw;
    }
  } else if (isRoad(c)) {
    const bus = cars.find((k) => k.name === 'bus' && Math.hypot(k.g.position.x - wx(player.tx), k.g.position.z - wz(player.ty)) < 14);
    return violation(bus ? '🚌 버스 <b>앞뒤로</b> 건너면 마주 오는 차가 나를 못 봐요!<br>버스가 떠난 뒤 <b>횡단보도</b>로 건너요.' : '🙅 찻길을 함부로 건너면 위험해요! <b>횡단보도</b>로 건너요.');
  } else player.crossedOn = null;
  // 차에 부딪힐 뻔
  for (const k of cars) { const p = k.g.position, i = sprInfo[k.name]; const hor = Math.abs(Math.sin(k.g.rotation.y)) > 0.5;
    if (k.v > 1.2 && Math.abs(wx(player.tx) - p.x) < (hor ? i.l : i.w) / 2 + 0.2 && Math.abs(wz(player.ty) - p.z) < (hor ? i.w : i.l) / 2 + 0.2) return violation('🚗 앗, 차에 부딪힐 뻔했어요! 좌우를 잘 살펴요.'); }
}
function violation(msg) {
  sfx.whistle(); say(msg, 'warn', 3.6); mistake();
  player.tx = player.safe[0]; player.ty = player.safe[1]; player.frozen = 0.8; player.crossedOn = null;
}

// ================= 소리 =================
let ac = null; const muted = Q.has('mute');
function beep(freq = 660, dur = 0.12, type = 'sine', vol = 0.12, when = 0) {
  if (muted) return; try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* 소리 실패는 무시 */ }
}
const sfx = {
  good: () => { beep(660, 0.12, 'triangle'); beep(880, 0.12, 'triangle', 0.12, 0.1); beep(1320, 0.25, 'triangle', 0.12, 0.2); },
  bad: () => { beep(220, 0.25, 'square', 0.06); beep(180, 0.3, 'square', 0.06, 0.15); },
  whistle: () => { beep(2400, 0.18, 'sine', 0.08); beep(2400, 0.3, 'sine', 0.08, 0.22); },
  tick: () => beep(1200, 0.04, 'square', 0.025), talk: () => beep(520, 0.05, 'triangle', 0.05),
  alarm: () => { beep(950, 0.22, 'sawtooth', 0.04); beep(700, 0.22, 'sawtooth', 0.04, 0.24); },
  rumble: () => beep(55, 0.5, 'sawtooth', 0.08), pick: () => { beep(880, 0.08, 'square', 0.05); beep(1320, 0.12, 'square', 0.05, 0.08); },
};

// ================= 화면 글 · 대화 =================
const UI = { dialog: null };
let bannerT = 0;
function say(text, kind = '', sec = 3.2) { const b = $('banner'); b.innerHTML = text; b.className = 'show ' + kind; bannerT = sec; }
const NAMES = { guard: '등굣길 지킴이 이모', student: '중학생 형', bro: '옆 반 친구 준호', keeper: '경비 아저씨', friend: '친구 서연', stranger: '모르는 아저씨', manager: '분식집 사장님', teacher: '담임 선생님', worker: '공사장 아저씨', kid3: '친구 하은', grandma: '지나가던 할머니', medic: '구급대원', mom: '엄마', officer: '경찰관' };
// script: [{who, say} | {who, ask, choices:[{t, ok, why}]}]
function talk(script, done) {
  let i = 0; UI.dialog = { script, done }; $('dialog').classList.remove('hidden');
  const step = () => {
    if (i >= script.length) { $('dialog').classList.add('hidden'); UI.dialog = null; player.frozen = 0.25; done && done(); return; }
    const s = script[i]; $('dname').textContent = NAMES[s.who] || s.who; drawFace(s.who);
    $('dtext').textContent = s.say || s.ask; $('dchoices').innerHTML = ''; sfx.talk();
    if (s.ask) {
      $('dnext').classList.add('hidden');
      const order = s.choices.map((c, k) => k).sort(() => (Q.has('auto') ? 0 : Math.random() - 0.5));
      for (const k of order) { const c = s.choices[k]; const b = document.createElement('button'); b.textContent = c.t; b.dataset.ok = c.ok ? 1 : 0;
        b.onclick = () => {
          if (c.ok) { b.classList.add('ok'); sfx.good(); $('dtext').textContent = '⭕ ' + (c.why || '맞아요!'); [...$('dchoices').children].forEach((x) => (x.disabled = true)); $('dnext').classList.remove('hidden'); i++; UI.next = step; }
          else { b.classList.add('bad'); b.disabled = true; sfx.bad(); mistake(); $('dtext').textContent = '❌ ' + (c.why || '다시 생각해 봐요.'); }
        };
        $('dchoices').appendChild(b); }
    } else { $('dnext').classList.remove('hidden'); i++; UI.next = step; }
  };
  UI.next = step; step();
}
$('dnext').addEventListener('click', () => UI.next && UI.next());
function drawFace(who) {
  const c = $('dface').getContext('2d'); c.clearRect(0, 0, 64, 64); c.imageSmoothingEnabled = false;
  const n = ({ clerk: 'manager', owner: 'mom' }[who] || who) + '_0'; const tex = sprMat[n]?.map?.image; const m = MAN[n]; if (!tex || !m) return;
  // 맨 위 몇 층(머리)을 겹쳐 그려 얼굴 아이콘을 만든다
  for (let z = Math.max(0, m.n - 9); z < m.n; z++) c.drawImage(tex, z * m.w, 0, m.w, m.l, 4, 4 + (m.n - z) * 2, 56, 50);
}

// ================= 미션 =================
const S = { started: false, active: null, mistakes: 0, done: {}, stars: {} };
function mistake() { if (S.active || S.pending) S.mistakes++; }
const npcs = {};
function npc(id, sprite_, x, y, face = 0) { const g = sprite(sprite_, wx(x), wz(y), face); npcs[id] = { g, x, y, sprite: sprite_ }; colliders.push({ x: g.position.x, z: g.position.z, r: 0.5, npc: id }); return g; }
const markers = {};
function marker(id, x, y, text) { const m = label(text, wx(x), 4.2, wz(y), { bg: '#ffd23f', scale: 0.75 }); markers[id] = m; return m; }

const M = [
  { id: 'cross', icon: '🚦', title: '등굣길 스쿨존 횡단보도', npc: ['guard', 'guard_0', 45.2, 39.6, Math.PI],
    talk: [{ who: 'guard', say: '안녕! 여기는 송명초 정문 앞 어린이 보호구역이야.\n차는 시속 30km 아래로 달려야 하지만, 그래도 조심해야 해.' },
      { who: 'guard', ask: '초록불이 켜졌어. 어떻게 건너면 될까?', choices: [
        { t: '초록불이니까 바로 뛰어서 건넌다', why: '초록불이어도 멈추지 않는 차가 있을 수 있어요. 뛰면 넘어지기도 쉬워요.' },
        { t: '멈춰서 좌우를 살피고, 손을 들고 걸어서 건넌다', ok: true, why: '맞아요! 서기 · 보기 · 걷기. 운전자 눈에 잘 띄게 손을 들어요.' },
        { t: '휴대폰으로 친구한테 문자 보내면서 건넌다', why: '걸으면서 휴대폰을 보면 다가오는 차를 못 봐요.' }] },
      { who: 'guard', say: '좋아! 신호를 보고 횡단보도로 건너서 정문(노란 고리)까지 가 보자.' }],
    start() { goal = [47, 31.8, 1.6]; }, update() { if (near(47, 31.8, 1.8)) finish(); } },
  { id: 'bus', icon: '🚌', title: '버스에서 내린 뒤', npc: ['student', 'student_0', 79.8, 33.2, Math.PI],
    talk: [{ who: 'student', say: '방금 버스에서 내렸어. 길 건너 아파트로 가야 하는데…' },
      { who: 'student', ask: '버스가 아직 서 있어. 어디로 건너는 게 안전할까?', choices: [
        { t: '버스 바로 앞으로 빨리 건넌다', why: '버스에 가려서 마주 오는 차가 나를 못 봐요. 가장 위험한 길이에요!' },
        { t: '버스 뒤로 돌아서 건넌다', why: '버스 뒤도 똑같이 가려져요. 뒤따라오던 차가 갑자기 나타날 수 있어요.' },
        { t: '버스가 떠날 때까지 기다렸다가 횡단보도로 건넌다', ok: true, why: '맞아요! 버스가 떠나고 시야가 트인 뒤, 가까운 횡단보도로 건너요.' }] },
      { who: 'student', say: '고마워! 그럼 능허대중 앞 횡단보도로 건너서 길 건너편 고리까지 가 보자.' }],
    start() { const b = cars.find((c) => c.name === 'bus'); if (!b) { const nb = spawnCar('Wb', 'bus', { at: 82, speed: 0, special: 'bus' }); nb.holdFor = 12; nb.vmax = 7; } goal = [76, 39.6, 1.6]; },
    update() { if (player.ty > 38.4 && player.tx > 66 && player.tx < 84 && near(76, 39.6, 3)) finish(); } },
  { id: 'kick', icon: '🛴', title: '킥보드는 안전하게', npc: ['bro', 'bro_0', 40.5, 39.6, Math.PI / 2],
    talk: [{ who: 'bro', say: '내 킥보드 빌려줄게! 근린공원 놀이터까지 타고 가 볼래?' },
      { who: 'bro', ask: '킥보드를 타기 전에 꼭 해야 할 일은?', choices: [
        { t: '안전모(헬멧)를 쓰고 턱끈을 맨다', ok: true, why: '맞아요! 넘어질 때 머리를 지켜 줘요. 무릎·팔꿈치 보호대도 좋아요.' },
        { t: '모자를 쓰면 괜찮다', why: '모자는 머리를 지켜 주지 못해요. 꼭 안전모를 써요.' },
        { t: '빨리 가려면 아무것도 안 쓴다', why: '킥보드 사고는 머리를 다치는 일이 많아요.' }] },
      { who: 'bro', say: '저기 초록 헬멧을 써! 사람 옆을 지날 때는 Shift(브레이크)로 천천히 가야 해.' }],
    start() { items.helmet = sprite('helmet', wx(41.6), wz(40.5)); goal = [41.6, 40.5, 1.0]; spawnWalkerFor('grandma', [[52, 38.7], [44, 38.7]], 1.1); spawnWalkerFor('mom', [[60, 39.4], [50, 39.4]], 1.3); },
    update() {
      if (items.helmet && near(41.6, 40.5, 1.2)) { scene.remove(items.helmet); items.helmet = null; player.helmet = true; player.ride = true; sfx.pick(); say('헬멧 착용! 킥보드 출발 🛴 사람 옆에서는 <b>Shift</b>로 천천히!', 'good', 3); goal = [63.5, 41.2, 1.6]; }
      if (player.ride) for (const w of missionWalkers) if (Math.hypot(w.g.position.x - wx(player.tx), w.g.position.z - wz(player.ty)) < 2.0 && player.speed > 4) { sfx.bad(); mistake(); say('😵 사람 옆을 빠르게 지나면 부딪칠 수 있어요!<br>사람 옆에서는 <b>천천히</b> (Shift).', 'warn', 3); player.frozen = 0.8; player.tx -= Math.sin(player.face) * 0.5; player.ty -= Math.cos(player.face) * 0.5; }
      if (player.ride && near(63.5, 41.2, 1.8)) { player.ride = false; finish(); } } },
  { id: 'park', icon: '🚗', title: '지하주차장 출입구', npc: ['keeper', 'keeper_0', 15.0, 61, Math.PI / 2],
    talk: [{ who: 'keeper', say: '여기는 아파트 지하주차장 출입구야. 차가 경사로에서 갑자기 올라와.\n운전석에서는 키 작은 어린이가 잘 안 보인단다.' },
      { who: 'keeper', ask: '출입구 앞을 지나갈 때 어떻게 할까?', choices: [
        { t: '노란 선에서 멈추고, 볼록거울과 좌우를 살핀 뒤 지나간다', ok: true, why: '맞아요! 볼록거울로 안 보이는 곳의 차를 확인할 수 있어요.' },
        { t: '차가 알아서 멈출 테니 그냥 뛰어간다', why: '운전자는 사각지대에 있는 어린이를 못 볼 수 있어요.' },
        { t: '이어폰을 끼고 음악을 들으며 걷는다', why: '차 소리를 못 들으면 위험을 알아채기 어려워요.' }] },
      { who: 'keeper', say: '노란 정지선에서 멈췄다가, 차가 지나간 뒤 북쪽 고리까지 가 보렴.' }],
    start() { goal = [16.5, 52.5, 1.5]; parkCarT = 1.5; }, update(dt) { updateParkingCar(dt); if (player.ty < 53.3 && near(16.5, 52.5, 2.5)) finish(); } },
  { id: 'play', icon: '🛝', title: '놀이터 안전', npc: ['friend', 'friend_0', 68.6, 49.6, Math.PI],
    talk: [{ who: 'friend', say: '같이 놀자! 미끄럼틀 타고 시소 있는 데서 만나!' },
      { who: 'friend', ask: '미끄럼틀은 어떻게 타야 할까?', choices: [
        { t: '미끄럼판으로 거꾸로 올라간다', why: '내려오는 친구와 부딪쳐요. 꼭 계단으로 올라가요.' },
        { t: '계단으로 올라가서 앉아서 발부터 내려온다', ok: true, why: '맞아요! 앞사람이 다 내려간 뒤 차례로 타요.' },
        { t: '친구를 밀어서 먼저 탄다', why: '밀면 떨어져 크게 다칠 수 있어요. 차례를 지켜요.' }] },
      { who: 'friend', ask: '그네 타는 친구 앞뒤로 지나가도 될까?', choices: [
        { t: '빨리 뛰어서 지나가면 괜찮다', why: '움직이는 그네에 부딪치면 크게 다쳐요.' },
        { t: '그네에서 멀리 떨어져 돌아서 간다', ok: true, why: '맞아요! 그네 앞뒤는 위험한 곳이에요.' }] },
      { who: 'friend', say: '미끄럼틀 계단(노란 고리)으로 가 봐!' }],
    start() { goal = [66, 42.9, 0.9]; playStage = 0; swingOn = true; },
    update() {
      if (playStage === 0 && near(66, 42.9, 1.0)) { playStage = 1; player.face = 0; player.auto = { x0: 66, y0: 43.3, x1: 66, y1: 45.9, t: 0, dur: 1.4, lift: 2.2, done: () => { playStage = 2; goal = [70.5, 49.2, 1.2]; say('슝~ 🛝 이제 <b>그네를 피해서</b> 시소 옆 친구에게 가요!', 'good', 3); } }; sfx.pick(); }
      if (playStage === 2 && swingDanger()) { sfx.bad(); mistake(); say('💥 그네 앞뒤로 지나가면 부딪쳐요! 멀리 돌아가요.', 'warn', 3); player.tx = 66.5; player.ty = 47.2; player.frozen = 0.6; }
      if (playStage === 2 && near(70.5, 49.2, 1.4)) finish(); } },
  { id: 'stranger', icon: '🙅', title: '모르는 사람의 부탁', npc: ['stranger', 'stranger_0', 25.6, 31.2, -Math.PI / 2],
    talk: [{ who: 'stranger', say: '얘, 아저씨 강아지가 없어졌는데 같이 좀 찾아 줄래?\n저기 차 안에 강아지 사진이 있어.' },
      { who: 'stranger', ask: '어떻게 할까?', choices: [
        { t: '불쌍하니까 따라가서 차 안 사진을 본다', why: '모르는 사람의 차에는 절대 가까이 가지 않아요.' },
        { t: '"싫어요! 안 돼요!" 크게 말하고 그 자리를 떠난다', ok: true, why: '맞아요! 어른은 어린이에게 도움을 부탁하지 않아요. 크게 거절하고 피해요.' },
        { t: '이름이랑 집 주소를 알려 준다', why: '개인정보는 모르는 사람에게 알려 주면 안 돼요.' }] },
      { who: 'stranger', say: '…어, 그래? 잠깐만 기다려 봐.' }],
    start() { goal = [12.4, 34.6, 1.3]; strangerFollow = 9; say('📢 가까운 <b>아동안전지킴이집(편의점)</b>으로 가서 도움을 요청해요! 횡단보도로 건너요.', 'warn', 4.5); },
    update(dt) { if (strangerFollow > 0) { strangerFollow -= dt; const n = npcs.stranger.g, dx = wx(player.tx) - n.position.x, dz = wz(player.ty) - n.position.z, d = Math.hypot(dx, dz); if (d > 3 && !isRoad(tile(tx(n.position.x + dx / d), ty(n.position.z + dz / d)))) { n.position.x += dx / d * 2.4 * dt; n.position.z += dz / d * 2.4 * dt; n.rotation.y = Math.atan2(dx, dz); } }
      if (near(12.4, 34.6, 1.6)) finish(); } },
  { id: 'fire', icon: '🔥', title: '상가 화재 대피', npc: ['manager', 'manager_0', 16.6, 15.2, Math.PI / 2],
    talk: [{ who: 'manager', say: '큰일이야! 분식집 주방에서 불이 났어! 연기가 퍼지고 있어!' },
      { who: 'manager', ask: '불이 났을 때 가장 먼저 할 일은?', choices: [
        { t: '"불이야!" 크게 외치고, 코와 입을 막고 몸을 낮춰 대피한다', ok: true, why: '맞아요! 연기는 위로 올라가요. 젖은 수건이나 옷소매로 코와 입을 막아요.' },
        { t: '내 가방부터 챙기러 안으로 들어간다', why: '물건은 다시 살 수 있어요. 무조건 먼저 대피해요.' },
        { t: '불이 꺼지는지 가까이 가서 구경한다', why: '연기를 마시면 몇 번 숨만 쉬어도 쓰러질 수 있어요.' }] },
      { who: 'manager', say: '119에는 내가 신고했어! 연기 속에서는 Shift로 몸을 낮추고,\n남서쪽 편의점 옆 안전 집결지(초록 깃발)로 대피해!' }],
    start() { goal = [4.5, 34.3, 2.0]; fireOn = true; smokeLevel = 0; $('meter').classList.remove('hidden'); $('meter-label').textContent = '연기 마심';
      const f = spawnCar('N', 'firetruck', { at: 71, speed: 12, special: 'fire' }); f.stopAt = 16.5; },
    update(dt) { const inSmoke = player.tx > 8 && player.tx < 18 && player.ty > 7 && player.ty < 23;
      if (inSmoke && !player.crouch) { smokeLevel += dt * 20; if ((smokeCough -= dt) <= 0) { smokeCough = 1.4; say('😷 콜록! 연기는 위로 올라가요. <b>Shift</b>로 몸을 낮춰요!', 'warn', 1.5); } } else smokeLevel = Math.max(0, smokeLevel - dt * 8);
      $('meter-fill').style.width = Math.min(100, smokeLevel) + '%';
      if (smokeLevel >= 100) { sfx.bad(); mistake(); smokeLevel = 0; say('연기를 너무 많이 마셨어요! 다시, <b>낮은 자세</b>로!', 'warn', 3); player.tx = 16.6; player.ty = 16.5; player.frozen = 0.8; }
      if (near(4.5, 34.3, 2.4)) { fireOn = false; $('meter').classList.add('hidden'); finish(); } } },
  { id: 'quake', icon: '🌏', title: '학교 지진 대피', npc: ['teacher', 'teacher_0', 45.4, 22.4, Math.PI],
    talk: [{ who: 'teacher', say: '오늘은 운동장에서 지진 대피 훈련을 할 거예요.' },
      { who: 'teacher', ask: '운동장에서 놀다가 땅이 흔들리면?', choices: [
        { t: '교실로 뛰어 들어가서 숨는다', why: '흔들릴 때 건물로 뛰어가면 떨어지는 유리나 물건에 다칠 수 있어요.' },
        { t: '가방이나 팔로 머리를 감싸고, 건물에서 떨어진 넓은 가운데로 간다', ok: true, why: '맞아요! 건물 가까이는 유리·간판이 떨어질 수 있어요.' },
        { t: '담장 옆에 붙어 선다', why: '담장은 무너질 수 있어요. 넓은 곳으로 가요.' }] },
      { who: 'teacher', say: '자, 곧 흔들려요! 흔들리면 Shift로 머리를 감싸고 운동장 가운데 고리로!' }],
    start() { quake = { t: 0, phase: 'pre', hide: 0 }; goal = [48, 26.5, 2.0]; },
    update(dt) { quake.t += dt;
      if (quake.phase === 'pre' && quake.t > 2) { quake.phase = 'shake'; quake.t = 0; sfx.rumble(); say('🌏 흔들려요! <b>Shift</b>로 머리를 감싸고 운동장 가운데로!', 'warn', 4); }
      if (quake.phase === 'shake') {
        if (Math.random() < dt * 3) sfx.rumble();
        if (Math.random() < dt * 6) dropRubble();
        if (player.crouch) quake.hide += dt;
        if (player.ty < 23.2 && player.tx > 40 && player.tx < 54 && player.frozen <= 0) { sfx.bad(); mistake(); say('💥 건물 가까이는 유리와 물건이 떨어져요! 넓은 곳으로!', 'warn', 3); player.ty = 24.5; player.frozen = 0.6; }
        if (quake.t > 9) { quake.phase = 'after'; say('흔들림이 멈췄어요. 가운데 고리에 모여요!', 'good', 3); }
      }
      if (quake.phase === 'after' && near(48, 26.5, 2.4)) { if (quake.hide < 2) { mistake(); say('다음엔 흔들릴 때 <b>머리를 꼭 감싸요</b>!', 'warn', 3); } finish(); } } },
  { id: 'site', icon: '🚧', title: '공사장 옆 지나가기', npc: ['worker', 'worker_0', 22.6, 38.9, Math.PI],
    talk: [{ who: 'worker', say: '여기는 아파트 보수공사 중이야. 위에서 공구나 자재가 떨어질 수 있어.' },
      { who: 'worker', ask: '남쪽 길로 가려면 어떻게 할까?', choices: [
        { t: '공사장 가운데 틈으로 지나가면 빠르다', why: '공사장 안은 떨어지는 물건, 움직이는 굴착기 때문에 아주 위험해요.' },
        { t: '울타리 바깥 인도로 돌아서 간다', ok: true, why: '맞아요! 조금 멀어도 공사장은 꼭 돌아가요.' }] },
      { who: 'worker', say: '착하구나! 울타리 바깥으로 돌아서 남쪽 고리까지 가 보렴.' }],
    start() { goal = [25.8, 46.4, 1.4]; },
    update() { if (player.tx >= SITE.x0 && player.tx < SITE.x1 + 1 && player.ty >= SITE.y0 + 0.2 && player.ty < SITE.y1 + 0.8 && player.frozen <= 0) { sfx.bad(); mistake(); dropRubbleAt(player.tx, player.ty); say('💥 위에서 자재가 떨어졌어요! 공사장 안으로는 들어가지 않아요.', 'warn', 3.4); player.tx = 22.6; player.ty = 39.6; player.frozen = 0.8; }
      if (near(25.8, 46.4, 1.6)) finish(); } },
  { id: 'aid', icon: '🚑', title: '친구가 쓰러졌어요', npc: ['kid3', 'friend_down', 60.6, 45.4, 0],
    talk: [{ who: 'grandma', say: '어머나, 이 친구가 갑자기 쓰러졌어! 숨은 쉬는데 대답을 안 하네.' },
      { who: 'grandma', ask: '가장 먼저 무엇을 할까?', choices: [
        { t: '"도와주세요!" 주변 어른을 부르고 119에 신고한다', ok: true, why: '맞아요! 혼자 해결하려 하지 말고 어른과 119에 바로 알려요.' },
        { t: '물을 억지로 먹인다', why: '정신이 없는 사람에게 물을 먹이면 숨이 막힐 수 있어요.' },
        { t: '무서우니까 집으로 간다', why: '친구를 도울 수 있는 사람은 바로 나예요. 어른을 불러요.' }] },
      { who: 'grandma', ask: '119에 전화했어. 무엇을 말해야 할까?', choices: [
        { t: '"빨리 와 주세요!"만 말하고 끊는다', why: '어디인지 알려 주지 않으면 구급차가 찾아올 수 없어요.' },
        { t: '있는 곳(근린공원 놀이터 옆), 무슨 일인지, 친구 상태를 말한다', ok: true, why: '맞아요! 주변 큰 건물이나 길 이름을 말하면 더 빨리 와요.' }] },
      { who: 'grandma', ask: '전화는 언제 끊을까?', choices: [
        { t: '119 상담원이 끊으라고 할 때까지 끊지 않는다', ok: true, why: '맞아요! 상담원이 도착할 때까지 할 일을 알려 줘요.' },
        { t: '말을 다 했으면 바로 끊는다', why: '상담원이 더 물어보거나 응급처치를 알려 줄 수 있어요.' }] },
      { who: 'grandma', say: '구급차가 교육로로 오고 있어! 길가(노란 고리)에 서서\nSpace로 손을 흔들어 위치를 알려 줘!' }],
    start() { goal = [60.5, 38.8, 1.4]; amb = spawnCar('E', 'ambulance', { at: 23, speed: 12, special: 'amb' }); amb.stopAt = 66; waved = false; },
    update() { if (near(60.5, 38.8, 1.6) && pressed.has('Space') && !waved) { waved = true; amb.stopAt = 62.2; amb.arrived = false; say('🙋 손을 흔들었어요! 구급차가 여기 선대요.', 'good', 3); }
      if (waved && amb.arrived && !medic) { medic = sprite('medic_0', wx(61), wz(39.6)); medic.userData.t = 0; }
      if (medic) { medic.userData.t += 1 / 60; const k = Math.min(1, medic.userData.t / 2.5); medic.position.set(wx(lerp(61, 60.6, k)), 0, wz(lerp(39.6, 44.4, k))); setSprite(medic, 'medic_' + (Math.floor(medic.userData.t * 4) % 2)); if (k >= 1) { finish(); } } } },
];
let goal = null, items = {}, missionWalkers = [], parkCarT = 0, parkCar = null, playStage = 0, swingOn = false, strangerFollow = 0, fireOn = false, smokeLevel = 0, smokeCough = 0, quake = null, amb = null, waved = false, medic = null;
const near = (x, y, r) => Math.hypot(player.tx - x, player.ty - y) < r;
function spawnWalkerFor(name, path, speed) { const before = walkers.length; addWalker(name, path, speed); missionWalkers.push(walkers[before]); }
function startMission(m) {
  if (S.active || S.pending) return;
  S.pending = true; S.mistakes = 0;
  talk(m.talk, () => { S.pending = false; S.active = m; m.start(); renderList(); say(`${m.icon} <b>${m.title}</b> 미션 시작!`, '', 2.4); });
}
function finish() {
  const m = S.active; if (!m) return;
  const stars = Math.max(1, 3 - S.mistakes);
  S.done[m.id] = true; S.stars[m.id] = Math.max(S.stars[m.id] || 0, stars); S.active = null; S.mistakes = 0; goal = null;
  if (markers[m.id]) markers[m.id].visible = false;
  sfx.good(); say(`🎉 <b>${m.title}</b> 완료! ${'⭐'.repeat(stars)}`, 'good', 3.5); renderList();
  // 출동했던 긴급차는 할 일을 마치면 떠난다
  if (m.id === 'fire' || m.id === 'aid') setTimeout(() => cars.forEach((c) => { if (c.special === (m.id === 'fire' ? 'fire' : 'amb')) { c.stopAt = undefined; c.arrived = false; c.vmax = 8; } if (m.id === 'aid' && medic) { scene.remove(medic); } }), 3000);
  if (Object.keys(S.done).length === M.length) setTimeout(showCert, 2200);
}
function renderList() {
  $('mlist').innerHTML = M.map((m) => `<div class="mi ${S.done[m.id] ? 'done' : ''} ${S.active === m ? 'active' : ''}"><span class="ic">${m.icon}</span>${m.title} <span class="st">${S.stars[m.id] ? '⭐'.repeat(S.stars[m.id]) : ''}</span></div>`).join('');
  $('done-count').textContent = Object.keys(S.done).length; $('star-total').textContent = '⭐' + Object.values(S.stars).reduce((a, b) => a + b, 0) + (badges.size ? ' 🏅' + badges.size : '');
}
$('actbtn').addEventListener('click', (e) => { e.stopPropagation(); clickAct = true; });
$('panel-toggle').addEventListener('click', () => $('panel').classList.toggle('collapsed'));
function showCert() {
  $('cert-name').textContent = ($('name').value || '').trim() || '탐험대원';
  const tot = Object.values(S.stars).reduce((a, b) => a + b, 0); $('cert-stars').textContent = `모은 별 ⭐ ${tot} / 30`;
  const d = new Date(); $('cert-date').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 · 송명 안전 탐험대`;
  $('cert').classList.remove('hidden'); sfx.good();
}
$('again').addEventListener('click', () => $('cert').classList.add('hidden'));

// ---- 미션 도우미 ----
function updateParkingCar(dt) {
  if (!parkCar && (parkCarT -= dt) <= 0) { parkCar = sprite('car_black', wx(5), wz(58.5), Math.PI / 2); parkCar.userData.v = 7; beep(400, 0.3, 'square', 0.03); }
  if (parkCar) {
    parkCar.position.x += parkCar.userData.v * dt;
    const ptx = tx(parkCar.position.x);
    if (Math.abs(ptx - player.tx) < 1.6 && Math.abs(58.5 - player.ty) < 0.9 && player.frozen <= 0) { sfx.bad(); mistake(); say('🚗 사각지대에서 차가 나왔어요! <b>노란 선</b>에서 멈추고<br>볼록거울로 확인한 뒤 지나가요.', 'warn', 3.5); player.tx = 16.5; player.ty = 60.6; player.frozen = 0.8; }
    if (ptx > 18.5) { scene.remove(parkCar); parkCar = null; parkCarT = 4 + Math.random() * 2; }
  }
}
function swingDanger() { return swingOn && player.tx > 68.6 && player.tx < 72.1 && player.ty > 42.2 && player.ty < 44.9; }
const rubbles = [];
function dropRubble() { const x = 41 + Math.random() * 12, y = 20.6 + Math.random() * 2.3; dropRubbleAt(x, y); }
function dropRubbleAt(x, y) { const r = sprite('rubble', wx(x), wz(y), Math.random() * 6, { shadow: false }); r.position.y = 8; rubbles.push({ g: r, v: 0, life: 6 }); }
function updateRubble(dt) { for (let i = rubbles.length - 1; i >= 0; i--) { const r = rubbles[i]; if (r.g.position.y > 0) { r.v += 30 * dt; r.g.position.y = Math.max(0, r.g.position.y - r.v * dt); } if ((r.life -= dt) <= 0) { scene.remove(r.g); rubbles.splice(i, 1); } } }

// ---- 연기 · 흔들림 · 그네 ----
const smokes = [];
function updateFx(dt, time) {
  if (fireOn && smokes.length < 70 && Math.random() < dt * 30) { const s = sprite('smoke', wx(15.2 + Math.random() * 2.4), wz(9 + Math.random() * 13), 0, { shadow: false }); s.position.y = 2.2 + Math.random(); s.userData = { ...s.userData, vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, life: 5 + Math.random() * 3 }; s.scale.setScalar(2); smokes.push(s); }
  for (let i = smokes.length - 1; i >= 0; i--) { const s = smokes[i], u = s.userData; s.position.x += u.vx * dt; s.position.z += u.vz * dt; s.position.y = Math.min(3.6, s.position.y + dt * 0.3); s.scale.setScalar(2 + (8 - u.life) * 0.3); if ((u.life -= dt) <= 0 || !fireOn && u.life > 1) { scene.remove(s); smokes.splice(i, 1); } }
  if (fireOn && Math.sin(time * 4) > 0.97) sfx.alarm();
  if (playground.swing) { const a = swingOn ? Math.sin(time * 3) * 0.35 : 0; playground.swing.userData.mesh.rotation.x = a * 0.2; }
  for (const id in markers) { const m = markers[id]; m.position.y = 4.2 + Math.sin(time * 3) * 0.25; }
}

// ================= 건물 안 (들어가 보기) =================
// 지도 바깥 먼 곳(타일 좌표 음수)에 방을 짓고, 문 앞에서 Space 를 누르면 순간이동한다.
const ROOMS = {
  class: { name: '🏫 송명초 3학년 2반 교실', ox: -150, oy: 0, w: 10, h: 7, floor: '#c8a27a', wall: '#f4efe4', door: [45.6, 21.6], npc: ['teacher', 'teacher_0', 2.6, 1.8],
    talk: [{ who: 'teacher', say: '어서 와요! 여기는 송명초 3학년 2반 교실이에요.\n칠판 옆 TV로 재난 안전 영상을 함께 봐요.' },
      { who: 'teacher', ask: '교실에서 수업 중에 지진이 나면?', choices: [
        { t: '책상 밑으로 들어가 책상 다리를 꼭 잡는다', ok: true, why: '맞아요! 흔들림이 멈추면 선생님 말씀에 따라 계단으로 운동장에 모여요.' },
        { t: '창문 쪽으로 가서 밖을 본다', why: '유리창이 깨져 다칠 수 있어요. 창문에서 멀리 떨어져요.' },
        { t: '바로 복도로 뛰어나간다', why: '흔들릴 때 뛰면 넘어지고 물건에 맞을 수 있어요.' }] }] },
  conv: { name: '🏪 편의점 (아동안전지킴이집)', ox: -150, oy: 20, w: 8, h: 6, floor: '#e8eef2', wall: '#ffffff', door: [10.5, 34.3], npc: ['clerk', 'manager_0', 6.3, 2.2],
    talk: [{ who: 'clerk', say: '어서 오렴! 문에 붙은 노란 "아동안전지킴이집" 스티커 봤니?\n무섭거나 위험할 때는 언제든 들어와서 도와 달라고 하렴.' },
      { who: 'clerk', ask: '모르는 사람이 계속 따라오면 어떻게 할까?', choices: [
        { t: '가까운 아동안전지킴이집·편의점에 들어가 도움을 요청하고 112에 신고한다', ok: true, why: '맞아요! 사람이 많은 곳으로 가서 어른에게 알려요.' },
        { t: '아무도 없는 골목으로 숨는다', why: '사람이 없는 곳은 더 위험해요.' },
        { t: '집까지 뛰어가서 혼자 문을 잠근다', why: '집 위치를 알려 줄 수 있어요. 가까운 어른에게 먼저 도움을 요청해요.' }] }] },
  snack: { name: '🍢 상가 분식집', ox: -150, oy: 40, w: 7, h: 5, floor: '#f2e6cf', wall: '#fff6e5', door: [15.9, 13.6], npc: ['owner', 'mom_0', 5.4, 1.6],
    talk: [{ who: 'owner', say: '어서 와~ 떡볶이 냄새 좋지? 우리 가게에는 소화기가 있어.\n소화기 쓰는 순서를 알아 두면 좋아.' },
      { who: 'owner', ask: '소화기는 어떤 순서로 쓸까?', choices: [
        { t: '안전핀 뽑기 → 호스를 불 쪽으로 → 손잡이 꽉 누르기', ok: true, why: '맞아요! 바람을 등지고 불의 아래쪽을 향해 빗자루 쓸듯이 뿌려요. 어린이는 먼저 어른에게 알리고 대피해요.' },
        { t: '손잡이 누르기 → 안전핀 뽑기 → 흔들기', why: '안전핀을 먼저 뽑아야 손잡이가 눌려요.' }] }] },
  pharm: { name: '💊 송명 약국', ox: -150, oy: 60, w: 8, h: 6, floor: '#eef2f0', wall: '#ffffff', door: [15.9, 9.4], npc: ['pharmacist', 'pharmacist_0', 4.6, 1.5],
    talk: [{ who: 'pharmacist', say: '어서 오렴. 약은 몸을 낫게 하지만, 잘못 먹으면 오히려 아플 수 있어.' },
      { who: 'pharmacist', ask: '감기약은 어떻게 먹어야 할까?', choices: [
        { t: '어른이 주는 약을 정해진 양·시간에 맞춰 먹는다', ok: true, why: '맞아요! 약 봉투에 적힌 양과 시간을 꼭 지켜요.' },
        { t: '빨리 낫고 싶으니 두 배로 먹는다', why: '많이 먹으면 위험해요. 정해진 양만 먹어요.' },
        { t: '친구가 먹던 약을 나눠 먹는다', why: '사람마다 맞는 약이 달라요. 남의 약은 먹지 않아요.' }] }],
    task: { mode: 'hunt', title: '혼자 먹으면 안 되는 것 찾기', items: [
      { spr: 'pill_bottle', x: 1.2, y: 3.6, sc: 1.4, name: '뚜껑 열린 알약', why: '알록달록해도 사탕이 아니라 약이에요! 만지지 말고 어른에게 알려요.' },
      { spr: 'syrup', x: 6.8, y: 4.4, sc: 1.4, name: '바닥의 물약', why: '주인 없는 물약은 절대 마시지 않아요. 어른에게 드려요.' },
      { spr: 'gummy_jar', x: 3.0, y: 4.6, sc: 1.4, name: '젤리 모양 영양제', why: '젤리처럼 생긴 영양제도 약이에요. 하루에 먹는 양이 정해져 있어요.' }] } },
  tkd: { name: '🥋 송명 태권도장', ox: -150, oy: 80, w: 9, h: 6, floor: '#3b6fd8', wall: '#fff8ec', door: [15.9, 19.0], npc: ['master', 'master_0', 4.5, 1.6],
    talk: [{ who: 'master', say: '태권! 운동하기 전에 다치지 않는 습관부터 배우자.' },
      { who: 'master', ask: '운동을 시작하기 전에 꼭 할 일은?', choices: [
        { t: '준비 운동으로 몸을 풀고, 물건은 정리한다', ok: true, why: '맞아요! 몸을 풀어야 근육과 관절이 다치지 않아요.' },
        { t: '바로 높이 뛰어 발차기를 한다', why: '몸이 굳어 있으면 다치기 쉬워요. 준비 운동부터!' },
        { t: '양말을 신은 채 미끄럼 놀이를 한다', why: '미끄러져 넘어질 수 있어요.' }] }],
    task: { mode: 'hunt', title: '도장에서 위험한 것 찾기', items: [
      { spr: 'puddle', x: 2.4, y: 3.8, sc: 1.4, name: '쏟은 물', why: '젖은 매트는 미끄러워요! 바로 닦아 달라고 말해요.' },
      { spr: 'shoe_loose', x: 6.6, y: 4.6, sc: 1.4, name: '끈 풀린 신발', why: '신발 끈이 풀리면 밟고 넘어져요. 꽉 묶어요.' },
      { spr: 'dumbbell', x: 7.6, y: 2.8, sc: 1.4, name: '바닥의 아령', why: '바닥에 굴러다니는 운동 기구는 발에 걸려요. 제자리에 정리해요.' }] } },
  apt: { name: '🏢 아파트 1층 엘리베이터 앞', ox: -150, oy: 100, w: 8, h: 6, floor: '#d9d6cf', wall: '#efe7d8', door: [30.5, 30.6], npc: ['keeper', 'keeper_0', 6.6, 2.6],
    talk: [{ who: 'keeper', say: '안녕! 엘리베이터는 편리하지만, 위급할 때는 조심해야 해.' },
      { who: 'keeper', ask: '엘리베이터가 갑자기 멈춰 갇혔다면?', choices: [
        { t: '비상벨(인터폰)을 누르고 침착하게 구조를 기다린다', ok: true, why: '맞아요! 관리실과 연결돼요. 문을 억지로 열지 말고 기다려요.' },
        { t: '문을 억지로 벌려서 나간다', why: '층 사이에 멈췄으면 떨어질 수 있어요. 아주 위험해요.' },
        { t: '안에서 쿵쿵 뛰어 본다', why: '뛰면 더 위험해요. 비상벨을 누르고 기다려요.' }] }],
    task: { mode: 'order', title: '불이 났을 때 대피 순서', intro: '🔥 위층에서 불이 났대요! 순서대로 눌러 대피해요.', items: [
      { spr: 'elev_panel', x: 1.7, y: 0.2, sc: 1.6, step: 1, name: '비상벨 누르기', why: '비상벨로 불이 난 것을 모두에게 알려요.' },
      { spr: 'stairs_door', x: 6.6, y: 0.2, sc: 1.6, step: 2, name: '비상계단으로 대피', why: '계단으로 낮은 자세로 내려가요. 밖으로 나가면 119에 신고!' },
      { spr: 'elevator', x: 3.6, y: 0.2, sc: 1.6, bad: true, name: '엘리베이터', why: '불이 나면 엘리베이터는 멈추거나 연기가 들어올 수 있어요. 꼭 계단으로!' }] } },
  sci: { name: '🔬 송명초 과학실', ox: -150, oy: 120, w: 10, h: 7, floor: '#d9dde2', wall: '#f4f6f8', door: [40.0, 16.5], npc: ['scientist', 'scientist_0', 8.4, 1.6],
    talk: [{ who: 'scientist', say: '과학실에 온 걸 환영해요! 실험은 재미있지만 안전 규칙이 먼저예요.' },
      { who: 'scientist', ask: '실험하다 유리 비커가 깨졌어요. 어떻게 할까요?', choices: [
        { t: '손대지 않고 바로 선생님께 알린다', ok: true, why: '맞아요! 깨진 유리는 선생님이 도구로 치워요.' },
        { t: '손으로 빨리 주워 쓰레기통에 버린다', why: '손을 베일 수 있어요. 만지지 말아요.' },
        { t: '모른 척하고 실험을 계속한다', why: '다른 친구가 다칠 수 있어요. 바로 알려요.' }] }],
    task: { mode: 'order', title: '실험 안전 순서', intro: '🧪 알코올램프 실험을 해요. 순서대로 눌러 봐요!', items: [
      { spr: 'goggles', x: 1.4, y: 2.6, sc: 1.5, step: 1, name: '보안경 쓰기', why: '눈을 보호하려고 보안경을 먼저 써요.' },
      { spr: 'lab_coat', x: 2.4, y: 6.2, sc: 1.5, step: 2, name: '실험복 입기', why: '옷에 약품이 튀지 않게 실험복을 입어요.' },
      { spr: 'alcohol_lamp', x: 5.0, y: 3.0, sc: 1.6, step: 3, name: '램프 뚜껑 덮어 끄기', why: '입으로 불지 말고 뚜껑을 비스듬히 덮어 꺼요.' },
      { spr: 'beaker', x: 7.0, y: 4.4, sc: 1.6, bad: true, name: '비커 냄새 맡기', why: '코를 대고 맡으면 위험해요! 손으로 살살 부채질해서 맡아요.' }] } },
  gym: { name: '🏀 송명초 체육관', ox: -150, oy: 140, w: 11, h: 7, floor: '#d8a86a', wall: '#f4efe4', door: [52.5, 17.3], npc: ['pe_teacher', 'pe_teacher_0', 9.4, 1.6],
    talk: [{ who: 'pe_teacher', say: '체육관에 왔구나! 신나게 뛰려면 안전 규칙부터 지키자.' },
      { who: 'pe_teacher', ask: '더운 날 운동하다 머리가 어지럽고 속이 메스꺼우면?', choices: [
        { t: '바로 멈추고 그늘에서 쉬며 물을 마시고 선생님께 알린다', ok: true, why: '맞아요! 열사병일 수 있어요. 시원한 곳에서 쉬어요.' },
        { t: '친구들한테 지기 싫어서 계속 뛴다', why: '참으면 쓰러질 수 있어요. 바로 멈춰요.' },
        { t: '혼자 화장실에 가서 참는다', why: '혼자 있다가 쓰러지면 위험해요. 꼭 어른에게 알려요.' }] }],
    task: { mode: 'hunt', title: '체육관에서 위험한 것 찾기', items: [
      { spr: 'ball_floor', x: 4.2, y: 4.6, sc: 2.4, name: '굴러다니는 공', why: '바닥의 공을 밟으면 발목을 다쳐요. 공 바구니에 넣어요.' },
      { spr: 'vault_box', x: 7.6, y: 4.2, sc: 1.5, name: '매트 없는 뜀틀', why: '뜀틀 뒤에는 꼭 매트를 깔고 선생님이 계실 때만 넘어요.' },
      { spr: 'puddle', x: 2.0, y: 2.8, sc: 1.4, name: '흘린 물', why: '젖은 바닥에서 뛰면 미끄러져요. 바로 닦아요.' }] } },
  nurse: { name: '🩹 송명초 보건실', ox: -150, oy: 160, w: 8, h: 6, floor: '#eef2f0', wall: '#ffffff', door: [42.2, 21.6], npc: ['nurse', 'nurse_0', 5.6, 1.6],
    talk: [{ who: 'nurse', say: '어디 다쳤니? 보건실은 아프거나 다쳤을 때 언제든 오는 곳이야.' },
      { who: 'nurse', ask: '갑자기 코피가 나면 어떻게 할까?', choices: [
        { t: '고개를 살짝 앞으로 숙이고 콧볼을 10분쯤 꾹 누른다', ok: true, why: '맞아요! 피가 목으로 넘어가지 않게 앞으로 숙여요.' },
        { t: '고개를 뒤로 젖히고 하늘을 본다', why: '피가 목으로 넘어가 토할 수 있어요. 앞으로 숙여요.' },
        { t: '휴지를 깊숙이 넣고 뛰어논다', why: '쉬면서 콧볼을 눌러 피를 멈춰요.' }] }],
    task: { mode: 'order', title: '무릎이 까졌을 때 순서', intro: '🩹 운동장에서 넘어져 무릎이 까졌어요! 순서대로 눌러요.', items: [
      { spr: 'sink', x: 0.6, y: 2.6, r: Math.PI / 2, sc: 1.5, step: 1, name: '흐르는 물로 씻기', why: '먼저 깨끗한 물로 흙과 모래를 씻어내요.' },
      { spr: 'first_aid_kit', x: 3.0, y: 3.2, sc: 1.6, step: 2, name: '소독하기', why: '소독약으로 세균을 없애요. 보건 선생님께 도움을 받아요.' },
      { spr: 'bandage', x: 4.4, y: 3.4, sc: 1.8, step: 3, name: '밴드 붙이기', why: '밴드로 상처를 덮어 보호해요.' }] } },
  cafe: { name: '🍚 송명초 급식실', ox: -150, oy: 180, w: 11, h: 7, floor: '#e8eef2', wall: '#fffaf0', door: [50.2, 19.5], npc: ['cook', 'cook_0', 5.5, 1.3],
    talk: [{ who: 'cook', say: '맛있는 점심 시간! 급식실에서도 지켜야 할 약속이 있어요.' },
      { who: 'cook', ask: '나는 땅콩 알레르기가 있어요. 오늘 반찬에 땅콩이 들어 있다면?', choices: [
        { t: '먹지 않고, 선생님과 조리사님께 미리 알린다', ok: true, why: '맞아요! 알레르기는 숨쉬기 힘들 만큼 위험할 수 있어요.' },
        { t: '조금만 먹으면 괜찮겠지 하고 먹는다', why: '아주 조금만 먹어도 위험할 수 있어요.' },
        { t: '친구 반찬과 몰래 바꾼다', why: '어른에게 알려야 안전하게 바꿔 줄 수 있어요.' }] }],
    task: { mode: 'order', title: '급식 먹는 순서', intro: '🍚 점심시간! 순서대로 눌러 급식을 받아요.', items: [
      { spr: 'sink', x: 10.4, y: 4.4, r: -Math.PI / 2, sc: 1.5, step: 1, name: '비누로 30초 손 씻기', why: '손 씻기는 식중독과 감기를 막는 첫걸음이에요.' },
      { spr: 'tray_stack', x: 1.6, y: 1.0, sc: 1.6, step: 2, name: '줄 서서 식판 받기', why: '밀지 않고 차례대로 줄을 서요.' },
      { spr: 'hot_soup', x: 8.8, y: 1.3, sc: 1.6, bad: true, name: '국 들고 뛰기', why: '뜨거운 국을 들고 뛰면 쏟아져 화상을 입어요. 천천히 걸어요.' },
      { spr: 'cafe_table', x: 2.8, y: 5.6, sc: 1.6, step: 3, name: '자리에 앉아 먹기', why: '자리에 앉아 꼭꼭 씹어 먹어요. 다 먹으면 잔반 정리!' }] } },
  acad: { name: '✏️ 송명 학원', ox: -150, oy: 200, w: 8, h: 6, floor: '#e4e0d8', wall: '#fbf7ef', door: [23.0, 22.6], npc: ['tutor', 'tutor_0', 6.6, 1.5],
    talk: [{ who: 'tutor', say: '수업 끝! 집에 갈 때는 학원 차를 타는 학생도 있지?' },
      { who: 'tutor', ask: '학원 차에서 내린 뒤 길을 건너려면?', choices: [
        { t: '차가 떠난 뒤 좌우를 살피고 횡단보도로 건넌다', ok: true, why: '맞아요! 차 앞뒤는 운전자가 잘 못 봐요.' },
        { t: '내리자마자 차 앞으로 바로 건넌다', why: '차 바로 앞은 운전석에서 안 보여요. 아주 위험해요.' },
        { t: '안전벨트를 미리 풀고 문 앞에 서 있는다', why: '차가 완전히 멈출 때까지 벨트를 매고 앉아 있어요.' }] }],
    task: { mode: 'hunt', title: '화재 위험 찾기', items: [
      { spr: 'exit_sign_blocked', x: 0.3, y: 2.4, r: Math.PI / 2, sc: 1.6, name: '비상구를 막은 의자', why: '불이 나면 비상구로 나가야 해요. 비상구 앞은 늘 비워요.' },
      { spr: 'heater', x: 7.4, y: 4.4, sc: 1.5, name: '난로 옆 종이', why: '난로 가까이 종이·옷을 두면 불이 붙어요.' },
      { spr: 'multitap', x: 3.6, y: 0.9, sc: 1.5, name: '문어발 콘센트', why: '플러그를 많이 꽂으면 뜨거워져 불이 날 수 있어요.' }] } },
  coffee: { name: '☕ 동네 커피숍', ox: -150, oy: 220, w: 9, h: 6, floor: '#d8c3a0', wall: '#f4efe4', door: [22.9, 19.4], npc: ['barista', 'barista_0', 5.2, 1.4],
    talk: [{ who: 'barista', say: '어서 오세요! 여기는 어른들이 커피를 마시는 곳이지만, 어린이 음료도 있어요.' },
      { who: 'barista', ask: '뜨거운 음료를 쏟아 손을 데었어요. 어떻게 할까요?', choices: [
        { t: '흐르는 시원한 물에 15분쯤 식히고 어른에게 알린다', ok: true, why: '맞아요! 찬물로 열을 식혀요. 얼음을 바로 대거나 물집을 터뜨리면 안 돼요.' },
        { t: '얼음을 덴 곳에 바로 꾹 누른다', why: '얼음은 피부를 더 상하게 할 수 있어요. 흐르는 시원한 물로 식혀요.' },
        { t: '된장이나 치약을 바른다', why: '세균이 들어가 덧날 수 있어요. 물로 식히고 병원에 가요.' }] },
      { who: 'barista', ask: '커피처럼 카페인이 많은 음료는 어린이가 마셔도 될까요?', choices: [
        { t: '잠이 안 오고 가슴이 두근거릴 수 있어서 마시지 않는다', ok: true, why: '맞아요! 어린이는 우유·과일 음료나 물을 골라요.' },
        { t: '어른처럼 매일 마시면 키가 큰다', why: '카페인은 키를 크게 하지 않아요. 잠을 방해해요.' }] }],
    task: { mode: 'hunt', title: '커피숍에서 위험한 것 찾기', items: [
      { spr: 'hot_cup', x: 2.9, y: 3.7, sc: 1.6, name: '탁자 끝의 뜨거운 커피', why: '탁자 끝 뜨거운 컵은 팔에 걸려 쏟아져요. 안쪽으로 밀어 두어요.' },
      { spr: 'puddle', x: 6.8, y: 4.6, sc: 1.4, name: '쏟은 음료', why: '바닥이 미끄러워요. 직원에게 알려요.' },
      { spr: 'cable_floor', x: 1.2, y: 5.0, sc: 1.4, name: '바닥을 지나는 충전기 줄', why: '줄에 걸려 넘어질 수 있어요. 조심해서 돌아가요.' }] } },
};
ROOMS.class.task = { mode: 'hunt', title: '교실에서 위험한 것 찾기', items: [
  { spr: 'bag_floor', x: 4.95, y: 4.0, sc: 1.4, name: '통로의 책가방', why: '통로에 둔 가방에 걸려 넘어질 수 있어요. 책상 옆 고리에 걸어요.' },
  { spr: 'multitap', x: 7.4, y: 0.9, sc: 1.5, name: '문어발 콘센트', why: '한 콘센트에 많이 꽂으면 뜨거워져 불이 날 수 있어요.' },
  { spr: 'scissors', x: 0.9, y: 2.4, sc: 1.4, name: '펼쳐진 가위', why: '가위는 날을 닫아서 통에 넣어요. 건넬 때는 손잡이 쪽으로!' }] };
ROOMS.conv.task = { mode: 'hunt', title: '편의점에서 위험한 것 찾기', items: [
  { spr: 'puddle', x: 5.4, y: 4.7, sc: 1.4, name: '젖은 바닥', why: '미끄러워요! 점원에게 알려 "미끄럼 주의" 표지를 세워요.' },
  { spr: 'box_stack', x: 4.8, y: 1.5, sc: 1.4, name: '높이 쌓인 상자', why: '높이 쌓인 상자는 무너질 수 있어요. 가까이 가지 않아요.' },
  { spr: 'cable_floor', x: 2.6, y: 5.0, sc: 1.4, name: '바닥 전선', why: '바닥을 가로지르는 전선에 걸려 넘어져요. 조심해서 넘어가요.' }] };
ROOMS.snack.task = { mode: 'hunt', title: '분식집에서 위험한 것 찾기', items: [
  { spr: 'pot_handle', x: 3.5, y: 1.25, sc: 1.4, name: '밖으로 나온 냄비 손잡이', why: '손잡이에 부딪히면 뜨거운 국물이 쏟아져요. 손잡이는 안쪽으로!' },
  { spr: 'box_stack', x: 6.2, y: 4.3, sc: 1.3, name: '소화기를 가린 상자', why: '소화기 앞에 물건을 두면 불이 났을 때 못 꺼내요.' },
  { spr: 'puddle', x: 1.8, y: 1.9, sc: 1.3, name: '쏟은 국물', why: '바닥에 쏟은 국물은 미끄럽고 뜨거워요. 어른에게 알려요.' }] };
Object.values(ROOMS).forEach((R, i) => { R.oy = i * 40; });   // 방끼리 멀리 떨어뜨려 옆 방이 안 보이게
NAMES.pe_teacher = '체육 선생님'; NAMES.nurse = '보건 선생님'; NAMES.cook = '조리사님'; NAMES.tutor = '학원 선생님'; NAMES.pharmacist = '약사 선생님'; NAMES.master = '태권도 관장님'; NAMES.scientist = '과학 선생님';
NAMES.clerk = '편의점 점원'; NAMES.owner = '분식집 사장님'; NAMES.barista = '바리스타';
const badges = new Set();
function roomTex(id, kind, R) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  if (kind === 'floor') {
    c.width = R.w * 32; c.height = R.h * 32;
    if (id === 'class') { for (let y = 0; y < c.height; y += 8) for (let x = -((y / 8) % 4) * 16; x < c.width; x += 64) { g.fillStyle = ['#c8a27a', '#bf976c', '#d1ad86', '#c49c72'][(x / 64 + y / 8 + 9) & 3 | 0]; g.fillRect(x, y, 63, 7); } }
    else if (id === 'conv') { for (let y = 0; y < c.height; y += 32) for (let x = 0; x < c.width; x += 32) { g.fillStyle = (x + y) % 64 ? '#e8eef2' : '#dde4ea'; g.fillRect(x, y, 31, 31); } }
    else if (id === 'gym') { for (let y = 0; y < c.height; y += 8) for (let x = -((y / 8) % 3) * 21; x < c.width; x += 64) { g.fillStyle = ['#d8a86a', '#cf9f60', '#e0b274'][(x / 64 + y / 8 + 9) % 3 | 0]; g.fillRect(x, y, 63, 7); } g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(24, 24, c.width - 48, c.height - 48); g.beginPath(); g.moveTo(c.width / 2, 24); g.lineTo(c.width / 2, c.height - 24); g.stroke(); g.beginPath(); g.arc(c.width / 2, c.height / 2, 30, 0, 7); g.stroke(); }
    else if (id === 'tkd') { g.fillStyle = '#3b6fd8'; g.fillRect(0, 0, c.width, c.height); for (let y = 0; y < c.height; y += 32) for (let x = 0; x < c.width; x += 32) { g.fillStyle = (x + y) % 64 ? '#3b6fd8' : '#d8483b'; g.fillRect(x + 1, y + 1, 30, 30); } g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.strokeRect(40, 40, c.width - 80, c.height - 80); }
    else if (id === 'apt') { for (let y = 0; y < c.height; y += 48) for (let x = 0; x < c.width; x += 48) { g.fillStyle = (x + y) % 96 ? '#d9d6cf' : '#cfcbc2'; g.fillRect(x, y, 47, 47); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 8, y + 20, 18, 2); } }
    else if (id === 'pharm' || id === 'sci' || id === 'nurse' || id === 'cafe' || id === 'acad') { for (let y = 0; y < c.height; y += 24) for (let x = 0; x < c.width; x += 24) { g.fillStyle = (x + y) % 48 ? (id === 'sci' ? '#d9dde2' : '#eef2f0') : (id === 'sci' ? '#c8ced4' : '#dfe8e3'); g.fillRect(x, y, 23, 23); } }
    else { for (let y = 0; y < c.height; y += 16) for (let x = 0; x < c.width; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#f2e6cf' : '#e4d2b0'; g.fillRect(x, y, 16, 16); } }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, c.width, 6);
  } else {
    const ww = kind === 'back' ? R.w : R.h; c.width = ww * 32; c.height = 48;
    g.fillStyle = R.wall; g.fillRect(0, 0, c.width, 48);
    g.fillStyle = { class: '#9bb5a0', conv: '#2f7de1', coffee: '#6b4a2a', pharm: '#2fa84f', tkd: '#d8483b', apt: '#a89880', sci: '#5b7f9e', gym: '#2f5fb3', nurse: '#ff9fb8', cafe: '#ff9f1c', acad: '#8e5cd9' }[id] || '#e2463b'; g.fillRect(0, 36, c.width, 12);      // 걸레받이·띠
    if (kind === 'side' && id === 'tkd') { g.fillStyle = '#cfe8f5'; g.fillRect(8, 6, c.width - 16, 28); g.fillStyle = 'rgba(255,255,255,.7)'; for (let x = 20; x < c.width; x += 40) g.fillRect(x, 8, 6, 24); }   // 거울
    if (kind === 'back' && (id === 'tkd' || id === 'pharm')) { g.fillStyle = id === 'tkd' ? '#1d1a1a' : '#2fa84f'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(id === 'tkd' ? '예의 · 염치 · 인내 · 극기 · 백절불굴' : '약은 약사에게 · 정해진 양만', c.width / 2, 32); }
    if (kind === 'side' && ['sci', 'pharm', 'apt', 'gym', 'nurse', 'cafe', 'acad', 'coffee'].includes(id)) for (let x = 14; x < c.width - 30; x += 50) { g.fillStyle = '#e8e2d2'; g.fillRect(x, 6, 36, 24); g.fillStyle = '#a8d8f0'; g.fillRect(x + 3, 9, 30, 18); }
    if (kind === 'back' && id === 'sci') { const cs = ['#ff9f9f', '#ffd29f', '#fff29f', '#b8f2a8', '#a8e0f2', '#c8b8f2']; for (let i = 0; i < 18; i++) for (let j = 0; j < 4; j++) if (j === 0 ? (i === 0 || i === 17) : !(j < 3 && i > 1 && i < 12)) { g.fillStyle = cs[(i + j) % 6]; g.fillRect(c.width * 0.66 + i * 4.2, 8 + j * 5, 3.6, 4.2); } }
    if (id === 'conv' && kind === 'back') { g.fillStyle = '#ff9f1c'; g.fillRect(0, 4, c.width, 5); g.fillStyle = '#2fa84f'; g.fillRect(0, 9, c.width, 3); }
    if (kind === 'side' && id === 'class') for (let x = 10; x < c.width - 30; x += 46) {                                 // 교실 창문
      g.fillStyle = '#e8e2d2'; g.fillRect(x, 6, 40, 26); g.fillStyle = '#a8d8f0'; g.fillRect(x + 3, 9, 16, 20); g.fillRect(x + 21, 9, 16, 20);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 5, 11, 4, 8); g.fillRect(x + 23, 11, 4, 8);
    }
    if (kind === 'side' && id === 'snack') for (let x = 6; x < c.width; x += 12) { g.fillStyle = '#fff'; g.fillRect(x, 16, 9, 9); g.fillStyle = '#cfe8f5'; g.fillRect(x + 1, 17, 7, 7); }
    if (kind === 'back' && id === 'class') { g.fillStyle = '#e2463b'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('바르게 · 고르게 · 즐겁게', c.width * 0.82, 30); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function buildRooms() {
  for (const [id, R] of Object.entries(ROOMS)) {
    R.id = id;
    const x0 = wx(R.ox), z0 = wz(R.oy), w = R.w * T, h = R.h * T;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: roomTex(id, 'floor', R) })); fl.rotation.x = -Math.PI / 2; fl.position.set(x0 + w / 2, 0.01, z0 + h / 2); scene.add(fl);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(w + 80, h + 60), new THREE.MeshLambertMaterial({ color: 0x5d6b78 })); out.rotation.x = -Math.PI / 2; out.position.set(x0 + w / 2, -0.02, z0 + h / 2 + 10); scene.add(out);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, 0.6), new THREE.MeshLambertMaterial({ color: R.wall })); sill.position.set(x0 + w / 2, 0.25, z0 + h + 0.3); scene.add(sill);
    const wallM = new THREE.MeshLambertMaterial({ color: R.wall });
    const wall = (ww, dd, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 6, dd), wallM); m.position.set(x, 3, z); scene.add(m); };
    wall(w + 1, 1, x0 + w / 2, z0 - 0.5); wall(1, h, x0 - 0.5, z0 + h / 2); wall(1, h, x0 + w + 0.5, z0 + h / 2);
    const face = (kind, ww, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, 6), new THREE.MeshBasicMaterial({ map: roomTex(id, kind, R) })); m.position.set(x, 3, z); m.rotation.y = ry; scene.add(m); return m; };
    face('back', w, x0 + w / 2, z0 + 0.01, 0); face('side', h, x0 + 0.01, z0 + h / 2, Math.PI / 2); face('side', h, x0 + w - 0.01, z0 + h / 2, -Math.PI / 2);
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.3), new THREE.MeshBasicMaterial({ color: 0x22c55e })); dm.rotation.x = -Math.PI / 2; dm.position.set(x0 + w / 2, 0.03, z0 + h - 0.3); scene.add(dm);
    clickables.push({ key: id + ':exit', o: label('🚪 나가기 (눌러요)', x0 + w / 2, 2.6, z0 + h - 0.4, { bg: '#16a34a', fg: '#fff', scale: 0.7 }), fn: () => player.room === id && exitRoom() });
    label(R.name, x0 + w / 2, 7.2, z0 + 0.5, { bg: '#ffd23f', scale: 0.8 });
    clickables.push({ key: id + ':door', o: label('🚪 ' + R.name.replace(/^\S+ /, '') + ' 들어가기 👆', wx(R.door[0]), 3.6, wz(R.door[1]), { bg: '#ffffff', scale: 0.7 }), fn: () => enterRoom(id, true) });
    const P = (n, x, y, r = 0, c = 0.8, sc = 1.6) => { const g = sprite(n, wx(R.ox + x), wz(R.oy + y), r, { shadow: false, scale: sc }); if (c) colliders.push({ x: g.position.x, z: g.position.z, r: c }); return g; };
    const W = (n, x, y, up, r = 0, sc = 1.6) => { const g = P(n, x, y, r, 0, sc); g.position.y = up; return g; };   // 벽에 거는 것
    if (id === 'class') {
      P('rug', 5, 6.1, 0, 0, 1.4);
      P('blackboard', 5, 0.3, 0, 0); P('tv', 8.4, 0.3, 0, 0); W('class_flag', 5, 0.12, 3.9); W('wall_clock', 2.1, 0.12, 3.6);
      P('teacher_desk', 5, 1.6, Math.PI, 1.4); P('globe', 6.3, 1.3, 0, 0, 1.2); P('plant_pot', 9.4, 0.7, 0, 0.5); P('plant_pot', 0.6, 0.7, 0, 0.5);
      P('bookshelf', 1.4, 0.45, 0, 0.8); P('locker', 0.4, 4.4, Math.PI / 2, 0); P('board_notice', 9.75, 3.2, -Math.PI / 2, 0); W('wall_clock', 9.75, 5.6, 3.4, -Math.PI / 2, 1.4);
      P('cleaning_cab', 9.3, 6.2, 0, 0.7); P('bottle_rack', 1.6, 6.4, Math.PI, 0.6);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) P('desk', 2.1 + c * 1.95, 3 + r * 1.3, 0, 0.9);
      sprite('kid2_0', wx(R.ox + 4), wz(R.oy + 3.5), Math.PI); sprite('kid3_0', wx(R.ox + 6), wz(R.oy + 4.8), Math.PI); sprite('friend_0', wx(R.ox + 8), wz(R.oy + 3.5), Math.PI); sprite('student_0', wx(R.ox + 2.1), wz(R.oy + 4.8), Math.PI);
    } else if (id === 'conv') {
      P('fridge', 2.2, 0.4, 0, 0); P('fridge', 4.2, 0.4, 0, 0); P('coffee_machine', 6.3, 0.45, 0, 0.6); P('extinguisher', 7.6, 0.6, 0, 0);
      P('shelf_snack', 2.4, 2.4, 0, 1.4); P('shelf_drink', 2.4, 3.9, 0, 1.4); P('ice_freezer', 4.9, 3.2, Math.PI / 2, 0.9);
      P('counter', 6.4, 3.4, -Math.PI / 2, 1.3); P('atm', 0.45, 1.2, Math.PI / 2, 0.5); P('ramen_station', 0.5, 3.6, Math.PI / 2, 0.6);
      P('mag_rack', 7.6, 5.2, -Math.PI / 2, 0.5); P('umbrella_stand', 2.6, 5.5, 0, 0.3); P('plant_pot', 0.5, 5.4, 0, 0.4); P('safe_sign', 7.6, 1.6, -Math.PI / 2, 0);
      sprite('grandma_0', wx(R.ox + 3.6), wz(R.oy + 4.7), Math.PI * 0.8);
    } else if (id === 'snack') {
      P('menu_board', 3.5, 0.12, 0, 0); P('stove', 3.5, 0.5, 0, 0); P('tteok_pan', 1.4, 0.6, 0, 0.9); P('fridge', 5.6, 0.4, 0, 0); P('extinguisher', 6.7, 4.3, 0, 0);
      P('water_purifier', 6.6, 2.4, -Math.PI / 2, 0.4); P('cushion_bench', 0.3, 3.2, Math.PI / 2, 0); P('plant_pot', 0.5, 4.5, 0, 0.4);
      P('table', 2, 3, 0, 1.2); P('table', 4.6, 3, 0, 1.2);
      for (const [x, y] of [[1.5, 3.8], [2.6, 3.8], [4.1, 3.8], [5.2, 3.8]]) P('stool', x, y, 0, 0);
      sprite('kid3_0', wx(R.ox + 1.5), wz(R.oy + 3.8), Math.PI); sprite('mom_0', wx(R.ox + 4.1), wz(R.oy + 3.8), Math.PI);
    } else if (id === 'pharm') {
      P('med_shelf', 2.2, 0.4, 0, 0); P('med_shelf', 5.8, 0.4, 0, 0); P('pharm_counter', 4.4, 2.4, 0, 1.6); P('shelf_drink', 0.45, 2.4, Math.PI / 2, 0.6);
      P('plant_pot', 7.5, 5.3, 0, 0.4); P('bench', 7.4, 3.2, -Math.PI / 2, 0.6, 1.2); P('safe_sign', 7.7, 1.4, -Math.PI / 2, 0);
      sprite('grandma_0', wx(R.ox + 7.0), wz(R.oy + 3.2), -Math.PI / 2);
    } else if (id === 'tkd') {
      P('trophy_shelf', 2.0, 0.35, 0, 0); P('class_flag', 4.5, 0.12, 0, 0, 2.6); P('punch_bag', 7.6, 1.0, 0, 0.5); P('punch_bag', 8.4, 1.0, 0, 0.5);
      P('shoe_rack', 1.0, 5.4, 0, 0.6, 1.2); P('water_purifier', 0.45, 2.2, Math.PI / 2, 0.4);
      for (const [x, y] of [[3.4, 3.2], [4.6, 3.2], [5.8, 3.2]]) sprite('kid_dobok_0', wx(R.ox + x), wz(R.oy + y), 0);
    } else if (id === 'apt') {
      P('mailboxes', 0.4, 3.2, Math.PI / 2, 0); P('phone_stand', 7.6, 1.6, -Math.PI / 2, 0.3); P('plant_pot', 0.6, 0.8, 0, 0.4); P('plant_pot', 7.5, 5.3, 0, 0.4);
      P('parcel_locker', 7.6, 3.8, -Math.PI / 2, 0); P('stroller', 1.6, 5.0, 0.6, 0.5); P('cctv', 5.4, 0.15, 0, 0);
    } else if (id === 'sci') {
      P('blackboard', 5, 0.3, 0, 0); P('skeleton_model', 0.7, 0.8, 0, 0.5); P('sink', 9.3, 3.4, -Math.PI / 2, 0); P('bookshelf', 2.4, 0.45, 0, 0.8); P('extinguisher', 9.6, 5.6, 0, 0);
      P('lab_table', 3.2, 3.4, 0, 1.4); P('lab_table', 6.8, 3.4, 0, 1.4); P('lab_table', 3.2, 5.5, 0, 1.4); P('lab_table', 6.8, 5.5, 0, 1.4); W('wall_clock', 8.0, 0.12, 3.6);
      sprite('kid2_0', wx(R.ox + 3.2), wz(R.oy + 4.3), Math.PI); sprite('kid3_0', wx(R.ox + 6.8), wz(R.oy + 6.3), Math.PI);
    } else if (id === 'gym') {
      P('hoop', 0.5, 3.5, Math.PI / 2, 0); P('hoop', 10.5, 3.5, -Math.PI / 2, 0); P('gym_mat', 2.4, 0.9, 0, 0, 1.5); P('gym_mat', 4.4, 0.9, 0, 0, 1.5);
      P('ball_cart', 7.0, 0.8, 0, 0.6); P('flag', 5.5, 0.15, 0, 0); P('bench', 9.6, 6.2, 0, 0.6, 1.2); P('bench', 1.4, 6.2, 0, 0.6, 1.2);
      sprite('kid_0', wx(R.ox + 3.4), wz(R.oy + 3.4), 0.5); sprite('friend_0', wx(R.ox + 6.0), wz(R.oy + 2.6), -0.6);
    } else if (id === 'nurse') {
      P('nurse_bed', 7.2, 3.4, 0, 1.0, 1.4); P('nurse_bed', 7.2, 5.4, 0, 0, 1.4); P('med_shelf', 2.8, 0.4, 0, 0); P('height_meter', 0.6, 5.2, 0, 0.3); P('plant_pot', 4.4, 0.6, 0, 0.4);
      P('teacher_desk', 4.6, 2.3, Math.PI, 1.0, 1.3); W('wall_clock', 6.4, 0.12, 3.6);
    } else if (id === 'cafe') {
      P('serving_line', 5.5, 0.6, 0, 0, 1.6); P('cafe_table', 3.0, 3.6, 0, 1.6, 1.6); P('cafe_table', 8.0, 3.6, 0, 1.6, 1.6); P('cafe_table', 8.6, 5.6, 0, 1.6, 1.6);
      P('water_purifier', 10.5, 2.6, -Math.PI / 2, 0.4); P('trash_bins', 10.3, 6.0, -Math.PI / 2, 0.5);
      for (const [n, x, y] of [['kid2_0', 2.0, 4.4], ['kid3_0', 3.6, 4.4], ['friend_0', 7.4, 4.4], ['kid_0', 8.8, 2.8]]) sprite(n, wx(R.ox + x), wz(R.oy + y), y > 4 ? Math.PI : 0);
    } else if (id === 'coffee') {
      P('counter', 5.2, 2.3, 0, 1.3); P('coffee_machine', 3.4, 0.45, 0, 0.5); P('coffee_machine', 6.6, 0.45, 0, 0.5); W('menu_wall', 5.0, 0.12, 3.6); P('cake_case', 7.6, 2.4, -Math.PI / 2, 0.8, 1.4);
      P('cafe_set', 2.6, 3.9, 0, 1.0, 1.5); P('cafe_set', 6.2, 4.0, 0, 1.0, 1.5); P('plant_pot', 0.5, 0.8, 0, 0.4); P('plant_pot', 8.5, 5.3, 0, 0.4); P('mag_rack', 0.45, 2.4, Math.PI / 2, 0.4); W('wall_clock', 1.6, 0.12, 3.6);
      sprite('mom_0', wx(R.ox + 2.0), wz(R.oy + 3.9), Math.PI / 2); sprite('grandma_0', wx(R.ox + 6.9), wz(R.oy + 4.0), -Math.PI / 2);
    } else if (id === 'acad') {
      P('whiteboard', 4.0, 0.3, 0, 0); P('bookshelf', 7.0, 0.45, 0, 0.8); W('wall_clock', 1.4, 0.12, 3.6); P('plant_pot', 7.5, 5.4, 0, 0.4);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) P('kid_desk', 2.4 + c * 1.8, 2.6 + r * 1.6, 0, 0.6, 1.4);
      sprite('kid2_0', wx(R.ox + 2.4), wz(R.oy + 3.3), Math.PI); sprite('kid3_0', wx(R.ox + 6.0), wz(R.oy + 4.9), Math.PI);
    }
    if (R.task) {
      R.done = new Set(); R.step = 0;
      for (const it of R.task.items) {
        const g = sprite(it.spr, wx(R.ox + it.x), wz(R.oy + it.y), it.r || 0, { shadow: false, scale: it.sc || 1.5 }); it.g = g; it.at = [R.ox + it.x, R.oy + it.y];
        clickables.push({ key: id + ':' + it.spr, o: g, fn: () => player.room === id && inspect(id, it) });
      }
    }
    const [nid, spr, nx, ny] = R.npc; const g = sprite(spr, wx(R.ox + nx), wz(R.oy + ny), 0); clickables.push({ key: id + ':npc', o: g, fn: () => player.room === id && talkRoom() }); colliders.push({ x: g.position.x, z: g.position.z, r: 0.5 }); R.npcAt = [R.ox + nx, R.oy + ny];
  }
}
const clickables = [];
function exitRoom() { const R = ROOMS[player.room]; player.tx = R.door[0]; player.ty = R.door[1] + 0.9; if (R.exitTmp) { [player.tx, player.ty] = R.exitTmp; R.exitTmp = null; } player.room = null; camT.set(wx(player.tx), 0, wz(player.ty)); say(badges.has(R.id) ? '밖으로 나왔어요.' : '밖으로 나왔어요. (' + roomTodo(R) + ')', '', 2.4); return true; }
function checkBadge(id) {
  const R = ROOMS[id]; if (badges.has(id) || !R.quiz || (R.task && !R.taskDone)) return;
  badges.add(id); sfx.good(); setTimeout(() => say(`🏅 ${R.name} 탐험 배지! (${badges.size}/${Object.keys(ROOMS).length})`, 'good', 3.5), 1800); renderList();
}
function roomTodo(R) { return `💬 이야기 ${R.quiz ? '✅' : '⬜'}` + (R.task ? ` · 🔍 ${R.task.title} ${R.taskDone ? '✅' : R.task.mode === 'hunt' ? R.done.size + '/' + R.task.items.filter((i) => !i.bad).length : R.step + '/' + R.task.items.filter((i) => i.step).length}` : ''); }
function talkRoom() { const id = player.room, R = ROOMS[id]; if (UI.dialog) return false; talk(R.talk, () => { R.quiz = true; checkBadge(id); if (!badges.has(id)) say('남은 할 일 → ' + roomTodo(R), '', 3); }); return true; }
function markFound(it) { const c = sprite('check_mark', it.g.position.x, it.g.position.z + 0.6, 0, { shadow: false, scale: 1.8 }); c.position.y = 1.3; it.mark = c; }
function inspect(id, it) {
  const R = ROOMS[id], T = R.task; if (UI.dialog || R.taskDone) return false;
  if (T.mode === 'hunt') {
    if (R.done.has(it)) { say(`이미 찾았어요: ${it.name}`, '', 1.5); return true; }
    R.done.add(it); markFound(it); sfx.good(); say(`🔍 ${it.name}! ${it.why}`, 'good', 4);
    if (R.done.size >= T.items.filter((i) => !i.bad).length) { R.taskDone = true; setTimeout(() => say(`✅ ${T.title} 완료!` + (R.quiz ? '' : ' 이제 사람에게 말을 걸어 봐요.'), 'good', 3), 4000); checkBadge(id); }
    return true;
  }
  if (it.bad) { sfx.bad?.(); say(`🙅 ${it.name}? ${it.why}`, 'warn', 4); return true; }
  if (it.step <= R.step) { say(`이미 했어요: ${it.name}`, '', 1.5); return true; }
  if (it.step !== R.step + 1) { const nx = T.items.find((i) => i.step === R.step + 1); say(`🤔 먼저 할 일이 있어요! (${R.step + 1}번째: ${nx.name})`, 'warn', 3); return true; }
  R.step++; markFound(it); sfx.good(); say(`${R.step}. ${it.name} — ${it.why}`, 'good', 4);
  if (R.step >= T.items.filter((i) => i.step).length) { R.taskDone = true; setTimeout(() => say(`✅ ${T.title} 완료!` + (R.quiz ? '' : ' 이제 사람에게 말을 걸어 봐요.'), 'good', 3), 4000); checkBadge(id); }
  return true;
}
const nearItem = (R) => R.task && !R.taskDone && R.task.items.find((it) => near(it.at[0], it.at[1], 1.2) && !(R.done.has(it) || (it.step && it.step <= R.step)));
// 건물 벽으로 걸어가 0.4초 부딪히면 그 건물 안으로 (아파트 → 엘리베이터 앞, 학교 → 가까운 교실·실, 상가 → 가까운 가게)
const bump = { t: 0 };
const SHOP_ROOMS = ['conv', 'snack', 'pharm', 'tkd', 'acad', 'coffee'], SCHOOL_ROOMS = ['class', 'sci', 'nurse', 'cafe'];
function roomForBuilding(x, y) {
  const ch = GRID.bldg[y]?.[x]; if (!ch || ch === '.') return null;
  const nearest = (ids, lim) => { let best = null, bd = lim; for (const id of ids) { const R = ROOMS[id]; if (!R) continue; const d = Math.hypot(R.door[0] - x - 0.5, R.door[1] - y - 0.5); if (d < bd) { bd = d; best = id; } } return best; };
  if (ch === SPRITE_BLDG[0]) return nearest(SCHOOL_ROOMS, 40);
  if (ch === SPRITE_BLDG[1]) return 'gym';
  const b = GRID.buildings[ch.charCodeAt(0) - 48]; if (!b) return null;
  if (b.kind === 'apartments') return 'apt';
  if (b.kind === 'commercial') return nearest(SHOP_ROOMS, 14);
  return null;
}
function bumpBuilding(dt) {
  if (player.room || S.active || S.pending || UI.dialog) { bump.t = 0; return; }
  const X = (player.tx + Math.sin(player.face) * 0.45) | 0, Y = (player.ty + Math.cos(player.face) * 0.45) | 0;
  if (!blocks[Y * W + X]) { bump.t = 0; return; }
  const id = roomForBuilding(X, Y); if (!id) { bump.t = 0; return; }
  bump.t += dt; if (bump.t < 0.4) return; bump.t = 0;
  const back = [player.tx - Math.sin(player.face) * 0.3, player.ty - Math.cos(player.face) * 0.3];
  if (enterRoom(id)) ROOMS[id].exitTmp = back;
}
function enterRoom(id, far = false) {
  if (player.room || UI.dialog) return false;
  if (S.active || S.pending) { say('지금 미션을 먼저 끝내고 들어가 봐요!', 'warn', 2); return false; }
  const R = ROOMS[id];
  player.room = id; player.tx = R.ox + R.w / 2; player.ty = R.oy + R.h - 1.2; player.face = Math.PI; camT.set(wx(player.tx), 0, wz(player.ty)); say(`${R.name}에 들어왔어요!<br>${R.task?.intro || ''} ${roomTodo(R)}<br><small>사람·물건을 눌러 봐요</small>`, '', 5); return true;
}
function roomAction() {
  if (player.room) {
    const R = ROOMS[player.room];
    if (near(R.ox + R.w / 2, R.oy + R.h - 0.6, 1.4)) return exitRoom();
    if (near(R.npcAt[0], R.npcAt[1], 1.8)) return talkRoom();
    const it = nearItem(R); if (it) return inspect(player.room, it);
    return false;
  }
  if (S.active || S.pending) return false;
  for (const [id, R] of Object.entries(ROOMS)) if (near(R.door[0], R.door[1], 1.5)) return enterRoom(id);
  return false;
}
// 마우스 클릭·손가락 탭: 간판/사람/나가기 표지를 누르면 바로 동작
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let downAt = null;
$('c').addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
$('c').addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 12 || !S.started || UI.dialog) return; downAt = null;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(clickables.map((c) => c.o), true);
  if (hits.length) { let o = hits[0].object; const c = clickables.find((c) => { for (let p = o; p; p = p.parent) if (p === c.o) return true; return false; }); if (c) c.fn(); }
});
function roomHint() {
  if (player.room) { const R = ROOMS[player.room]; if (near(R.ox + R.w / 2, R.oy + R.h - 0.6, 1.4)) return '🚪 <b>Space</b> 또는 아래 버튼: 밖으로 나가기'; if (near(R.npcAt[0], R.npcAt[1], 1.8)) return '💬 <b>Space</b> 또는 사람을 눌러 말 걸기'; if (nearItem(R)) return '🔍 <b>Space</b> 또는 눌러서 살펴보기'; return null; }
  if (S.active || S.pending) return null;
  for (const R of Object.values(ROOMS)) if (near(R.door[0], R.door[1], 1.5)) return `🚪 <b>Space</b> 또는 간판·버튼을 눌러 ${R.name} 들어가기`;
  return null;
}

// ================= 카메라 =================
let zoom = Q.has('far') ? 1.8 : 1.25, shake = 0;
const camT = new THREE.Vector3();
addEventListener('wheel', (e) => { zoom = clamp(zoom + e.deltaY * 0.0015, 0.45, 2.4); }, { passive: true });
$('zin').addEventListener('click', () => (zoom = clamp(zoom - 0.2, 0.45, 2.4))); $('zout').addEventListener('click', () => (zoom = clamp(zoom + 0.2, 0.45, 2.4)));
function updateCamera(dt) {
  if (keys.has('Equal') || keys.has('NumpadAdd')) zoom = clamp(zoom - dt, 0.45, 2.4); if (keys.has('Minus') || keys.has('NumpadSubtract')) zoom = clamp(zoom + dt, 0.45, 2.4);
  zoom = clamp(zoom + pinch.delta, 0.45, 2.4); pinch.delta = 0;
  const p = player.g.position, Rm = player.room && ROOMS[player.room];
  const portrait = innerWidth < innerHeight; let d = (portrait ? 1.25 : 1) * zoom;
  if (Rm) {   // 실내: 방 전체가 화면에 들어오게
    const asp = innerWidth / innerHeight; d = clamp(Math.max(d, 1.2 * ((Rm.w + 1) / 10.5) * (1.25 / asp), 1.2 * ((Rm.h + 1) / 7.5) * (portrait ? 0.75 : 1)), 0.9, 3.2);
    camT.lerp(new THREE.Vector3(wx(Rm.ox + Rm.w / 2), 0, wz(Rm.oy + Rm.h / 2) + (portrait ? 2 : 3)), Math.min(1, dt * 5));
  } else camT.lerp(p, Math.min(1, dt * 5));
  camera.position.set(camT.x, camT.y + 21 * d, camT.z + 21 * d);
  shake = lerp(shake, quake && quake.phase === 'shake' ? 0.6 : 0, Math.min(1, dt * 4));
  if (shake > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, 0, (Math.random() - 0.5) * shake));
  camera.lookAt(camT.x, camT.y + 1, camT.z);
  sun.position.set(camT.x + 30, 60, camT.z + 20); sun.target.position.copy(camT);
  seeThrough.uP.value.set(p.x, p.y + 1, p.z); seeThrough.uC.value.copy(camera.position);
}

// ================= 안내 화살표 · 미니맵 =================
let arrow, goalRing;
function makeGuides() {
  const s = new THREE.Shape(); s.moveTo(0, 1.2); s.lineTo(0.8, 0); s.lineTo(0.3, 0); s.lineTo(0.3, -0.9); s.lineTo(-0.3, -0.9); s.lineTo(-0.3, 0); s.lineTo(-0.8, 0); s.closePath();
  arrow = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })); arrow.renderOrder = 4; scene.add(arrow);
  goalRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); goalRing.rotation.x = -Math.PI / 2; scene.add(goalRing);
}
function nextTarget() {
  if (goal) return { x: goal[0], y: goal[1], r: goal[2], text: S.active.icon + ' ' + S.active.title };
  // 진행 중인 미션이 없으면 가장 가까운 미완료 미션 사람
  let best = null; for (const m of M) if (!S.done[m.id]) { const [, , x, y] = m.npc; const d = Math.hypot(x - player.tx, y - player.ty); if (!best || d < best.d) best = { x, y, r: 1.4, d, text: m.icon + ' ' + m.title + ' — 사람에게 말 걸기' }; }
  return best;
}
function updateGuides(time) {
  const t = player.room ? null : nextTarget(); const tg = $('target');
  if (!t) { arrow.visible = goalRing.visible = false; tg.style.display = 'none'; return; }
  const px = wx(player.tx), pz = wz(player.ty), gx = wx(t.x), gz = wz(t.y), d = Math.hypot(gx - px, gz - pz);
  arrow.visible = d > 6; arrow.position.set(px + (gx - px) / d * 3, 0.15, pz + (gz - pz) / d * 3); arrow.rotation.set(-Math.PI / 2, 0, -Math.atan2(gx - px, -(gz - pz)));
  goalRing.visible = !!goal; if (goal) { goalRing.position.set(gx, 0.12, gz); goalRing.scale.setScalar(t.r * (1 + Math.sin(time * 4) * 0.06)); }
  tg.style.display = 'block'; tg.textContent = `${t.text} · ${Math.round(d / T * 6)}m`;
}
function drawMinimap() {
  const mm = $('minimap').getContext('2d'); mm.putImageData(minimapBase, 0, 0);
  for (const m of M) if (!S.done[m.id]) { const [, , x, y] = m.npc; mm.fillStyle = S.active === m ? '#ff7a1a' : '#ffd23f'; mm.fillRect(x * 2 - 2, y * 2 - 2, 5, 5); mm.strokeStyle = '#7a4a00'; mm.strokeRect(x * 2 - 2.5, y * 2 - 2.5, 5, 5); }
  if (goal) { mm.fillStyle = '#22c55e'; mm.beginPath(); mm.arc(goal[0] * 2, goal[1] * 2, 3.5, 0, 7); mm.fill(); }
  for (const c of cars) { mm.fillStyle = c.special ? '#ff3040' : '#ffffff'; mm.fillRect(tx(c.g.position.x) * 2 - 1, ty(c.g.position.z) * 2 - 1, 2, 2); }
  mm.fillStyle = '#e2463b'; mm.beginPath(); mm.arc(player.tx * 2, player.ty * 2, 3.5, 0, 7); mm.fill(); mm.strokeStyle = '#fff'; mm.lineWidth = 1.5; mm.stroke();
}

// ================= 메인 루프 =================
let time = 0, last = performance.now(), mmT = 0;
let dbg;
let clickAct = false;
function frame(dt, noRender = false) {
  time += dt; simT += dt;
  updatePlayer(dt); updateCars(dt); updateWalkers(dt);
  if (S.started && !UI.dialog) {
    roadRules();
    if (S.active && !player.room) S.active.update(dt);
    if ((pressed.has('Space') || pressed.has('Enter') || clickAct) && !roomAction() && !S.active) { const m = M.find((m) => !S.done[m.id] && near(m.npc[2], m.npc[3], 2.2)); if (m) startMission(m); }
  } else if (UI.dialog && (pressed.has('Enter') || pressed.has('Space')) && !$('dnext').classList.contains('hidden')) UI.next && UI.next();
  updateSignals(time); updateFx(dt, time); updateRubble(dt); updateCamera(dt); updateGuides(time);
  if ((mmT -= dt) <= 0) { mmT = 0.15; drawMinimap(); }
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  const nearNpc = !S.active && M.find((m) => !S.done[m.id] && near(m.npc[2], m.npc[3], 2.2));
  $('btn-act').innerHTML = nearNpc ? '💬<br>말하기' : (S.active?.id === 'aid' ? '🙋<br>손 흔들기' : '💬<br>말하기');
  const rh = !UI.dialog && roomHint();
  { const ab = $('actbtn'); let lbl = null;
    if (S.started && !UI.dialog) {
      if (player.room) { const R = ROOMS[player.room]; lbl = near(R.ox + R.w / 2, R.oy + R.h - 0.6, 1.4) ? '🚪 밖으로 나가기' : near(R.npcAt[0], R.npcAt[1], 1.8) ? '💬 말 걸기' : nearItem(R) ? '🔍 살펴보기' : null; }
      else if (!S.active && !S.pending) { const R = Object.values(ROOMS).find((R) => near(R.door[0], R.door[1], 1.5)); if (R) lbl = '🚪 ' + R.name.replace(/^\S+ /, '') + ' 들어가기'; else if (nearNpc) lbl = nearNpc.icon + ' 말 걸기'; }
    }
    if (lbl) { if (ab.textContent !== lbl) ab.textContent = lbl; ab.classList.remove('hidden'); } else ab.classList.add('hidden'); }
  if (rh && bannerT <= 0) say(rh, '', 0.3);
  else if (nearNpc && !player.room && !UI.dialog && bannerT <= 0) say(`${nearNpc.icon} <b>Space</b>(💬 버튼)를 눌러 말을 걸어요`, '', 0.3);
  clickAct = false; document.body.classList.toggle('inroom', !!player.room);
  if (!noRender) renderer.render(scene, camera); endFrame(); dbg();
}
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!document.hidden) frame(dt); requestAnimationFrame(loop); }

async function init() {
  await loadAll();
  buildMap(); placeProps(); placeSignals(); makeGuides(); buildRooms();
  player.g = sprite('kid_0', 0, 0, Math.PI); player.tx = START[0]; player.ty = START[1];
  board = new THREE.Mesh(sprGeo.kickboard, sprMat.kickboard); board.visible = false; scene.add(board);
  for (const m of M) { const [id, spr, x, y, f] = m.npc; npc(m.id, spr, x, y, f); marker(m.id, x, y, m.icon + ' !'); }
  sprite('grandma_0', wx(59.4), wz(45.8), Math.PI / 2);                        // 응급 미션 옆 할머니
  // 동네 사람들 (인도 왕복)
  addWalker('grandma', [[30, 38.6], [42, 38.6]], 1.0); addWalker('mom', [[56, 34.4], [86, 34.4]], 1.4); addWalker('student', [[86, 38.6], [52, 38.6]], 1.8);
  addWalker('officer', [[22.4, 2], [22.4, 30]], 1.5); addWalker('kid2', [[36, 64], [36, 40], [38, 40]], 1.9); addWalker('worker', [[30.5, 39.4], [33, 39.4]], 0.7);
  for (const k of ['E', 'Wb', 'N', 'Sb']) for (let i = 0; i < 3; i++) { const L = LANES[k]; spawnCar(k, CAR_NAMES[(i * 3 + k.length) % CAR_NAMES.length], { at: L.from + L.dir * (12 + i * 22) }); }
  dbg = debugPanel(() => `tile ${player.tx.toFixed(1)}, ${player.ty.toFixed(1)} '${tile(player.tx, player.ty)}'  crouch ${player.crouch}\nmission ${S.active?.id} mistakes ${S.mistakes}  cars ${cars.length}`);
  renderList(); updateCamera(1); if (innerWidth < 700) $('panel').classList.add('collapsed');
  $('loading').classList.add('hidden'); $('start').disabled = false; $('start').textContent = '탐험 시작!';
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  requestAnimationFrame(loop);
  if (Q.has('auto')) start();
}
function start() {
  if (S.started) return; S.started = true; $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  beep(1, 0.01, 'sine', 0.0001);
  say('🦺 송명 안전 탐험대 출동! <b>노란 화살표</b>를 따라 <b>!</b> 표시가 있는 사람에게 가 봐요.', '', 5);
}
$('start').addEventListener('click', start);
init();

// ================= 테스트 훅 =================
window.G = {
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(dt, i < n - 1); },
  tp: (x, y) => { player.tx = x; player.ty = y; player.safe = [x, y]; camT.set(wx(x), 0, wz(y)); },
  hold: (...c) => c.forEach((k) => keys.add(k)), release: (...c) => c.forEach((k) => keys.delete(k)), press: (k) => pressed.add(k),
  sig: (id) => sigState(CW.find((c) => c.id === id)), setSimT: (t) => { simT = t; },
  state: () => ({ tx: +player.tx.toFixed(2), ty: +player.ty.toFixed(2), tile: tile(player.tx, player.ty), crouch: player.crouch, ride: player.ride, active: S.active?.id || null, mistakes: S.mistakes, done: Object.keys(S.done), stars: { ...S.stars }, dialog: !!UI.dialog, goal, cars: cars.length, banner: $('banner').textContent }),
  answerAll: () => { let n = 0; while (UI.dialog && n++ < 40) { const ok = [...document.querySelectorAll('#dchoices button')].find((b) => b.dataset.ok === '1' && !b.disabled); if (ok) ok.click(); else if (!$('dnext').classList.contains('hidden')) $('dnext').click(); else break; } },
  zoom: (z) => { zoom = z; }, room: () => player.room, exit: () => player.room && exitRoom(), rfb: (x, y) => [GRID.bldg[y][x], roomForBuilding(x, y), blocks[y * W + x]], dbgBump: () => ({ t: bump.t, face: player.face, room: player.room, act: S.active?.id, pend: S.pending }), enter: (id) => { const R = ROOMS[id]; G.tp(R.door[0], R.door[1]); return roomAction(); }, act: () => roomAction(), badges: () => [...badges], clicks: () => Object.fromEntries(clickables.map((c) => { const b = new THREE.Box3().setFromObject(c.o), v = b.getCenter(new THREE.Vector3()).project(camera); return [c.key, [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]]; })), roomState: (id) => { const R = ROOMS[id]; return { quiz: !!R.quiz, task: !!R.taskDone, found: R.done ? R.done.size : 0, step: R.step }; },
  talkTo: (id) => { const m = M.find((x) => x.id === id); G.tp(m.npc[2], m.npc[3] + 1.2); startMission(m); },
  missions: () => M.map((m) => m.id), parkCar: () => parkCar ? +tx(parkCar.position.x).toFixed(1) : null, cars: () => cars.map((c) => ({ n: c.name, lane: c.lane, p: +c.p.toFixed(1), v: +c.v.toFixed(1), s: c.special || '' })),
};
