#!/usr/bin/env python3
"""송명편 main.js → 가현초편 gahyeon/main.js (좌표·이름만 바꿔 만든다). 송명편을 고친 뒤 다시 돌리면 된다."""
import os, re, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
s = open(os.path.join(ROOT, 'main.js')).read()
R = []
def r(old, new, n=1):
    R.append((old, new, n))

# ---- 경로 ----
r("import { keys, pressed, touch, pinch, endFrame, debugPanel } from './input.js';", "import { keys, pressed, touch, pinch, endFrame, debugPanel } from '../input.js';")
r("fetch('data/songmyeong_grid.json')", "fetch('../data/gahyeon_grid.json')")
r("fetch('sprites/manifest.json')", "fetch('../sprites/manifest.json')")
r("loader.load('sprites/' + n", "loader.load('../sprites/' + n")
r("const names = Object.keys(MAN).filter((n) => !/^bld_gahyeon/.test(n)); let done = 0;", "const names = Object.keys(MAN).filter((n) => !/^bld_(songmyeong|cheomdan|neunghuh)/.test(n)); let done = 0;")
r("// 송명 안전 탐험대 — 인천송명초 둘레 실제 지도(OSM)", "// 가현 안전 탐험대 — 인천가현초 둘레 실제 지도(OSM, 180도 돌려 학교가 큰길 위쪽)")
# ---- 횡단보도 ----
r("{ id: 'S', x0: 46, x1: 47, y0: 35, y1: 37, axis: 'v', off: 0, name: '송명초 정문 앞 횡단보도' }", "{ id: 'S', x0: 41, x1: 42, y0: 35, y1: 37, axis: 'v', off: 0, name: '가현초 정문 앞 횡단보도' }")
r("{ id: 'E', x0: 70, x1: 71, y0: 35, y1: 37, axis: 'v', off: 9, name: '능허대중 앞 횡단보도' }", "{ id: 'E', x0: 65, x1: 66, y0: 35, y1: 37, axis: 'v', off: 9, name: '루원시티 앞 횡단보도' }")
r("name: '상가 앞 횡단보도' }", "name: '상가 앞 횡단보도(염곡로)' }")
r("const PARK = { x0: 63, x1: 72, y0: 41, y1: 49 };                // 근린공원 놀이터", "const PARK = { x0: 38, x1: 47, y0: 47, y1: 55 };                // 오리 놀이터(루에블리)")
# ---- 지면: 운동장 트랙 (가현초 운동장 x24~38, y18~25) ----
old_track = s[s.index("  const track = (r, col, lw)"):s.index("  // 주차장 출입구 정지선")]
r(old_track, """  const track = (r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(28 * P, (21.6 - r) * P); g.lineTo(34 * P, (21.6 - r) * P); g.arc(34 * P, 21.6 * P, r * P, -Math.PI / 2, Math.PI / 2); g.lineTo(28 * P, (21.6 + r) * P); g.arc(28 * P, 21.6 * P, r * P, Math.PI / 2, Math.PI * 1.5); g.stroke(); };
  track(3.0, '#c8624a', 1.2 * P); for (const r of [2.45, 2.85, 3.25, 3.65]) track(r, 'rgba(255,255,255,.85)', 1.5);
  g.fillStyle = '#7fb85a'; g.beginPath(); g.moveTo(28 * P, 19.2 * P); g.lineTo(34 * P, 19.2 * P); g.arc(34 * P, 21.6 * P, 2.4 * P, -Math.PI / 2, Math.PI / 2); g.lineTo(28 * P, 24 * P); g.arc(28 * P, 21.6 * P, 2.4 * P, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.strokeRect(27.2 * P, 19.9 * P, 7.6 * P, 3.4 * P); g.beginPath(); g.moveTo(31 * P, 19.9 * P); g.lineTo(31 * P, 23.3 * P); g.stroke(); g.beginPath(); g.arc(31 * P, 21.6 * P, 0.8 * P, 0, 7); g.stroke();
  // 정문 앞 승하차 구역(노란 지그재그)
  g.strokeStyle = '#ffd34d'; g.lineWidth = 2; g.beginPath(); for (let x = 46; x <= 56; x += 0.5) g.lineTo(x * P, 35 * P + (((x * 2) | 0) % 2 ? 3 : 8)); g.stroke();
""")
# ---- 건물 스프라이트 ----
r("const SPRITE_BLDG = ['b', 'c', '\\x92'];", "const SPRITE_BLDG = ['b', 'c', 'm'];")
r("""  for (let y = 13; y <= 16; y++) for (let x = 72; x <= 83; x++) blocks[y * W + x] = 1;      // 능허대중 교사 (OSM에 모양 없음)
  for (const n of ['bld_songmyeong', 'bld_songmyeong_gym', 'bld_cheomdan', 'bld_neunghuh']) {""", """  for (const n of ['bld_gahyeon', 'bld_gahyeon_gym', 'bld_gahyeon_mid']) {""")
