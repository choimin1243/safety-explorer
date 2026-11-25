#!/usr/bin/env python3
"""인천가현초 둘레 OSM 격자(osm2grid 결과)를 게임용으로 다듬는다.

사용: python3 tools/gahyeon_grid.py <osm2grid g3.json> data/gahyeon_grid.json
- 180도 돌림(학교가 큰길 북쪽에 오도록, 좌우 뒤집기 아님) 뒤 왼쪽 2칸을 잘라 W=89
- 염곡로(세로) x18~21, 봉오재1로(가로) y35~37 을 곧게 펴고, 나머지 찻길은 단지 안 길(v)로
- 큰길 건너 서쪽에 수업용 상가(송명편 상가 칸 모양 재사용)
- 가현초 본관 칸은 'b'(스프라이트로 그림), 체육관 'c', 가현중 'm' 자리를 예약
"""
import json, sys, os

src, out = sys.argv[1], sys.argv[2]
g = json.load(open(src))
W0, H = g['W'], g['H']
gr = [list(r[::-1]) for r in g['ground'][::-1]]
bl = [list(r[::-1]) for r in g['bldg'][::-1]]
CUT = 2
gr = [r[CUT:] for r in gr]; bl = [r[CUT:] for r in bl]
W = W0 - CUT
old = g['buildings']
SCHOOL_ID = 63                                     # OSM 'public' = 가현초 본관

# 건물 번호 다시 매기기: 'b','c','m' 은 비워 둔다
RESERVED = {'b', 'c', 'm'}
buildings, remap = [], {}
def new_id(b):
    while chr(48 + len(buildings)) in RESERVED or chr(48 + len(buildings)) == '.':
        buildings.append({'kind': 'public', 'levels': 3, 'name': '(reserved)', 'cx': -1, 'cy': -1})
    buildings.append(b); return chr(48 + len(buildings) - 1)
for y in range(H):
    for x in range(W):
        ch = bl[y][x]
        if ch == '.': continue
        i = ord(ch) - 48
        if i == SCHOOL_ID: bl[y][x] = 'b'; continue
        if i not in remap: remap[i] = new_id(dict(old[i]))
        bl[y][x] = remap[i]

def clear(x, y, c=None):
    bl[y][x] = '.'
    if c: gr[y][x] = c

# 1) 큰길 곧게
for y in range(H):
    for x in range(W):
        if gr[y][x] == 'r': gr[y][x] = 'v'          # 일단 모든 찻길 → 단지 길
for y in range(H):
    for x in (16, 17, 22, 23): clear(x, y, 'g')
    for x in range(18, 22): clear(x, y, 'r')
for x in range(W):
    for y in (34, 38): clear(x, y, 's')
    for y in (35, 36, 37): clear(x, y, 'r')
for y in range(34, 39):
    for x in range(18, 22): gr[y][x] = 'r'
# 큰길 서쪽 끝은 삼거리(송명편처럼): 염곡로 서쪽은 풀밭 + 산책길
for y in range(35, 39):
    for x in range(0, 18): gr[y][x] = 'g'
for x in range(8, 14): gr[36][x] = 's'
# 공사장(x23~28, y40~44)에 걸친 아파트 동은 통째로 비움
hit = {bl[y][x] for y in range(39, 46) for x in range(22, 30) if bl[y][x] != '.'}
for y in range(H):
    for x in range(W):
        if bl[y][x] in hit: bl[y][x] = '.'
# 큰길과 맞닿은 단지 길 한 칸은 인도로(찻길 경계 정리)
for y in range(H):
    for x in range(W):
        if gr[y][x] == 'v' and y in (33, 39): gr[y][x] = 's'

# 2) 서쪽 상가: 송명편 상가 칸(x<18, y<34) 모양 그대로
SM = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'songmyeong_grid.json')))
for y in range(0, 34):
    for x in range(0, 16):
        clear(x, y, 'g' if gr[y][x] in 'hv' else None)
        if gr[y][x] not in 'gys': gr[y][x] = 'g'
shop_ids = {}
for y in range(0, 34):
    for x in range(0, 16):
        ch = SM['bldg'][y][x]
        if ch == '.': continue
        b = SM['buildings'][ord(ch) - 48]
        if b['kind'] != 'commercial': continue
        if ch not in shop_ids: shop_ids[ch] = new_id({'kind': 'commercial', 'levels': 3, 'name': '가현 상가', 'cx': -1, 'cy': -1})
        bl[y][x] = shop_ids[ch]
    for x in range(0, 16):
        if SM['ground'][y][x] == 's': gr[y][x] = 's'
for x in range(0, 16): gr[33][x] = 'g'            # 편의점 앞 마당(집결지는 main.js 가 칠함)

# 3) 학교 땅(h) 정리: 본관 아래(남쪽) 한 줄은 학교 마당
for y in range(18, 34):
    for x in range(24, 46):
        if gr[y][x] in 'gs' and bl[y][x] == '.' and y > 17: gr[y][x] = 'h'
# 체육관(c): 운동장 동쪽 끝, 가현중(m): 북쪽 학교 땅
for y in range(19, 24):
    for x in range(39, 45): bl[y][x] = 'c'
for y in range(3, 8):
    for x in range(27, 41): bl[y][x] = 'm'

res = {'W': W, 'H': H, 'tile_m': g['tile_m'], 'note': 'OSM 180도 회전·수업용 정리',
       'ground': [''.join(r) for r in gr], 'bldg': [''.join(r) for r in bl], 'buildings': buildings}
json.dump(res, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
for y in range(H):
    print('%02d ' % y + ''.join(bl[y][x] if bl[y][x] in 'bcm' else ('#' if bl[y][x] != '.' else gr[y][x]) for x in range(W)))
print('   ' + ''.join(str(x % 10) for x in range(W)))
print('W,H', W, H, 'buildings', len(buildings))
