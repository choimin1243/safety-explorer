// 안전 탐험대 — 초등 안전교육 3D 탐험 게임 (three.js)
// 디버그: ?auto 제목 건너뜀, ?mute 무음, F3 디버그 패널, window.G 에 테스트 훅
import * as THREE from 'three';
import { keys, pressed, touch, endFrame, debugPanel } from './input.js';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- 렌더러 · 장면 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3f5);
scene.fog = new THREE.Fog(0xbfe3f5, 45, 95);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a9a6a, 1.15));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
sun.position.set(18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 55 : 40;          // 세로 화면은 시야를 넓힌다
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- 재질 · 도우미 ----------
const matCache = {};
const M = (color, o = {}) => { const { noShadow, ...p } = o; return (matCache[color + JSON.stringify(p)] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...p })); };
function box(w, h, d, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, o));
  m.position.set(x, y, z); m.castShadow = o.noShadow ? false : true; m.receiveShadow = true;
  scene.add(m); return m;
}
function cyl(rt, rb, h, color, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
// 글자 표지판 (캔버스 텍스처 스프라이트)
function label(text, x, y, z, { bg = '#ffffff', fg = '#1d2a33', scale = 1, w = 512 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; roundRect(g, 4, 4, w - 8, 120, 34); g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke();
  g.fillStyle = fg; g.font = 'bold 58px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true }));
  s.scale.set(4 * scale * (w / 512), 1 * scale, 1); s.position.set(x, y, z); scene.add(s); return s;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- 충돌 ----------
const walls = [];                                  // {x0,x1,z0,z1}
const solid = (x0, x1, z0, z1) => walls.push({ x0, x1, z0, z1 });
function wall(x0, z0, x1, z1, color = 0xf3e6cf, h = 3) { // 축 정렬 벽
  const t = 0.4, w = Math.abs(x1 - x0) || t, d = Math.abs(z1 - z0) || t;
  box(w, h, d, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  solid(Math.min(x0, x1) - t / 2, Math.max(x0, x1) + t / 2, Math.min(z0, z1) - t / 2, Math.max(z0, z1) + t / 2);
}
const R = 0.45;                                    // 플레이어 반지름
function blocked(x, z) {
  if (x < -44 || x > 44 || z < -34 || z > 34) return true;
  for (const w of walls) if (x > w.x0 - R && x < w.x1 + R && z > w.z0 - R && z < w.z1 + R) return true;
  return false;
}

// ---------- 지형 ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), M(0x8cc56a));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
box(70, 0.05, 32, 0xd9d2c3, 0, 0.025, 7.4, { noShadow: true });      // 광장 보도블록
// 도로 (z -18 ~ -10)
const ROAD = { z0: -18, z1: -10 }, CROSS = { x0: -2.5, x1: 2.5 };
box(120, 0.06, 8, 0x4a4f57, 0, 0.03, -14, { noShadow: true });
for (let x = -58; x < 58; x += 6) if (x + 2 < CROSS.x0 - 1 || x > CROSS.x1 + 1) box(2.6, 0.07, 0.25, 0xffd34d, x + 1.3, 0.04, -14, { noShadow: true });
for (let i = 0; i < 7; i++) box(5, 0.08, 0.7, 0xffffff, 0, 0.045, -17.4 + i * 1.15, { noShadow: true }); // 횡단보도 줄무늬
box(0.3, 0.08, 4, 0xffffff, -4.2, 0.045, -16, { noShadow: true }); box(0.3, 0.08, 4, 0xffffff, 4.2, 0.045, -12, { noShadow: true }); // 정지선
box(120, 0.25, 1.4, 0xbfb8aa, 0, 0.12, -9.3); box(120, 0.25, 1.4, 0xbfb8aa, 0, 0.12, -18.7);     // 연석
box(70, 0.05, 14, 0xd9d2c3, 0, 0.025, -26, { noShadow: true });    // 길 건너 보도
// 길 건너 학교
box(30, 7, 4, 0xf2c9a0, 0, 3.5, -31); solid(-15, 15, -33, -29);
for (let i = -12; i <= 12; i += 4) box(2.2, 1.6, 0.1, 0x9fd3f0, i, 4.5, -28.95);
box(5, 3, 0.2, 0x7a5236, 0, 1.5, -28.9);
label('🏫 가온초등학교', 0, 8.4, -30, { bg: '#2f7de1', fg: '#fff', scale: 1.3, w: 640 });
box(0.5, 2.2, 0.5, 0x99aaaa, -9, 1.1, -24); box(0.5, 2.2, 0.5, 0x99aaaa, 9, 1.1, -24);

// 나무 · 꽃밭 장식
function tree(x, z, s = 1) {
  cyl(0.25 * s, 0.32 * s, 2 * s, 0x8b5a2b, x, s, z, 8);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), M(0x4f9e45, { flatShading: true }));
  f.position.set(x, 2.6 * s, z); f.castShadow = true; scene.add(f);
  solid(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
}
[[-30, 18], [-36, 10], [32, 20], [38, 4], [-6, 22], [8, 26], [-40, -4], [40, -4], [-24, -24], [24, -24], [-36, -26], [36, -27]].forEach(([x, z]) => tree(x, z, 0.9 + ((x * z) % 3) * 0.1));
for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; box(0.35, 0.35, 0.35, [0xff6b8b, 0xffd34d, 0xffffff][i % 3], Math.cos(a) * 2.6, 0.3, 6 + Math.sin(a) * 2.6, { noShadow: true }); }
cyl(2.2, 2.4, 0.4, 0x6aa84f, 0, 0.2, 6, 24);                       // 화단
solid(-2.4, 2.4, 3.6, 8.4);

// ---------- 미션 지점 표시 (빛나는 고리) ----------
function ring(x, z, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.09, z); scene.add(m); return m;
}

// ---------- 신호등 ----------
function lamp(color) { return new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0 })); }
function pedSignal(x, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), M(0x555b63)); pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.45), M(0x2a2e33)); head.position.y = 3.2; head.castShadow = true; g.add(head);
  const red = lamp(0xff2a2a), green = lamp(0x22ff66);
  red.position.set(0, 3.47, 0.24); green.position.set(0, 2.93, 0.24); g.add(red, green);
  solid(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  return { red, green };
}
const peds = [pedSignal(3.4, -19.6, Math.PI), pedSignal(-3.4, -8.4, 0)];
function carSignal(x, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.6, 8), M(0x555b63)); pole.position.y = 2.3; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.45), M(0x2a2e33)); head.position.y = 4.6; g.add(head);
  const red = lamp(0xff2a2a), yel = lamp(0xffb800), green = lamp(0x22ff66);
  red.position.set(-0.5, 4.6, 0.24); yel.position.set(0, 4.6, 0.24); green.position.set(0.5, 4.6, 0.24); g.add(red, yel, green);
  solid(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  return { red, yel, green };
}
const carSigs = [carSignal(-5.2, -19.6, 0), carSignal(5.2, -8.4, Math.PI)];
// 신호 주기: 보행 초록 8초(마지막 3초 깜빡임) → 보행 빨강 9초 (차량 초록 6초 + 노랑 2초 + 전환 1초)
const CYCLE = 17, PED_GREEN = 8;
let sigT = PED_GREEN + 2;                           // 시작은 빨간불 중간
function signalState() {
  const t = sigT % CYCLE;
  const pedGreen = t < PED_GREEN, blink = pedGreen && t > PED_GREEN - 3;
  const car = t < PED_GREEN + 1 ? 'red' : t < CYCLE - 2 ? 'green' : 'yellow';
  return { pedGreen, blink, car, left: pedGreen ? PED_GREEN - t : CYCLE - t };
}