# ---- 소품 ----
r("const sf = [];\n  for (let x = 24; x < W - 2; x += 3) { if (Math.abs(x - 46.5) < 4 || Math.abs(x - 70.5) < 4 || Math.abs(x - 77) < 4) continue;",
  "const sf = [];\n  for (let x = 24; x < W - 2; x += 3) { if (Math.abs(x - 41.5) < 4 || Math.abs(x - 65.5) < 4 || Math.abs(x - 72) < 4 || (x > 45 && x < 57)) continue;")
r("prop('sign_school', 43.5, 34.1, 0, 0.3); prop('sign_30', 51, 38.9, Math.PI, 0.3); prop('cctv', 49.6, 34.1, 0, 0.3); prop('crosswalk_sign', 45.2, 38.9, Math.PI, 0.3);\n  prop('crosswalk_sign', 69.2, 34.1, 0, 0.3);",
  "prop('sign_school', 38.5, 34.1, 0, 0.3); prop('sign_30', 46, 38.9, Math.PI, 0.3); prop('cctv', 44.6, 34.1, 0, 0.3); prop('crosswalk_sign', 40.2, 38.9, Math.PI, 0.3);\n  prop('crosswalk_sign', 64.2, 34.1, 0, 0.3); prop('drop_off_sign', 51, 34.15, 0, 0.3); prop('sign_school', 23.9, 30, -Math.PI / 2, 0.3);")
r("""  // 송명초 정문
  prop('school_gate', 47, 33.2, 0, 0); colliders.push({ x: wx(44.2), z: wz(33.2), r: 1.2 }, { x: wx(49.8), z: wz(33.2), r: 1.2 });
  label('🏫 인천송명초등학교', wx(47), 15, wz(15.5), { bg: '#2f7de1', fg: '#fff', scale: 1.4 });
  prop('soccer_goal', 43.2, 26.5, Math.PI / 2, 0); prop('soccer_goal', 52.8, 26.5, -Math.PI / 2, 0);
  prop('hoop', 55, 23, -Math.PI / 2, 0.5);""", """  // 가현초 정문 · 표지석 · 화단
  prop('school_gate', 42, 33.2, 0, 0); colliders.push({ x: wx(39.2), z: wz(33.2), r: 1.2 }, { x: wx(44.8), z: wz(33.2), r: 1.2 });
  prop('school_stone', 37.6, 33.1, 0, 0.9); prop('flower_bed', 35.4, 33.4, 0, 0); prop('flower_bed', 26.2, 33.4, 0, 0);
  label('🏫 인천가현초등학교', wx(30), 15, wz(28.5), { bg: '#2fa84f', fg: '#fff', scale: 1.4 });
  prop('soccer_goal', 26.4, 21.6, Math.PI / 2, 0); prop('soccer_goal', 35.6, 21.6, -Math.PI / 2, 0);
  prop('hoop', 38.2, 25.0, -Math.PI / 2, 0.5);""")
r("""  prop('bus_shelter', 77, 33.4, Math.PI, 0); colliders.push({ x: wx(77), z: wz(33.2), r: 2.2 }); prop('busstop_sign', 79.6, 34.2, Math.PI, 0.3);
  label('🚌 송명초·능허대중 정류장', wx(77), 6, wz(33), { bg: '#2fa84f', fg: '#fff', scale: 0.8 });""", """  prop('bus_shelter', 72, 33.4, Math.PI, 0); colliders.push({ x: wx(72), z: wz(33.2), r: 2.2 }); prop('busstop_sign', 74.6, 33.55, Math.PI, 0.3);
  label('🚌 가현초·루원시티 정류장', wx(72), 6, wz(33), { bg: '#2fa84f', fg: '#fff', scale: 0.8 });""")
