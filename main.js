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
  const names = Object.keys(MAN); let done = 0;
  const loader = new THREE.TextureLoader();
  await Promise.all(names.map((n) => new Promise((res) => loader.load('sprites/' + n + '.png', (tex) => {
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    buildSprite(n, tex); $('lp').textContent = Math.round(++done / names.length * 100) + '%'; res();
  }, undefined, () => res()))));
}
// 슬라이스 띠 → 납작한 면 2N장을 쌓은 지오메트리 하나 (그리기 호출 1번)
function buildSprite(name, tex) {
  const m = MAN[name], s = m.vox * SPR * (m.note === 'person' ? 1.75 : 1), w = m.w * s, l = m.l * s, n = m.n;
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
}
const shadowGeo = new THREE.CircleGeometry(1, 20), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
function sprite(name, x, z, rot = 0, { shadow = true, add = true } = {}) {
  const g = new THREE.Group(); const m = new THREE.Mesh(sprGeo[name], sprMat[name]); g.add(m); g.userData.mesh = m; g.userData.name = name;
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
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.strokeRect(41 * P, 22 * P, 14 * P, 9 * P); g.beginPath(); g.arc(48 * P, 26.5 * P, 2 * P, 0, 7); g.stroke();
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
function stMat(opts) {
  const m = new THREE.MeshLambertMaterial(opts);
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
function buildBuildings() {
  const byKind = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = GRID.bldg[y][x]; if (ch === '.') continue;
    if (!blocks[y * W + x]) continue;
    const id = ch.charCodeAt(0) - 48, b = GRID.buildings[id] || { kind: 'public', levels: 3 };
    const k = KIND[b.kind] ? b.kind : 'public', h = KIND[k].h(b.levels || 3);
    (byKind[k] ||= []).push({ x, y, id: ch, h });
  }
  for (const [k, cells] of Object.entries(byKind)) {
    const pos = [], nor = [], uv = [], side = [], top = [];
    const at = {}; cells.forEach((c) => (at[c.x + ',' + c.y] = c));
    const quad = (a, b, c, d, n, uvs, list) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); for (let j = 0; j < 4; j++) nor.push(...n); uv.push(...uvs); list.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (const c of cells) {
      const x0 = wx(c.x), x1 = wx(c.x + 1), z0 = wz(c.y), z1 = wz(c.y + 1), h = c.h, vh = h / 2.6;
      quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], [0, 0, 0, 1, 1, 1, 1, 0], top);
      const nb = (dx, dy) => { const o = at[(c.x + dx) + ',' + (c.y + dy)]; return o && o.id === c.id; };
      if (!nb(0, 1)) quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], [0, 0, 1, 0, 1, vh, 0, vh], side);
      if (!nb(0, -1)) quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], [0, 0, 1, 0, 1, vh, 0, vh], side);
      if (!nb(1, 0)) quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], [0, 0, 1, 0, 1, vh, 0, vh], side);
      if (!nb(-1, 0)) quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], [0, 0, 1, 0, 1, vh, 0, vh], side);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([...side, ...top]); g.addGroup(0, side.length, 0); g.addGroup(side.length, top.length, 1);
    const K = KIND[k];
    const mesh = new THREE.Mesh(g, [stMat({ map: windowTex(K.wall, K.win, K.lit) }), stMat({ color: K.roof })]);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
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
  prop('soccer_goal', 41.6, 26.5, Math.PI / 2, 0); prop('soccer_goal', 54.4, 26.5, -Math.PI / 2, 0);
  prop('hoop', 55, 23, -Math.PI / 2, 0.5); prop('flag', 39.8, 21.5, 0, 0.3);
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
const player = { g: null, tx: 46.5, ty: 63.5, face: Math.PI, crouch: false, walk: 0, frozen: 0, ride: false, helmet: false, safe: [46.5, 63.5], crossedOn: null };
const START = [46.5, 63.2];
function blockedAt(x, y) {
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
    if (!blockedAt(player.tx + dx, player.ty)) player.tx += dx;
    if (!blockedAt(player.tx, player.ty + dy)) player.ty += dy;
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
  if (player.frozen > 0 || player.auto) return;
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
  const n = (who === 'kid3' ? 'kid3' : who) + '_0'; const tex = sprMat[n]?.map?.image; const m = MAN[n]; if (!tex || !m) return;
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
  $('done-count').textContent = Object.keys(S.done).length; $('star-total').textContent = '⭐' + Object.values(S.stars).reduce((a, b) => a + b, 0);
}
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