// ---------- 자동차 ----------
const cars = [];
const CAR_COLORS = [0xe2463b, 0x2f7de1, 0xffd34d, 0xffffff, 0x2fa84f, 0x8e5bd6];
function makeCar(lane) {
  const g = new THREE.Group();
  const col = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.8), M(col, { roughness: 0.4, metalness: 0.2 })); body.position.y = 0.75; body.castShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 1.6), M(0xcfe8f5, { roughness: 0.2 })); top.position.set(-0.2, 1.5, 0); top.castShadow = true; g.add(top);
  for (const [wx, wz] of [[-1.1, 0.9], [1.1, 0.9], [-1.1, -0.9], [1.1, -0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), M(0x222222)); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w);
  }
  const dir = lane === 0 ? 1 : -1;                    // 0: z=-16 서→동, 1: z=-12 동→서
  g.rotation.y = dir === 1 ? 0 : Math.PI;
  g.position.set(dir === 1 ? -58 : 58, 0, lane === 0 ? -16 : -12);
  scene.add(g);
  const car = { g, dir, lane, v: 9 }; cars.push(car); return car;
}
let carTimer = [0.5, 1.6];
function updateCars(dt, sig) {
  for (let l = 0; l < 2; l++) { carTimer[l] -= dt; if (carTimer[l] <= 0) { makeCar(l); carTimer[l] = 2.8 + Math.random() * 2.2; } }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i], x = c.g.position.x, front = x + c.dir * 1.9;
    const stopLine = c.dir === 1 ? -4.4 : 4.4;
    let target = 9;
    // 신호가 빨강/노랑이고 아직 정지선 앞이면 멈춘다
    if (sig.car !== 'green' && (c.dir === 1 ? front < stopLine : front > stopLine)) {
      const dist = Math.abs(stopLine - front); target = dist < 0.3 ? 0 : Math.min(9, dist * 1.6);
    }
    // 앞차와 간격 유지
    for (const o of cars) if (o !== c && o.lane === c.lane) { const gap = (o.g.position.x - x) * c.dir; if (gap > 0 && gap < 6) target = Math.min(target, Math.max(0, (gap - 4.6) * 3)); }
    // 횡단보도에 사람이 있으면 양보
    if (inRoad(player.pos.x, player.pos.z) && Math.abs(player.pos.z - c.g.position.z) < 2.2) { const gap = (player.pos.x - x) * c.dir; if (gap > 0 && gap < 7 && sig.car !== 'green') target = 0; }
    c.v += (target - c.v) * Math.min(1, dt * 3);
    // 소방차가 뒤에서 오면 길 가장자리로 비켜 준다
    if (c.lane === 0) { const tx = truck.g.position.x, gap = x - tx, yield_ = truck.state === 'drive' && Math.abs(truck.g.position.z + 16) < 0.5 && gap > -5 && gap < 22; c.g.position.z += ((yield_ ? -18.6 : -16) - c.g.position.z) * Math.min(1, dt * 3); }
    c.g.position.x += c.dir * c.v * dt;
    if (Math.abs(c.g.position.x) > 60) { scene.remove(c.g); cars.splice(i, 1); }
  }
}
const inRoad = (x, z) => z > ROAD.z0 && z < ROAD.z1;