r("prop('van', 27.4, 30.4, 0, 1.6);", "prop('van', 23.0, 28.6, 0, 1.6);")
r("""  label('🛝 근린공원 놀이터', wx(67.5), 6, wz(41.2), { bg: '#f59e0b', fg: '#fff', scale: 0.85 });
  playground.slide = prop('slide', 66, 44.2, 0, 0.6); playground.swing = prop('swing', 70.3, 43.5, 0, 0);
  colliders.push({ x: wx(68.9), z: wz(43.5), r: 0.5 }, { x: wx(71.8), z: wz(43.5), r: 0.5 });
  playground.seesaw = prop('seesaw', 70.5, 47.6, Math.PI / 2, 0.8); prop('bench', 64.5, 48.6, 0, 1); prop('bench', 61, 45, Math.PI / 2, 1);""",
"""  label('🛝 오리 놀이터', wx(42.5), 6, wz(47.2), { bg: '#f59e0b', fg: '#fff', scale: 0.85 });
  playground.slide = prop('slide', 41, 50.2, 0, 0.6); playground.swing = prop('swing', 45.3, 49.5, 0, 0);
  colliders.push({ x: wx(43.9), z: wz(49.5), r: 0.5 }, { x: wx(46.8), z: wz(49.5), r: 0.5 });
  playground.seesaw = prop('seesaw', 45.5, 53.6, Math.PI / 2, 0.8); prop('bench', 39.5, 54.6, 0, 1); prop('bench', 36.4, 51, Math.PI / 2, 1);
  for (const [x, y, a] of [[39.2, 48.4, 0.3], [40.2, 52.6, -0.4], [38.9, 51.2, 1.2]]) { sprite('duck_spring', wx(x), wz(y), a, { shadow: false, scale: 2 }); colliders.push({ x: wx(x), z: wz(y), r: 0.6 }); }
  prop('fountain', 36.2, 56.2, 0, 1.4); label('⛲ 루에블리 분수대', wx(36.2), 5, wz(56.2), { bg: '#5bc0eb', fg: '#fff', scale: 0.65 });
  prop('waterwheel', 48.4, 40.4, 0, 1.4); label('💧 수차공원', wx(48.4), 6, wz(40.2), { bg: '#3f8f5a', fg: '#fff', scale: 0.7 });""")
r("prop('planter', 59, 41.2, 0, 1.2); prop('bike_rack', 57.5, 42.2, 0, 1.6);", "prop('planter', 59, 41.2, 0, 1.2); prop('bike_rack', 58.5, 43.2, 0, 1.6);")
r("""  label('🏠 우리 집 (송도 더샵 그린스퀘어)', wx(46.5), 5, wz(65.2), { bg: '#ffffff', scale: 0.85 });""", """  label('🏠 우리 집 (루원시티 루에블리)', wx(46.5), 5, wz(65.2), { bg: '#ffffff', scale: 0.85 });
  prop('apt_gate', 55.2, 41.6, 0, 0); label('🏢 루원시티 루에블리', wx(55.2), 9, wz(41.6), { bg: '#6b5a48', fg: '#fff', scale: 0.8 });
  prop('apt_gate', 59.6, 32.4, Math.PI, 0); label('🏢 루원시티 센트럴타운', wx(59.6), 9, wz(32.4), { bg: '#6b5a48', fg: '#fff', scale: 0.8 });""")
r("""  label('🏫 첨단초등학교', wx(48), 12, wz(47), { bg: '#7c3aed', fg: '#fff', scale: 1.1 });
  label('🏫 능허대중학교', wx(77.5), 6, wz(12), { bg: '#7c3aed', fg: '#fff', scale: 1.1 });""", """  label('🏫 가현중학교', wx(34), 12, wz(5.5), { bg: '#7c3aed', fg: '#fff', scale: 1.1 });""")