// ================= 카메라 =================
let zoom = Q.has('far') ? 1.8 : 1.25, shake = 0;
const camT = new THREE.Vector3();
addEventListener('wheel', (e) => { zoom = clamp(zoom + e.deltaY * 0.0015, 0.45, 2.4); }, { passive: true });
$('zin').addEventListener('click', () => (zoom = clamp(zoom - 0.2, 0.45, 2.4))); $('zout').addEventListener('click', () => (zoom = clamp(zoom + 0.2, 0.45, 2.4)));
function updateCamera(dt) {
  if (keys.has('Equal') || keys.has('NumpadAdd')) zoom = clamp(zoom - dt, 0.45, 2.4); if (keys.has('Minus') || keys.has('NumpadSubtract')) zoom = clamp(zoom + dt, 0.45, 2.4);
  zoom = clamp(zoom + pinch.delta, 0.45, 2.4); pinch.delta = 0;
  const p = player.g.position; camT.lerp(p, Math.min(1, dt * 5));
  const portrait = innerWidth < innerHeight, d = (portrait ? 1.25 : 1) * zoom;
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
  const t = nextTarget(); const tg = $('target');
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
function frame(dt, noRender = false) {
  time += dt; simT += dt;
  updatePlayer(dt); updateCars(dt); updateWalkers(dt);
  if (S.started && !UI.dialog) {
    roadRules();
    if (S.active) S.active.update(dt);
    else if (pressed.has('Space') || pressed.has('Enter')) { const m = M.find((m) => !S.done[m.id] && near(m.npc[2], m.npc[3], 2.2)); if (m) startMission(m); }
  } else if (UI.dialog && (pressed.has('Enter') || pressed.has('Space')) && !$('dnext').classList.contains('hidden')) UI.next && UI.next();
  updateSignals(time); updateFx(dt, time); updateRubble(dt); updateCamera(dt); updateGuides(time);
  if ((mmT -= dt) <= 0) { mmT = 0.15; drawMinimap(); }
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  const nearNpc = !S.active && M.find((m) => !S.done[m.id] && near(m.npc[2], m.npc[3], 2.2));
  $('btn-act').innerHTML = nearNpc ? '💬<br>말하기' : (S.active?.id === 'aid' ? '🙋<br>손 흔들기' : '💬<br>말하기');
  if (nearNpc && !UI.dialog && bannerT <= 0) say(`${nearNpc.icon} <b>Space</b>(💬 버튼)를 눌러 말을 걸어요`, '', 0.3);
  if (!noRender) renderer.render(scene, camera); endFrame(); dbg();
}
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!document.hidden) frame(dt); requestAnimationFrame(loop); }

async function init() {
  await loadAll();
  buildMap(); placeProps(); placeSignals(); makeGuides();
  player.g = sprite('kid_0', 0, 0, Math.PI); player.tx = START[0]; player.ty = START[1];
  board = new THREE.Mesh(sprGeo.kickboard, sprMat.kickboard); board.visible = false; scene.add(board);
  for (const m of M) { const [id, spr, x, y, f] = m.npc; npc(m.id, spr, x, y, f); marker(m.id, x, y, m.icon + ' !'); }
  sprite('grandma_0', wx(59.4), wz(45.8), Math.PI / 2);                        // 응급 미션 옆 할머니
  // 동네 사람들 (인도 왕복)
  addWalker('grandma', [[30, 38.6], [42, 38.6]], 1.0); addWalker('mom', [[56, 34.4], [86, 34.4]], 1.4); addWalker('student', [[86, 38.6], [52, 38.6]], 1.8);
  addWalker('officer', [[22.4, 2], [22.4, 30]], 1.5); addWalker('kid2', [[36, 64], [36, 40], [38, 40]], 1.9); addWalker('worker', [[30.5, 39.4], [33, 39.4]], 0.7);
  for (const k of ['E', 'Wb', 'N', 'Sb']) for (let i = 0; i < 3; i++) { const L = LANES[k]; spawnCar(k, CAR_NAMES[(i * 3 + k.length) % CAR_NAMES.length], { at: L.from + L.dir * (12 + i * 22) }); }
  dbg = debugPanel(() => `tile ${player.tx.toFixed(1)}, ${player.ty.toFixed(1)} '${tile(player.tx, player.ty)}'  crouch ${player.crouch}\nmission ${S.active?.id} mistakes ${S.mistakes}  cars ${cars.length}`);
  renderList(); updateCamera(1);
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
  talkTo: (id) => { const m = M.find((x) => x.id === id); G.tp(m.npc[2], m.npc[3] + 1.2); startMission(m); },
  missions: () => M.map((m) => m.id), parkCar: () => parkCar ? +tx(parkCar.position.x).toFixed(1) : null, cars: () => cars.map((c) => ({ n: c.name, lane: c.lane, p: +c.p.toFixed(1), v: +c.v.toFixed(1), s: c.special || '' })),
};