// ---------- 건물: 화재 대피 체험관 (x 12~30, z 0~16) ----------
const FIRE = { x0: 12, x1: 30, z0: 0, z1: 16 };
box(18, 0.1, 16, 0xe9e2d0, 21, 0.05, 8, { noShadow: true });
wall(12, 0, 30, 0, 0xf6d6c8); wall(12, 16, 30, 16, 0xf6d6c8, 1.1);           // 카메라 쪽 벽은 낮게
wall(12, 0, 12, 6, 0xf6d6c8); wall(12, 9, 12, 16, 0xf6d6c8);       // 입구 (서쪽, z 6~9)
wall(30, 0, 30, 11, 0xf6d6c8); wall(30, 14, 30, 16, 0xf6d6c8);     // 비상구 (동쪽, z 11~14)
wall(17, 0, 17, 11, 0xffffff); wall(23, 5, 23, 16, 0xffffff);      // 복도를 지그재그로
wall(23, 0, 23, 1.2, 0xffffff);
label('🔥 화재 대피 체험관', 21, 5.2, 0, { bg: '#e2463b', fg: '#fff', scale: 1.2, w: 640 });
// 비상구 표시 (초록)
const exitSign = box(2.2, 0.8, 0.15, 0x22c55e, 29.7, 3.4, 12.5, { emissive: 0x22c55e, emissiveIntensity: 0.9 }); exitSign.rotation.y = Math.PI / 2;
label('🏃 비상구', 31.5, 4.4, 12.5, { bg: '#16a34a', fg: '#fff', scale: 0.8 });
// 바닥 유도 화살표
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
function floorArrow(x, z, rot) {
  const s = new THREE.Shape(); s.moveTo(0, 0.55); s.lineTo(0.45, 0); s.lineTo(0.18, 0); s.lineTo(0.18, -0.5); s.lineTo(-0.18, -0.5); s.lineTo(-0.18, 0); s.lineTo(-0.45, 0); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), arrowMat); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.12, z); scene.add(m);
}
floorArrow(14.5, 7.5, Math.PI); floorArrow(14.5, 11, Math.PI); floorArrow(14.5, 14, -Math.PI / 2); floorArrow(20, 14, -Math.PI / 2);
floorArrow(20, 9, 0); floorArrow(20, 4, 0); floorArrow(20, 2.5, -Math.PI / 2); floorArrow(25, 2.5, -Math.PI / 2); floorArrow(26.5, 6, Math.PI); floorArrow(26.5, 10, Math.PI); floorArrow(28.4, 12.5, -Math.PI / 2);
// 엘리베이터 (가면 안 됨)
box(2.4, 3, 0.3, 0xa7b0ba, 26.5, 1.5, 15.6, { metalness: 0.6, roughness: 0.3 });
label('🛗 엘리베이터', 26.5, 3.9, 15.2, { bg: '#64748b', fg: '#fff', scale: 0.7 });
const ELEV = { x: 26.5, z: 14.6 };
// 연기층 (일어서면 머리가 연기 속)
const smokeMat = new THREE.MeshStandardMaterial({ color: 0x5b5f66, transparent: true, opacity: 0, depthWrite: false });
const smoke = new THREE.Mesh(new THREE.BoxGeometry(17.6, 1.9, 15.6), smokeMat); smoke.position.set(21, 2.15, 8); scene.add(smoke);
const smokePuffs = [];
for (let i = 0; i < 40; i++) {
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.8, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6b7078, transparent: true, opacity: 0, depthWrite: false }));
  p.position.set(12.8 + Math.random() * 16.4, 1.8 + Math.random() * 1.2, 0.8 + Math.random() * 14.4); p.userData.ph = Math.random() * 6; scene.add(p); smokePuffs.push(p);
}
const alarm = new THREE.PointLight(0xff3030, 0, 30); alarm.position.set(21, 3.6, 8); scene.add(alarm);
const fireGlow = new THREE.Group(); fireGlow.position.set(14.5, 0, 1.6); scene.add(fireGlow);
const flames = [];
for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7a1a : 0xffc21a, transparent: true, opacity: 0.9 })); f.position.set((i % 3 - 1) * 0.5, 0.6, (i / 3 | 0) * 0.5 - 0.25); fireGlow.add(f); flames.push(f); }
fireGlow.visible = false;
solid(13.6, 15.4, 0.8, 2.4);