r("[[45, 38.6], [48, 38.6], [69, 38.6], [72, 38.6], [45, 34.4], [48, 34.4]]", "[[40, 38.6], [43, 38.6], [64, 38.6], [67, 38.6], [40, 34.4], [43, 34.4], [46, 34.4], [56, 34.4]]")
old_yard = s[s.index("  // ---- 송명초 운동장 ----"):s.index("  // ---- 정문 앞 옐로카펫")]
r(old_yard, """  // ---- 가현초 운동장 (본관 북쪽) ----
  prop('stage', 31, 25.3, Math.PI, 2.2); prop('flagpoles', 25.2, 25.2, 0, 1.0); prop('statue', 36.9, 25.3, 0, 0.8);
  prop('bleachers', 28.5, 17.6, Math.PI, 0); prop('bleachers', 33.5, 17.6, Math.PI, 0); for (let x = 26.5; x <= 35.5; x += 1) colliders.push({ x: wx(x), z: wz(17.5), r: 1.0 });
  prop('pullup_bars', 24.8, 19.6, Math.PI / 2, 1.0); prop('jungle_gym', 41.5, 29.6, 0, 1.6); prop('garden', 25.8, 29.2, 0, 2.0); prop('pavilion', 43.4, 26.4, 0, 2.0);
  prop('shoe_rack', 35.6, 32.2, 0, 0.8); prop('bike_rack', 36.8, 30.4, 0, 1.2); prop('school_bus', 44.2, 30.8, Math.PI, 0); colliders.push({ x: wx(44.2), z: wz(30), r: 1.2 }, { x: wx(44.2), z: wz(31.6), r: 1.2 });
  for (const [x, y] of [[25.3, 18.9], [36.7, 18.9], [25.3, 24.3], [36.7, 24.3]]) prop('track_marker', x, y, 0, 0.2);
  label('🏃 가현초 운동장', wx(31), 4, wz(24.3), { bg: '#ffffff', scale: 0.7 });
  label('🏀 체육관', wx(42), 11, wz(21), { bg: '#3f8f5a', fg: '#fff', scale: 0.8 });
""")
r("prop('yellow_carpet', 44.7, 39.1, 0, 0); prop('yellow_carpet', 49.3, 33.9, Math.PI, 0);", "prop('yellow_carpet', 39.7, 39.1, 0, 0); prop('yellow_carpet', 44.3, 33.9, Math.PI, 0);")
r("""  prop('shop_cafe', 23.6, 19.4, -Math.PI / 2, 0); prop('shop_academy', 23.6, 22.2, -Math.PI / 2, 0); prop('shop_pharmacy', 15.6, 28.5, Math.PI / 2, 0);""",
  """  prop('shop_cafe', 16.4, 26.4, Math.PI / 2, 0); prop('shop_academy', 16.4, 28.6, Math.PI / 2, 0);""")
r("""label('☕ 카페', wx(23.2), 6.6, wz(19.4), { bg: '#7a4f2a', fg: '#fff', scale: 0.6 }); label('📚 영어·수학 학원', wx(23.2), 6.6, wz(22.2), { bg: '#5b8def', fg: '#fff', scale: 0.6 });""",
  """label('☕ 카페', wx(17), 6.6, wz(26.4), { bg: '#7a4f2a', fg: '#fff', scale: 0.6 }); label('📚 영어·수학 학원', wx(17), 6.6, wz(28.6), { bg: '#5b8def', fg: '#fff', scale: 0.6 });""")
r("prop('outdoor_gym', 58.6, 47.6, 0, 1.6);", "prop('outdoor_gym', 58.6, 48.6, 0, 1.6);")
r("""prop('apt_entrance', 30.5, 29.95, 0, 0); prop('school_door', 40.55, 16.5, -Math.PI / 2, 0); prop('school_door', 42.2, 20.95, 0, 0); prop('school_door', 49.65, 19.5, Math.PI / 2, 0); prop('school_door', 52.5, 16.75, 0, 0);""",
  """prop('apt_entrance', 40, 43.95, Math.PI, 0); prop('school_door', 34.4, 32.65, 0, 0); prop('school_door', 27, 25.95, Math.PI, 0); prop('school_door', 35.05, 26.6, Math.PI / 2, 0); prop('school_door', 41.5, 23.85, 0, 0);""")