// ---------- 픽셀 소방차 (sprite-stacking 슬라이스 24장을 3D 로 쌓음) ----------
// 원본: assets/firetruck_slices.png (23x48 px 슬라이스 24장, 바닥이 왼쪽). 앞이 이미지 아래쪽 → 로컬 +z.
const TRUCK_N = 24, TPX = 0.16;                        // 1 아트픽셀 = 0.16 m
const truck = { g: new THREE.Group(), state: 'away', wp: [], v: 0, siren: null, t: 0 };
truck.g.visible = false; scene.add(truck.g);
new THREE.TextureLoader().load('assets/firetruck_slices.png', (tex) => {
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const sw = tex.image.width / TRUCK_N, sh = tex.image.height;
  const geo = new THREE.PlaneGeometry(sw * TPX, sh * TPX);
  for (let i = 0; i < TRUCK_N; i++) for (let k = 0; k < 2; k++) {   // 층 사이 틈을 메우려고 한 층에 두 장
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(1 / TRUCK_N, 1); t.offset.set(i / TRUCK_N, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05 + (i + k * 0.5) * TPX; truck.g.add(m);
  }
  const sh_ = new THREE.Mesh(new THREE.PlaneGeometry(sw * TPX * 1.05, sh * TPX * 1.02), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh_.rotation.x = -Math.PI / 2; sh_.position.set(0.25, 0.04, 0.35); truck.g.add(sh_);
});
const sirenL = new THREE.PointLight(0xff2030, 0, 14); sirenL.position.set(0, 4.5, 2); truck.g.add(sirenL);
function dispatchTruck() {
  if (truck.state !== 'away') return;
  truck.state = 'drive'; truck.g.visible = true; truck.v = 11;
  truck.g.position.set(-58, 0, -16);                    // 동쪽으로 가는 차선
  truck.wp = [new THREE.Vector3(34, 0, -16), new THREE.Vector3(34, 0, -4), new THREE.Vector3(34, 0, 3)];
}
function updateTruck(dt, time) {
  if (truck.state === 'away') return;
  const flash = Math.sin(time * 10) > 0;
  sirenL.color.setHex(flash ? 0xff2030 : 0x3060ff); sirenL.intensity = truck.state === 'drive' || S.mission === 'fire' ? 40 : 0;
  if (truck.state === 'drive') {
    if ((truck.t -= dt) <= 0) { truck.t = 0.9; beep(960, 0.4, 'triangle', 0.05); beep(720, 0.4, 'triangle', 0.05, 0.45); }
    const target = truck.wp[0], p = truck.g.position, d = target.clone().sub(p); d.y = 0;
    const dist = d.length(), last = truck.wp.length === 1;
    const v = last ? Math.min(truck.v, dist * 2 + 0.5) : truck.v;
    if (dist < 0.2) { truck.wp.shift(); if (!truck.wp.length) { truck.state = 'parked'; solid(p.x - 1.9, p.x + 1.9, p.z - 4, p.z + 4); } return; }
    p.addScaledVector(d.normalize(), Math.min(dist, v * dt));
    let want = Math.atan2(d.x, d.z), dr = want - truck.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    truck.g.rotation.y += dr * Math.min(1, dt * 6);
  }
}

// ---------- 건물: 지진 대피 교실 (x -30~-12, z 0~16) ----------
const QUAKE = { x0: -30, x1: -12, z0: 0, z1: 16 };
box(18, 0.1, 16, 0xd8b98c, -21, 0.05, 8, { noShadow: true });
wall(-30, 0, -12, 0, 0xcfe3f7); wall(-30, 16, -12, 16, 0xcfe3f7, 1.1); wall(-30, 0, -30, 16, 0xcfe3f7);
wall(-12, 0, -12, 6.5, 0xcfe3f7); wall(-12, 9.5, -12, 16, 0xcfe3f7); // 문 (동쪽, z 6.5~9.5)
label('🌏 지진 대피 교실', -21, 5.2, 0, { bg: '#7c3aed', fg: '#fff', scale: 1.2, w: 640 });
box(8, 2.2, 0.15, 0x2f5d3a, -21, 2, 0.35);                          // 칠판
const desks = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
  const x = -27 + c * 3.6, z = 4 + r * 3.4, g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.1), M(0xc8955a)); top.position.y = 1.05; top.castShadow = true; top.receiveShadow = true; g.add(top);
  for (const [lx, lz] of [[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), M(0x7a7f86)); l.position.set(lx, 0.5, lz); l.castShadow = true; g.add(l); }
  desks.push({ x, z, g });
}
const lights = [];
for (let i = 0; i < 3; i++) { const g = new THREE.Group(); g.position.set(-25 + i * 6, 3.6, 8); scene.add(g); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), M(0x333333)); cord.position.y = -0.4; g.add(cord); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 0.35, 16), M(0xfff3c4, { emissive: 0xfff3c4, emissiveIntensity: 0.5 })); b.position.y = -0.9; g.add(b); lights.push(g); }
// 운동장 (안전한 넓은 곳)
box(16, 0.06, 10, 0xd9a066, -21, 0.03, 26, { noShadow: true });
label('⚽ 운동장 (넓은 곳)', -21, 3, 26, { bg: '#f59e0b', fg: '#fff', scale: 0.9, w: 640 });
const FIELD = { x: -21, z: 26, r: 4 };