r("prop('pavilion', 75, 47.5, 0, 2.0); prop('bench', 72.6, 45.5, Math.PI / 2, 1);", "prop('pavilion', 50.4, 53.6, 0, 2.0); prop('bench', 48.6, 51.5, Math.PI / 2, 1);")
r("""  // ---- 첨단초 앞마당 ----
  prop('flagpoles', 51.6, 55.8, 0, 1.0); prop('statue', 44.6, 55.8, 0, 0.8); prop('garden', 41.6, 59.2, 0, 2.0); prop('pullup_bars', 54.4, 59.6, Math.PI / 2, 1.0); prop('bench', 47, 59.8, 0, 1); prop('bike_rack', 49.5, 59.8, 0, 1.2);""",
  """  // ---- 루에블리 단지 산책길 ----
  prop('garden', 52, 60.8, 0, 2.0); prop('bench', 49, 59.6, 0, 1); prop('bike_rack', 53.2, 57.4, 0, 1.2); prop('flower_bed', 44.5, 61.2, 0, 0); prop('stroller', 50.6, 62.2, 0.5, 0.4);""")
# ---- 2차: 동네 생활 소품 ----
r("  placeSchoolSprites();\n}", """  // ---- 동네 생활 소품 (가현초편 2차) ----
  const D = (n, x, y, rot = 0, c = 0, sc = 1) => { const g = sprite(n, wx(x), wz(y), rot, { shadow: false, scale: sc }); if (c) colliders.push({ x: g.position.x, z: g.position.z, r: c }); return g; };
  D('shade_canopy', 44.2, 38.55, 0, 0.3); D('shade_canopy', 63.4, 38.55, 0, 0.3); D('shade_canopy', 37.0, 33.75, 0, 0);
  D('bus_info', 69.6, 33.7, 0, 0.3);
  for (const [x, y, a] of [[76.6, 33.7, 0.2], [77.3, 33.75, -0.1], [47.4, 33.7, 0.3], [24.3, 34.4, 1.5]]) D('shared_kick', x, y, a, 0.2);
  D('bungeoppang', 13.4, 23.2, Math.PI / 2, 1.2); label('🐟 붕어빵', wx(13.4), 4.4, wz(23.2), { bg: '#c8623a', fg: '#fff', scale: 0.55 });
  D('parasol_table', 6.7, 33.6, 0, 1.0); D('parasol_table', 8.5, 33.6, 0.4, 1.0);
  D('clothes_bin', 37.7, 62.5, 0, 0.5); D('clothes_bin', 10.3, 45.6, Math.PI / 2, 0.5);
  D('ev_charger', 57.6, 62.6, 0, 0.4); D('ev_charger', 58.6, 62.6, 0, 0.4); D('car_white', 57.6, 61.5, 0, 0); D('car_blue', 58.6, 61.5, 0, 0);
  D('delivery_bike', 16.7, 12.0, 0.2, 0.5); D('delivery_bike', 41.9, 42.8, -0.3, 0.5);
  for (const [x, y, a] of [[26.6, 64.9, 1], [47.7, 39.4, -0.5], [8.4, 23.6, 2]]) D('cat', x, y, a, 0, 1.4);
  for (const [x, y, a] of [[46.4, 40.7, 0], [47.0, 41.2, 2], [50.4, 39.6, 1], [45.6, 34.6, 3], [36.0, 34.6, 4]]) D('pigeon', x, y, a, 0, 1.4);
  for (const [x, y] of [[44.0, 41.2], [52.4, 41.2], [50.8, 41.3], [37.0, 48.0], [37.2, 53.4], [48.2, 46.6]]) D('tree_cherry', x, y, hash(x, y) * 6, 0.9);
  for (const [x, y] of [[24.5, 22.2], [24.5, 24.0], [25.2, 9.5], [25.2, 12.5], [42.5, 10.5], [42.5, 13.5], [44.6, 19.0]]) D('tree_pine', x, y, hash(y, x) * 6, 0.9);
  for (const x of [26.4, 30.6, 34.8]) D('hedge', x, 39.3, 0, 0); for (const x of [41.6, 50.8]) D('hedge', x, 61.6, 0, 0);
  D('banner', 28.2, 33.6, 0, 0.3);
  for (const [x, y] of [[30, 34.5], [55, 38.5], [61, 34.5], [19.5, 31], [20.5, 45], [72, 38.5]]) D('manhole', x, y, 0, 0);
  D('speed_bump', 59.5, 28.5, Math.PI / 2, 0); D('speed_bump', 55, 24.5, 0, 0); D('speed_bump', 79, 20.5, Math.PI / 2, 0);
  for (const [x, y] of [[37.3, 47.3], [52.6, 34.4], [47.6, 56.0], [16.8, 33.5]]) D('safety_bell', x, y, 0, 0.3);
  for (const [x, y, a] of [[37.9, 31.0, 0.1], [38.5, 31.0, -0.1], [39.1, 31.0, 0]]) D('kid_bike', x, y, a, 0);
  label('🔔 안심 비상벨', wx(37.3), 4.2, wz(47.3), { bg: '#e2463b', fg: '#fff', scale: 0.5 });
  placeSchoolSprites();
}""")
# ---- 차선 ----
r("E: { axis: 'x', dir: 1, c: 37.2, from: 23, to: 92, stops: [['S', 45.5], ['E', 69.5]] }", "E: { axis: 'x', dir: 1, c: 37.2, from: 23, to: 92, stops: [['S', 40.5], ['E', 64.5]] }")
r("Wb: { axis: 'x', dir: -1, c: 35.8, from: 92, to: 17, stops: [['E', 72.5], ['S', 48.5]] }", "Wb: { axis: 'x', dir: -1, c: 35.8, from: 92, to: 17, stops: [['E', 67.5], ['S', 43.5]] }")
r("const ahead = (78.5 - front) * L.dir;", "const ahead = (73.5 - front) * L.dir;")
r("// 우측 통행: 교육로 동쪽행", "// 우측 통행: 봉오재1로 동쪽행")
# ---- 미션 ----
r("npc: ['guard', 'guard_0', 45.2, 39.6, Math.PI]", "npc: ['guard', 'guard_0', 40.2, 39.6, Math.PI]")
r("여기는 송명초 정문 앞 어린이 보호구역이야.", "여기는 가현초 정문 앞 어린이 보호구역이야.")
r("start() { goal = [47, 31.8, 1.6]; }, update() { if (near(47, 31.8, 1.8)) finish(); } }", "start() { goal = [42, 31.4, 1.6]; }, update() { if (near(42, 31.4, 1.8)) finish(); } }")
r("npc: ['student', 'student_0', 79.8, 33.2, Math.PI]", "npc: ['student', 'student_0', 75.4, 32.8, Math.PI]")
r("그럼 능허대중 앞 횡단보도로 건너서", "그럼 루원시티 앞 횡단보도로 건너서")
r("spawnCar('Wb', 'bus', { at: 82, speed: 0, special: 'bus' })", "spawnCar('Wb', 'bus', { at: 77, speed: 0, special: 'bus' })")
r("goal = [76, 39.6, 1.6]; },\n    update() { if (player.ty > 38.4 && player.tx > 66 && player.tx < 84 && near(76, 39.6, 3)) finish(); } }",
  "goal = [71, 39.6, 1.6]; },\n    update() { if (player.ty > 38.4 && player.tx > 61 && player.tx < 79 && near(71, 39.6, 3)) finish(); } }")
r("npc: ['bro', 'bro_0', 40.5, 39.6, Math.PI / 2]", "npc: ['bro', 'bro_0', 57.6, 39.6, Math.PI / 2]")
r("내 킥보드 빌려줄게! 근린공원 놀이터까지 타고 가 볼래?", "내 킥보드 빌려줄게! 단지 산책길 따라 오리 놀이터까지 타고 가 볼래?")
r("start() { items.helmet = sprite('helmet', wx(41.6), wz(40.5)); goal = [41.6, 40.5, 1.0]; spawnWalkerFor('grandma', [[52, 38.7], [44, 38.7]], 1.1); spawnWalkerFor('mom', [[60, 39.4], [50, 39.4]], 1.3); },",
  "start() { items.helmet = sprite('helmet', wx(58.8), wz(40.6)); goal = [58.8, 40.6, 1.0]; spawnWalkerFor('grandma', [[55.3, 41.5], [55.3, 46.5]], 1.1); spawnWalkerFor('mom', [[53.5, 47.4], [49.5, 47.4]], 1.3); },")
r("if (items.helmet && near(41.6, 40.5, 1.2))", "if (items.helmet && near(58.8, 40.6, 1.2))")
r("goal = [63.5, 41.2, 1.6]; }", "goal = [48.6, 48.2, 1.6]; }")
r("if (player.ride && near(63.5, 41.2, 1.8))", "if (player.ride && near(48.6, 48.2, 1.8))")
r("npc: ['friend', 'friend_0', 68.6, 49.6, Math.PI]", "npc: ['friend', 'friend_0', 43.6, 56.2, Math.PI]")
r("start() { goal = [66, 42.9, 0.9]; playStage = 0; swingOn = true; },", "start() { goal = [41, 48.9, 0.9]; playStage = 0; swingOn = true; },")
r("if (playStage === 0 && near(66, 42.9, 1.0)) { playStage = 1; player.face = 0; player.auto = { x0: 66, y0: 43.3, x1: 66, y1: 45.9, t: 0, dur: 1.4, lift: 2.2, done: () => { playStage = 2; goal = [70.5, 49.2, 1.2];",
  "if (playStage === 0 && near(41, 48.9, 1.0)) { playStage = 1; player.face = 0; player.auto = { x0: 41, y0: 49.3, x1: 41, y1: 51.9, t: 0, dur: 1.4, lift: 2.2, done: () => { playStage = 2; goal = [45.5, 55.2, 1.2];")