// 미션 시작 지점 고리
const rings = { road: ring(0, -7.2, 0xffd34d), fire: ring(9.5, 7.5, 0xff5533), quake: ring(-9.5, 8, 0x9f6bff) };
label('🚦 횡단보도 미션', 0, 3.2, -6.5, { bg: '#ffd34d', scale: 0.8 });
const fieldRing = ring(FIELD.x, FIELD.z, 0x22c55e); fieldRing.scale.setScalar(2.6); fieldRing.visible = false;
const goalRing = ring(0, -22.5, 0x22c55e); goalRing.scale.setScalar(1.6); goalRing.visible = false;

// ---------- 플레이어 ----------
function makeKid() {
  const g = new THREE.Group(); scene.add(g);
  const body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 14), M(0xff9f1c)); torso.position.y = 1.15; torso.castShadow = true; body.add(torso);
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.25, 14), M(0xd7ff3a, { emissive: 0x556600, emissiveIntensity: 0.3 })); vest.position.y = 1.3; body.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), M(0xffd9b8)); head.position.y = 1.95; head.castShadow = true; body.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffd34d)); hat.position.y = 2.0; body.add(hat);
  const eyeM = M(0x222222);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeM); e.position.set(s * 0.13, 1.98, 0.32); body.add(e); }
  const limb = (w, h, color) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), M(color)); m.position.y = -h / 2; m.castShadow = true; p.add(m); return p; };
  const legL = limb(0.2, 0.7, 0x2f5fb3), legR = limb(0.2, 0.7, 0x2f5fb3), armL = limb(0.16, 0.65, 0xffd9b8), armR = limb(0.16, 0.65, 0xffd9b8);
  legL.position.set(-0.15, 0.72, 0); legR.position.set(0.15, 0.72, 0); armL.position.set(-0.45, 1.5, 0); armR.position.set(0.45, 1.5, 0);
  body.add(legL, legR, armL, armR);
  return { g, body, legL, legR, armL, armR };
}
const kid = makeKid();
const player = { pos: new THREE.Vector3(0, 0, 14), face: Math.PI, crouch: false, walk: 0, speed: 0, frozen: 0 };
const SPAWN = new THREE.Vector3(0, 0, 14);

// ---------- 게임 상태 ----------
const S = { started: false, done: { road: false, fire: false, quake: false }, mission: null, phase: '', t: 0, smoke: 0, muted: Q.has('mute'), quiz: false };
window.S = S;