r("player.tx = 66.5; player.ty = 47.2; player.frozen = 0.6; }\n      if (playStage === 2 && near(70.5, 49.2, 1.4)) finish(); } },",
  "player.tx = 41.5; player.ty = 53.2; player.frozen = 0.6; }\n      if (playStage === 2 && near(45.5, 55.2, 1.4)) finish(); } },")
r("function swingDanger() { return swingOn && player.tx > 68.6 && player.tx < 72.1 && player.ty > 42.2 && player.ty < 44.9; }", "function swingDanger() { return swingOn && player.tx > 43.6 && player.tx < 47.1 && player.ty > 48.2 && player.ty < 50.9; }")
r("npc: ['stranger', 'stranger_0', 25.6, 31.2, -Math.PI / 2]", "npc: ['stranger', 'stranger_0', 22.9, 31.4, -Math.PI / 2]")
r("npc: ['teacher', 'teacher_0', 45.4, 22.4, Math.PI]", "npc: ['teacher', 'teacher_0', 28.6, 23.0, 0]")
r("start() { quake = { t: 0, phase: 'pre', hide: 0 }; goal = [48, 26.5, 2.0]; },", "start() { quake = { t: 0, phase: 'pre', hide: 0 }; goal = [31, 21.6, 2.0]; },")
r("if (player.ty < 23.2 && player.tx > 40 && player.tx < 54 && player.frozen <= 0) { sfx.bad(); mistake(); say('💥 건물 가까이는 유리와 물건이 떨어져요! 넓은 곳으로!', 'warn', 3); player.ty = 24.5; player.frozen = 0.6; }",
  "if (((player.ty > 24.6 && player.tx > 23.5 && player.tx < 36) || (player.tx > 38.2 && player.ty < 24.6)) && player.frozen <= 0) { sfx.bad(); mistake(); say('💥 건물 가까이는 유리와 물건이 떨어져요! 넓은 곳으로!', 'warn', 3); player.tx = clamp(player.tx, 26, 36.5); player.ty = 23.2; player.frozen = 0.6; }")