// ---------- 소리 (WebAudio) ----------
let ac = null;
function beep(freq = 660, dur = 0.12, type = 'sine', vol = 0.12, when = 0) {
  if (S.muted) return; try {
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
  tick: () => beep(1200, 0.04, 'square', 0.03),
  alarm: () => { beep(950, 0.22, 'sawtooth', 0.045); beep(700, 0.22, 'sawtooth', 0.045, 0.24); },
  rumble: () => beep(55, 0.5, 'sawtooth', 0.08),
};

// ---------- 안내 문구 ----------
let bannerT = 0;
function say(text, kind = '', sec = 3.2) {
  const b = $('banner'); b.innerHTML = text; b.className = 'show ' + kind; bannerT = sec;
}
function resetTo(x, z, face = Math.PI) { player.pos.set(x, 0, z); player.face = face; player.frozen = 0.6; }

// ---------- 퀴즈 ----------
const QUIZ = {
  road: { tag: '🚦 횡단보도 퀴즈', q: '초록불이 깜빡이기 시작하면<br>뛰어서 빨리 건너야 한다.', a: 'X', why: '깜빡일 때는 새로 건너지 말고 다음 초록불을 기다려요. 이미 건너는 중이면 서둘러 끝까지 건너요.' },
  fire: { tag: '🔥 화재 대피 퀴즈', q: '불이 나면 엘리베이터 대신<br>계단으로 대피한다.', a: 'O', why: '불이 나면 전기가 끊겨 엘리베이터에 갇힐 수 있어요. 젖은 수건으로 코와 입을 막고 계단으로 내려가요.' },
  quake: { tag: '🌏 지진 대피 퀴즈', q: '흔들림이 멈추면 건물 밖<br>넓은 곳(운동장)으로 대피한다.', a: 'O', why: '흔들릴 때는 책상 밑에서 머리를 보호하고, 멈추면 계단으로 나가 건물에서 먼 넓은 곳으로 가요.' },
};
let quizKey = null;
function openQuiz(k) {
  quizKey = k; S.quiz = true; const d = QUIZ[k];
  $('q-tag').textContent = d.tag; $('q-text').innerHTML = d.q; $('q-fb').textContent = ''; $('q-next').classList.add('hidden');
  document.querySelectorAll('.ox button').forEach((b) => (b.disabled = false));
  $('quiz').classList.remove('hidden');
}
document.querySelectorAll('.ox button').forEach((b) => b.addEventListener('click', () => {
  const d = QUIZ[quizKey], ok = b.dataset.a === d.a;
  $('q-fb').innerHTML = (ok ? '⭕ <b>정답이에요!</b> ' : `❌ <b>정답은 ${d.a}예요.</b> `) + d.why;
  ok ? sfx.good() : sfx.bad();
  document.querySelectorAll('.ox button').forEach((x) => (x.disabled = true));
  $('q-next').classList.remove('hidden');
}));
$('q-next').addEventListener('click', closeQuiz);
function closeQuiz() {
  $('quiz').classList.add('hidden'); S.quiz = false;
  if (S.done.road && S.done.fire && S.done.quake) showCert();
  else say('다음 미션 고리를 찾아가 보세요! ' + remaining(), '', 4);
}
function remaining() { return ['road', 'fire', 'quake'].filter((k) => !S.done[k]).map((k) => ({ road: '🚦', fire: '🔥', quake: '🌏' })[k]).join(' '); }
function complete(k, msg) {
  S.done[k] = true; S.mission = null; S.phase = '';
  $('m-' + k).classList.add('done'); $('m-' + k).classList.remove('active');
  rings[k].visible = false; sfx.good(); say(msg, 'good', 3);
  setTimeout(() => openQuiz(k), 1400);
}
function showCert() {
  $('cert-name').textContent = ($('name').value || '').trim() || '탐험대원';
  const d = new Date(); $('cert-date').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 · 안전 탐험대`;
  $('cert').classList.remove('hidden'); sfx.good();
}
$('again').addEventListener('click', () => location.reload());

// ---------- 미션 진행 ----------
function startMission(k) {
  S.mission = k; S.t = 0; S.phase = 'go';
  document.querySelectorAll('.m').forEach((m) => m.classList.remove('active')); $('m-' + k).classList.add('active');
  if (k === 'road') { goalRing.visible = true; say('길 건너 <b>학교</b>(초록 고리)로 가요.<br>신호등을 보고 <b>초록불</b>일 때 <b>횡단보도</b>로 건너요!', '', 5); }
  if (k === 'fire') { say('🚨 불이야! 연기가 천장에 가득해요.<br><b>Shift(몸 낮추기)</b>를 누른 채 초록 화살표를 따라 <b>비상구</b>로!', 'warn', 5.5); S.smoke = 0; fireGlow.visible = true; dispatchTruck(); $('meter').classList.remove('hidden'); $('meter-label').textContent = '연기 마심'; }
  if (k === 'quake') { S.phase = 'wait'; say('교실 안으로 들어가요. 곧 <b>지진 대피 훈련</b>이 시작돼요.', '', 4); }
}
let crossedOnGreen = false, quakeHide = 0;
function cancelMission() {   // 다른 미션 고리를 밟으면 하던 미션을 접는다
  if (!S.mission) return;
  goalRing.visible = fieldRing.visible = fireGlow.visible = false; $('meter').classList.add('hidden');
  $('m-' + S.mission).classList.remove('active'); S.mission = null; S.phase = '';
}
function updateMission(dt, sig) {
  const p = player.pos;
  // 시작 고리 밟기
  if (!S.quiz) for (const k of ['road', 'fire', 'quake']) if (S.mission !== k && !S.done[k] && rings[k].visible && p.distanceTo(rings[k].position.clone().setY(0)) < 1.6) { cancelMission(); startMission(k); }

  // 횡단보도: 빨간불 / 횡단보도 밖 / 차에 치일 뻔
  if (inRoad(p.x, p.z) && player.frozen <= 0) {
    const onCross = p.x > CROSS.x0 && p.x < CROSS.x1;
    if (!onCross) { sfx.whistle(); say('🙅 찻길을 함부로 건너면 위험해요!<br><b>횡단보도</b>로 건너요.', 'warn'); resetTo(p.x < 0 ? -4 : 4, -8.2); return; }
    if (!sig.pedGreen && !crossedOnGreen) { sfx.whistle(); say('🛑 <b>빨간불</b>이에요! 초록불이 켜질 때까지 기다려요.', 'warn'); resetTo(0, -8.2); return; }
    if (sig.pedGreen && sig.blink && !crossedOnGreen) { sfx.whistle(); say('⚠️ 초록불이 <b>깜빡이면</b> 새로 건너지 말고<br>다음 신호를 기다려요.', 'warn'); resetTo(0, -8.2); return; }
    crossedOnGreen = true;
    for (const c of cars) if (Math.abs(c.g.position.z - p.z) < 1.3 && Math.abs(c.g.position.x - p.x) < 2.3 && c.v > 1) { sfx.bad(); say('🚗 앗, 위험해요! 좌우를 잘 살피고 건너요.', 'warn'); crossedOnGreen = false; resetTo(0, -8.2); return; }
  } else if (p.z > ROAD.z1) crossedOnGreen = false;
  else if (p.z < ROAD.z0) crossedOnGreen = false;

  if (S.mission === 'road' && p.z < -21.2 && Math.abs(p.x) < 4) { goalRing.visible = false; complete('road', '🎉 횡단보도를 안전하게 건넜어요!'); }

  // 화재
  if (S.mission === 'fire') {
    const inside = p.x > FIRE.x0 && p.x < FIRE.x1 && p.z > FIRE.z0 && p.z < FIRE.z1;
    if (inside && !player.crouch) { S.smoke += dt * 22; if ((S.t += dt) > 1.2) { S.t = 0; say('😷 콜록콜록! 연기는 위로 올라가요.<br><b>Shift</b>로 몸을 낮춰요!', 'warn', 1.6); } }
    else S.smoke = Math.max(0, S.smoke - dt * 6);
    $('meter-fill').style.width = Math.min(100, S.smoke) + '%';
    if (S.smoke >= 100) { sfx.bad(); say('연기를 너무 많이 마셨어요. 처음부터 다시!<br>입과 코를 막고 <b>낮은 자세</b>로 움직여요.', 'warn', 4); S.smoke = 0; resetTo(10.5, 7.5, Math.PI / 2); }
    if (Math.hypot(p.x - ELEV.x, p.z - ELEV.z) < 1.4 && player.frozen <= 0) { sfx.bad(); say('🛗 불이 나면 <b>엘리베이터는 타면 안 돼요!</b><br>정전되면 갇힐 수 있어요. 비상구 계단으로!', 'warn', 4); resetTo(26.5, 11.5, -Math.PI / 2); }
    if (p.x > FIRE.x1 + 0.8) { fireGlow.visible = false; $('meter').classList.add('hidden'); complete('fire', '🎉 연기를 피해 비상구로 무사히 대피했어요!'); }
  }

  // 지진
  if (S.mission === 'quake') {
    const inside = p.x > QUAKE.x0 && p.x < QUAKE.x1 && p.z > QUAKE.z0 && p.z < QUAKE.z1;
    const under = desks.find((d) => Math.abs(d.x - p.x) < 1.0 && Math.abs(d.z - p.z) < 0.75);
    if (S.phase === 'wait' && inside && p.x < -14) { S.phase = 'pre'; S.t = 0; say('📢 지진 대피 훈련을 시작합니다. 잠시 후 흔들려요!', '', 2.5); }
    else if (S.phase === 'pre' && (S.t += dt) > 2.5) { S.phase = 'shake'; S.t = 0; quakeHide = 0; sfx.rumble(); say('🌏 흔들려요! <b>책상 밑</b>으로 들어가<br><b>Shift</b>로 몸을 낮추고 머리를 보호해요!', 'warn', 5); }
    else if (S.phase === 'shake') {
      S.t += dt; if (Math.random() < dt * 3) sfx.rumble();
      if (under && player.crouch) quakeHide += dt;
      if (S.t > 5 && quakeHide < 1.5) { sfx.bad(); say('💥 위에서 물건이 떨어질 수 있어요!<br>흔들리면 바로 <b>책상 밑</b>에 숨어요. 다시!', 'warn', 4); S.phase = 'pre'; S.t = 0; resetTo(-14, 8, -Math.PI / 2); }
      else if (S.t > 9) { S.phase = 'out'; fieldRing.visible = true; say('흔들림이 멈췄어요! 이제 건물 밖<br><b>운동장</b>(초록 고리)으로 대피해요. 🏃', 'good', 5); }
      else $('meter-fill').style.width = Math.min(100, quakeHide / 3 * 100) + '%';
    } else if (S.phase === 'out' && Math.hypot(p.x - FIELD.x, p.z - FIELD.z) < FIELD.r) { fieldRing.visible = false; complete('quake', '🎉 지진 대피 성공! 넓은 운동장으로 잘 왔어요.'); }
    $('meter').classList.toggle('hidden', S.phase !== 'shake'); $('meter-label').textContent = '책상 밑에서 버티기';
  }
}

// ---------- 플레이어 이동 ----------
const camTarget = new THREE.Vector3();
function updatePlayer(dt) {
  player.crouch = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC') || touch.crouch;
  let mx = 0, mz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  mx += touch.x; mz += touch.y;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  if (player.frozen > 0 || S.quiz || !S.started) { player.frozen -= dt; mx = mz = 0; }
  const maxV = player.crouch ? 2.6 : 5.2;
  const v = Math.min(1, Math.hypot(mx, mz)) * maxV;
  if (v > 0.05) {
    player.face = Math.atan2(mx, mz);
    const step = v * dt, dx = Math.sin(player.face) * step, dz = Math.cos(player.face) * step;
    const p = player.pos;
    if (!blocked(p.x + dx, p.z)) p.x += dx;        // 축을 나눠 벽을 미끄러지듯
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    player.walk += step * 2.4;
  }
  player.speed = v;
  // 모습
  kid.g.position.copy(player.pos);
  let dr = player.face - kid.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); kid.g.rotation.y += dr * Math.min(1, dt * 14);
  const sw = v > 0.05 ? Math.sin(player.walk) * 0.7 : 0;
  kid.legL.rotation.x = sw; kid.legR.rotation.x = -sw; kid.armL.rotation.x = -sw * 0.8; kid.armR.rotation.x = sw * 0.8;
  const cs = player.crouch ? 0.58 : 1; kid.body.scale.y += (cs - kid.body.scale.y) * Math.min(1, dt * 12);
  // 몸을 낮추면 팔로 머리를 감싼다
  if (player.crouch) { kid.armL.rotation.x = kid.armR.rotation.x = -2.6; kid.armL.rotation.z = 0.5; kid.armR.rotation.z = -0.5; } else { kid.armL.rotation.z = kid.armR.rotation.z = 0; }
}

// ---------- 카메라 ----------
const shake = { a: 0 };
function updateCamera(dt) {
  camTarget.lerp(player.pos, Math.min(1, dt * 5));
  const portrait = innerWidth < innerHeight;
  const off = portrait ? new THREE.Vector3(0, 22, 19) : new THREE.Vector3(0, 19, 16);
  camera.position.copy(camTarget).add(off);
  if (shake.a > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake.a, (Math.random() - 0.5) * shake.a * 0.5, (Math.random() - 0.5) * shake.a));
  camera.lookAt(camTarget.x, 0.8, camTarget.z);
  sun.position.set(camTarget.x + 18, 30, camTarget.z + 14); sun.target.position.copy(camTarget);
}

// ---------- 신호등 표시 ----------
let lastLeft = -1;
function updateSignals(sig, time) {
  const pedOn = sig.pedGreen && !(sig.blink && Math.sin(time * 12) < 0);
  for (const s of peds) { s.green.material.emissiveIntensity = pedOn ? 2.2 : 0; s.red.material.emissiveIntensity = sig.pedGreen ? 0 : 2.2; }
  for (const s of carSigs) { s.red.material.emissiveIntensity = sig.car === 'red' ? 2.2 : 0; s.yel.material.emissiveIntensity = sig.car === 'yellow' ? 2.2 : 0; s.green.material.emissiveIntensity = sig.car === 'green' ? 2.2 : 0; }
  if (S.mission === 'road' && sig.pedGreen) { const l = Math.ceil(sig.left); if (l !== lastLeft) { lastLeft = l; if (Math.abs(player.pos.z + 9) < 4) sfx.tick(); } }
}

// ---------- 효과 ----------
function updateFx(dt, time) {
  for (const k in rings) { const r = rings[k]; r.material.opacity = 0.5 + Math.sin(time * 4) * 0.25; r.scale.setScalar(1 + Math.sin(time * 3) * 0.06); }
  fieldRing.material.opacity = goalRing.material.opacity = 0.55 + Math.sin(time * 5) * 0.3;
  const fireOn = S.mission === 'fire';
  smokeMat.opacity += ((fireOn ? 0.42 : 0) - smokeMat.opacity) * Math.min(1, dt * 2);
  for (const p of smokePuffs) { p.material.opacity = smokeMat.opacity * 0.4; p.position.y = 2.3 + Math.sin(time * 0.8 + p.userData.ph) * 0.35; }
  alarm.intensity = fireOn ? (Math.sin(time * 8) > 0 ? 60 : 0) : 0;
  if (fireOn && Math.sin(time * 4) > 0.97) sfx.alarm();
  flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(time * 14 + i * 1.7) * 0.3; f.rotation.y = time * 2; });
  const quaking = S.mission === 'quake' && S.phase === 'shake';
  shake.a += ((quaking ? 0.45 : 0) - shake.a) * Math.min(1, dt * 4);
  desks.forEach((d, i) => { d.g.position.x = d.x + (quaking ? Math.sin(time * 30 + i) * 0.06 : 0); d.g.rotation.y = quaking ? Math.sin(time * 22 + i * 2) * 0.04 : 0; });
  lights.forEach((l, i) => { l.rotation.z = quaking ? Math.sin(time * 9 + i) * 0.35 : l.rotation.z * 0.95; });
}

// ---------- 메인 루프 ----------
let time = 0, last = performance.now();
const dbg = debugPanel(() => { const p = player.pos; const s = signalState(); return `pos ${p.x.toFixed(1)}, ${p.z.toFixed(1)}  crouch ${player.crouch}\nmission ${S.mission} ${S.phase}  smoke ${S.smoke.toFixed(0)}\nsignal ped ${s.pedGreen ? 'G' : 'R'}${s.blink ? '(blink)' : ''} car ${s.car}  cars ${cars.length}`; });
function frame(dt) {
  time += dt; sigT += dt;
  const sig = signalState();
  updatePlayer(dt); updateCars(dt, sig);
  if (S.started) updateMission(dt, sig);
  updateSignals(sig, time); updateFx(dt, time); updateTruck(dt, time); updateCamera(dt);
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  renderer.render(scene, camera); endFrame(); dbg();
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!document.hidden) frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- 시작 ----------
function start() {
  if (S.started) return;
  S.started = true; $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  beep(1, 0.01, 'sine', 0.0001);                      // 오디오 잠금 해제
  say('🦺 안전 탐험대 출동! 바닥의 <b>빛나는 고리</b>를 밟으면 미션이 시작돼요.', '', 5);
}
$('start').disabled = false; $('start').textContent = '탐험 시작!';
$('start').addEventListener('click', start);
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
if (Q.has('auto')) start();

// ---------- 테스트 훅 ----------
window.G = {
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(dt); },
  tp: (x, z) => { player.pos.set(x, 0, z); camTarget.set(x, 0, z); },
  hold: (...c) => c.forEach((k) => keys.add(k)), release: (...c) => c.forEach((k) => keys.delete(k)),
  sig: () => signalState(), setSig: (t) => { sigT = t; },
  truck: () => ({ state: truck.state, x: +truck.g.position.x.toFixed(1), z: +truck.g.position.z.toFixed(1), kids: truck.g.children.length }),
  state: () => ({ x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), crouch: player.crouch, mission: S.mission, phase: S.phase, done: { ...S.done }, smoke: Math.round(S.smoke), quiz: S.quiz, cars: cars.length, banner: $('banner').textContent }),
  quiz: (a) => { if (!S.quiz) return 'no quiz'; document.querySelector(`.ox button[data-a="${a}"]`).click(); $('q-next').click(); },
};