r("if (quake.phase === 'after' && near(48, 26.5, 2.4))", "if (quake.phase === 'after' && near(31, 21.6, 2.4))")
r("function dropRubble() { const x = 41 + Math.random() * 12, y = 20.6 + Math.random() * 2.3; dropRubbleAt(x, y); }", "function dropRubble() { const r = Math.random() < 0.75, x = r ? 24.5 + Math.random() * 11 : 38.4 + Math.random() * 1.2, y = r ? 24.8 + Math.random() * 1.2 : 19 + Math.random() * 5; dropRubbleAt(x, y); }")
r("'있는 곳(근린공원 놀이터 옆), 무슨 일인지, 친구 상태를 말한다'", "'있는 곳(루원시티 루에블리 문 옆), 무슨 일인지, 친구 상태를 말한다'")
r("구급차가 교육로로 오고 있어!", "구급차가 봉오재1로로 오고 있어!")
r("· 송명 안전 탐험대`", "· 가현 안전 탐험대`")
# ---- 건물 안 ----
r("class: { name: '🏫 송명초 3학년 2반 교실', ox: -150, oy: 0, w: 10, h: 7, floor: '#c8a27a', wall: '#f4efe4', door: [45.6, 21.6],", "class: { name: '🏫 가현초 3학년 6반 교실', ox: -150, oy: 0, w: 10, h: 7, floor: '#c8a27a', wall: '#f4efe4', door: [31.0, 33.3],")
r("여기는 송명초 3학년 2반 교실이에요.", "여기는 가현초 3학년 6반 교실이에요.")
r("pharm: { name: '💊 송명 약국'", "pharm: { name: '💊 가현 약국'")
r("tkd: { name: '🥋 송명 태권도장'", "tkd: { name: '🥋 가현 태권도장'")
r("door: [30.5, 30.6], npc: ['keeper'", "door: [40, 43.4], exit: [40, 42.5], npc: ['keeper'")
r("sci: { name: '🔬 송명초 과학실', ox: -150, oy: 120, w: 10, h: 7, floor: '#d9dde2', wall: '#f4f6f8', door: [40.0, 16.5],", "sci: { name: '🔬 가현초 과학실', ox: -150, oy: 120, w: 10, h: 7, floor: '#d9dde2', wall: '#f4f6f8', door: [27, 25.5], exit: [27, 24.6],")
r("gym: { name: '🏀 송명초 체육관', ox: -150, oy: 140, w: 11, h: 7, floor: '#d8a86a', wall: '#f4efe4', door: [52.5, 17.3],", "gym: { name: '🏀 가현초 체육관', ox: -150, oy: 140, w: 11, h: 7, floor: '#d8a86a', wall: '#f4efe4', door: [41.5, 24.4],")
r("nurse: { name: '🩹 송명초 보건실', ox: -150, oy: 160, w: 8, h: 6, floor: '#eef2f0', wall: '#ffffff', door: [42.2, 21.6],", "nurse: { name: '🩹 가현초 보건실', ox: -150, oy: 160, w: 8, h: 6, floor: '#eef2f0', wall: '#ffffff', door: [34.4, 33.3],")
r("cafe: { name: '🍚 송명초 급식실', ox: -150, oy: 180, w: 11, h: 7, floor: '#e8eef2', wall: '#fffaf0', door: [50.2, 19.5],", "cafe: { name: '🍚 가현초 급식실', ox: -150, oy: 180, w: 11, h: 7, floor: '#e8eef2', wall: '#fffaf0', door: [35.6, 26.6],")
r("acad: { name: '✏️ 송명 학원', ox: -150, oy: 200, w: 8, h: 6, floor: '#e4e0d8', wall: '#fbf7ef', door: [23.0, 22.6],", "acad: { name: '✏️ 가현 학원', ox: -150, oy: 200, w: 8, h: 6, floor: '#e4e0d8', wall: '#fbf7ef', door: [16.9, 28.6],")
r("function exitRoom() { const R = ROOMS[player.room]; player.tx = R.door[0]; player.ty = R.door[1] + 0.9;", "function exitRoom() { const R = ROOMS[player.room]; [player.tx, player.ty] = R.exit || [R.door[0], R.door[1] + 0.9];")
# ---- 시작 ----
r("sprite('grandma_0', wx(59.4), wz(45.8), Math.PI / 2);", "sprite('grandma_0', wx(59.4), wz(45.8), Math.PI / 2);")
r("addWalker('kid2', [[36, 64], [36, 40], [38, 40]], 1.9); addWalker('worker', [[30.5, 39.4], [33, 39.4]], 0.7);",
  "addWalker('kid2', [[34.5, 64], [34.5, 40], [36.5, 40]], 1.9); addWalker('worker', [[30.5, 39.4], [33, 39.4]], 0.7); addWalker('kid3', [[55.3, 66], [55.3, 48]], 1.7); addWalker('bro', [[24.5, 33.6], [44, 33.6]], 1.5);")
r("say('🦺 송명 안전 탐험대 출동!", "say('🦺 가현 안전 탐험대 출동!")

for old, new, n in R:
    c = s.count(old)
    if c != n: sys.exit(f'바꿀 곳 {c}개(기대 {n}): {old[:90]!r}')
    s = s.replace(old, new)
left = [l for l in s.splitlines() if re.search('송명|능허대|첨단|교육로|송도', l)]
if left: print('남은 송명 흔적:', *left[:12], sep='\n  ')
os.makedirs(os.path.join(ROOT, 'gahyeon'), exist_ok=True)
open(os.path.join(ROOT, 'gahyeon', 'main.js'), 'w').write(s)
print('완료: gahyeon/main.js', len(R), '곳 바꿈')
