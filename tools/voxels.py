"""안전 탐험대 송명초편 — 스프라이트 스택 에셋 생성기.

sprite-stacking 스킬의 '슬라이스 띠' 형식으로 만든다: 물체 하나 = 위에서 본 납작한 층 N장을
가로로 이은 PNG (왼쪽이 바닥 층). 앞은 이미지 아래쪽(+y).
4방향 그림을 깎는 대신 복셀을 직접 쌓아 띠를 만든다(스킬 0단계 '슬라이스 띠가 있다' 경로).
명암: 스킬 원칙대로 3톤 — 위가 트인 칸은 밝게(따뜻), 아래가 트인 칸·아래층은 어둡게(차갑게).

    python tools/voxels.py            → sprites/*.png, sprites/manifest.json
"""
import json
import math
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'sprites')
os.makedirs(OUT, exist_ok=True)


def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Vox:
    def __init__(self, w, l, h):
        self.w, self.l, self.h = w, l, h
        self.c = np.zeros((h, l, w, 3), np.uint8)       # [z, y, x]
        self.a = np.zeros((h, l, w), bool)
        self.glow = np.zeros((h, l, w), bool)           # 스스로 빛나는 칸은 명암을 안 준다

    def put(self, x, y, z, col, glow=False):
        if 0 <= x < self.w and 0 <= y < self.l and 0 <= z < self.h:
            self.c[z, y, x] = hexc(col) if isinstance(col, str) else col; self.a[z, y, x] = True; self.glow[z, y, x] = glow

    def clear(self, x0, x1, y0, y1, z0, z1):
        self.a[z0:z1 + 1, y0:y1 + 1, x0:x1 + 1] = False

    def box(self, x0, x1, y0, y1, z0, z1, col, glow=False):
        for z in range(z0, z1 + 1):
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    self.put(x, y, z, col, glow)

    def cyl(self, cx, cy, r, z0, z1, col):            # 세로 원기둥
        for z in range(z0, z1 + 1):
            for y in range(self.l):
                for x in range(self.w):
                    if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3:
                        self.put(x, y, z, col)

    def ball(self, cx, cy, cz, r, col, rz=None):
        rz = rz or r
        for z in range(self.h):
            for y in range(self.l):
                for x in range(self.w):
                    if ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 + ((z - cz) / rz) ** 2 <= 1.02:
                        self.put(x, y, z, col)

    def wheel(self, x0, x1, cy, cz, r, tire='#2b2b33', hub='#b8bec8'):  # x 축 바퀴
        for x in range(x0, x1 + 1):
            for y in range(self.l):
                for z in range(self.h):
                    d = (y - cy) ** 2 + (z - cz) ** 2
                    if d <= r * r + 0.3:
                        self.put(x, y, z, hub if (d <= (r * 0.45) ** 2 + 0.3 and x in (x0, x1)) else tire)

    def strip(self):
        lit = np.zeros_like(self.c, dtype=np.float32)
        a = self.a
        above = np.zeros_like(a); above[:-1] = a[1:]
        below = np.zeros_like(a); below[1:] = a[:-1]
        for z in range(self.h):
            base = self.c[z].astype(np.float32)
            f = np.ones((self.l, self.w), np.float32) * (0.86 + 0.14 * z / max(1, self.h - 1))
            top = a[z] & ~above[z]
            f[top] *= 1.16
            bot = a[z] & ~below[z] & (z > 0)
            f[bot] *= 0.8
            col = base * f[..., None]
            col[top] += np.array([10, 6, 0], np.float32)          # 위는 따뜻하게
            col[~top] += np.array([-4, -2, 6], np.float32)        # 옆·그늘은 차갑게
            col[self.glow[z]] = base[self.glow[z]]
            lit[z] = np.clip(col, 0, 255)
        img = np.zeros((self.l, self.w * self.h, 4), np.uint8)
        for z in range(self.h):
            img[:, z * self.w:(z + 1) * self.w, :3] = lit[z]
            img[:, z * self.w:(z + 1) * self.w, 3] = np.where(a[z], 255, 0)
        return Image.fromarray(img, 'RGBA')


MANIFEST = {}


def save(name, v, vox=0.12, note=''):
    v.strip().save(os.path.join(OUT, name + '.png'))
    MANIFEST[name] = {'w': v.w, 'l': v.l, 'n': v.h, 'vox': vox, 'note': note}


# ---------------- 사람 ----------------
SKIN = '#ffd6b0'


def person(shirt, pants, hair, *, hat=None, step=0, vest=None, adult=False, bag=None, helmet=None, arms_up=False,
           skirt=False, long_hair=False, glasses=False, cane=False, shoes='#3b3340', mask=False, phone=False):
    """정면 +y. 비율: 아이 머리 크게(18칸), 어른 길게(24칸). step=1 이면 걷는 동작(다리·팔 앞뒤로)."""
    leg, torso = (10, 8) if adult else (6, 6)
    H = leg + torso + 7
    v = Vox(13, 11, H + 2)
    cx, cy = 6, 5
    # 다리 2칸 굵기, 걷기면 앞뒤로 엇갈림
    for x0, oy in ((cx - 2, step), (cx + 1, -step)):
        v.box(x0, x0 + 1, cy - 1 + oy, cy + oy, 1, leg - 1, pants)
        v.box(x0, x0 + 1, cy - 1 + oy, cy + 1 + oy, 0, 0, shoes)
    if skirt:
        v.box(cx - 3, cx + 3, cy - 2, cy + 2, leg - 3, leg, pants)
    # 몸통: 어깨는 넓고 허리는 좁게
    v.box(cx - 2, cx + 2, cy - 1, cy + 1, leg, leg + torso - 1, shirt)
    v.box(cx - 3, cx + 3, cy - 1, cy + 1, leg + torso - 3, leg + torso - 1, shirt)
    v.box(cx - 2, cx + 2, cy - 1, cy + 1, leg, leg, pants)                     # 허리띠 자리
    if vest:
        v.box(cx - 3, cx + 3, cy - 2, cy + 2, leg + 1, leg + torso - 2, vest)
        v.box(cx - 3, cx + 3, cy + 2, cy + 2, leg + 3, leg + 3, '#f4f6f8')      # 반사띠
        v.box(cx - 3, cx + 3, cy - 2, cy - 2, leg + 3, leg + 3, '#f4f6f8')
    if bag:
        v.box(cx - 2, cx + 2, cy - 3, cy - 2, leg + 1, leg + torso - 1, bag)    # 책가방(등)
        v.box(cx - 2, cx - 2, cy - 1, cy + 1, leg + torso - 1, leg + torso - 1, bag)
        v.box(cx + 2, cx + 2, cy - 1, cy + 1, leg + torso - 1, leg + torso - 1, bag)
    # 팔
    for dx in (-4, 4):
        if arms_up:                                   # 머리 감싸기
            v.box(cx + dx, cx + dx, cy, cy + 1, leg + torso - 2, leg + torso + 4, shirt)
            v.box(cx + dx - (1 if dx > 0 else -1), cx + dx - (1 if dx > 0 else -1), cy + 1, cy + 1, leg + torso + 4, leg + torso + 5, SKIN)
        else:
            oy = step if dx < 0 else -step
            v.box(cx + dx, cx + dx, cy + oy, cy + oy, leg + 2, leg + torso - 1, shirt)
            v.box(cx + dx, cx + dx, cy + oy, cy + oy, leg + 1, leg + 1, SKIN)
    if phone:
        v.box(cx + 4, cx + 4, cy + 1, cy + 2, leg + 2, leg + 3, '#2b2b33')
    if cane:
        v.box(cx + 5, cx + 5, cy + 2, cy + 2, 0, leg + 1, '#7a4f2a')
    # 목·머리 (5칸 정육면체에 가까운 머리)
    hz = leg + torso
    v.box(cx - 1, cx + 1, cy - 1, cy + 1, hz, hz, SKIN)
    v.box(cx - 2, cx + 2, cy - 2, cy + 2, hz + 1, hz + 5, SKIN)
    v.box(cx - 3, cx + 3, cy - 2, cy + 2, hz + 2, hz + 4, SKIN) if adult else None
    # 얼굴 (앞 +y 면)
    fy = cy + 2
    v.put(cx - 1, fy, hz + 3, '#2a2230'); v.put(cx + 1, fy, hz + 3, '#2a2230')
    v.put(cx, fy, hz + 1, '#d9826b')                                            # 입
    v.put(cx - 2, fy, hz + 2, '#ffb3a7'); v.put(cx + 2, fy, hz + 2, '#ffb3a7')  # 볼
    if glasses:
        for x in (cx - 1, cx + 1): v.put(x, fy + 1, hz + 3, '#2a2230')
        v.put(cx, fy + 1, hz + 3, '#2a2230')
    if mask:
        v.box(cx - 2, cx + 2, fy, fy, hz + 1, hz + 2, '#eef1f4')
    # 머리카락: 정수리 + 뒤통수 + 옆머리, 앞머리 한 줄
    v.box(cx - 2, cx + 2, cy - 3, cy + 2, hz + 6, hz + 6, hair)
    v.box(cx - 3, cx + 3, cy - 3, cy - 2, hz + 1 if long_hair else hz + 3, hz + 6, hair)
    v.box(cx - 3, cx - 3, cy - 2, cy + 1, hz + 3, hz + 6, hair); v.box(cx + 3, cx + 3, cy - 2, cy + 1, hz + 3, hz + 6, hair)
    v.box(cx - 2, cx + 2, cy + 2, cy + 2, hz + 5, hz + 5, hair)
    if long_hair:
        v.box(cx - 3, cx + 3, cy - 3, cy - 3, hz - 2, hz + 1, hair)
    if hat:
        v.box(cx - 3, cx + 3, cy - 3, cy + 2, hz + 6, hz + 7, hat); v.box(cx - 2, cx + 2, cy + 3, cy + 4, hz + 6, hz + 6, hat)
    if helmet:
        v.box(cx - 3, cx + 3, cy - 3, cy + 3, hz + 5, hz + 7, helmet); v.box(cx - 2, cx + 2, cy - 2, cy + 2, hz + 8, hz + 8, helmet)
        v.box(cx - 1, cx + 1, cy + 3, cy + 4, hz + 5, hz + 5, helmet)
    return v


PEOPLE = {
    'kid':      dict(shirt='#ff9f1c', pants='#2f5fb3', hair='#3a2a20', hat='#ffd23f', bag='#e2463b'),
    'friend':   dict(shirt='#5bc0eb', pants='#e86a92', hair='#2b1d14', bag='#2fa84f', long_hair=True, skirt=True),
    'guard':    dict(shirt='#2f7d4f', pants='#3c4048', hair='#4a3a2a', vest='#d7ff3a', adult=True, hat='#ffcf33'),
    'teacher':  dict(shirt='#e86a92', pants='#3c4048', hair='#2b1d14', adult=True, long_hair=True, glasses=True),
    'stranger': dict(shirt='#4a4f5a', pants='#2d3038', hair='#1d1a1a', adult=True, hat='#30343c', mask=True),
    'worker':   dict(shirt='#3e6dc4', pants='#3c4048', hair='#3a2a20', vest='#ff8a00', adult=True, helmet='#ffd23f', shoes='#7a4f2a'),
    'manager':  dict(shirt='#ffffff', pants='#5a4a3a', hair='#555555', adult=True, glasses=True),
    'bro':      dict(shirt='#e2463b', pants='#2b2b33', hair='#1d1a1a', bag='#ffd23f'),
    'keeper':   dict(shirt='#6b7a8f', pants='#2d3038', hair='#777777', adult=True, hat='#2f3f5f'),
    'medic':    dict(shirt='#f4f6f8', pants='#2f5fb3', hair='#2b1d14', vest='#ff7a1a', adult=True),
    'grandma':  dict(shirt='#a678c8', pants='#5a4a6a', hair='#d8d8d8', adult=True, cane=True, glasses=True),
    'mom':      dict(shirt='#ffd6e0', pants='#3c5a8a', hair='#3a2a20', adult=True, long_hair=True, phone=True),
    'student':  dict(shirt='#ffffff', pants='#1f2a44', hair='#1d1a1a', bag='#2f7de1', adult=True),
    'officer':  dict(shirt='#1f3a6b', pants='#1f2a44', hair='#1d1a1a', adult=True, hat='#1f3a6b', vest='#d7ff3a'),
    'kid2':     dict(shirt='#2fa84f', pants='#3c4048', hair='#5a3a20', bag='#ff9f1c'),
    'kid3':     dict(shirt='#ffd23f', pants='#e2463b', hair='#1d1a1a', bag='#5bc0eb', long_hair=True, skirt=True),
}
for name, kw in PEOPLE.items():
    for f in (0, 1):
        save(f'{name}_{f}', person(step=f, **kw), vox=0.075, note='person')
save('kid_helmet_0', person(step=0, helmet='#2fa84f', **{k: v for k, v in PEOPLE['kid'].items() if k != 'hat'}), vox=0.075, note='person')
save('kid_helmet_1', person(step=1, helmet='#2fa84f', **{k: v for k, v in PEOPLE['kid'].items() if k != 'hat'}), vox=0.075, note='person')
save('kid_duck', person(step=0, arms_up=True, **PEOPLE['kid']), vox=0.075, note='person')


def lying_friend():
    v = Vox(7, 14, 4)
    v.box(2, 4, 0, 4, 0, 1, '#6b4c9a'); v.box(1, 5, 5, 9, 0, 2, '#5bc0eb'); v.box(2, 4, 10, 13, 0, 2, SKIN)
    v.box(2, 4, 13, 13, 0, 2, '#2b1d14'); v.box(0, 0, 6, 8, 0, 0, '#5bc0eb'); v.box(6, 6, 6, 8, 0, 0, '#5bc0eb')
    return v


save('friend_down', lying_friend(), vox=0.075, note='person')


# ---------------- 차 ----------------
def car(body, *, taxi=False, glass='#9fd8f5'):
    v = Vox(17, 38, 14)
    v.box(1, 15, 3, 34, 2, 6, body)                      # 차체
    v.box(1, 15, 0, 2, 2, 4, '#9aa3ad'); v.box(1, 15, 35, 37, 2, 4, '#9aa3ad')   # 범퍼(앞 +y)
    v.box(2, 14, 11, 27, 7, 10, glass)                    # 유리 실내
    v.box(2, 14, 13, 25, 11, 11, body)                    # 지붕
    v.box(2, 14, 12, 26, 7, 10, body); v.box(3, 13, 13, 25, 7, 10, glass)
    v.box(3, 13, 27, 27, 7, 9, glass); v.box(3, 13, 11, 11, 7, 9, glass)
    v.box(2, 4, 36, 37, 4, 5, '#fff2b0', glow=True); v.box(12, 14, 36, 37, 4, 5, '#fff2b0', glow=True)
    v.box(2, 4, 0, 0, 4, 5, '#ff4040', glow=True); v.box(12, 14, 0, 0, 4, 5, '#ff4040', glow=True)
    for y in (8, 29):
        v.wheel(0, 2, y, 2, 2); v.wheel(14, 16, y, 2, 2)
    if taxi:
        v.box(6, 10, 17, 21, 12, 13, '#ffe08a', glow=True)
    return v


for nm, col in (('car_white', '#eef1f4'), ('car_blue', '#2f7de1'), ('car_red', '#e2463b'), ('car_gray', '#7c8794'), ('car_black', '#2c3038')):
    save(nm, car(col), note='vehicle')
save('taxi', car('#ff9f1c', taxi=True), note='vehicle')


def van():
    v = Vox(17, 40, 18)
    v.box(1, 15, 2, 37, 2, 15, '#cfd5dc')
    v.box(2, 14, 30, 36, 9, 14, '#2c3a48'); v.box(1, 15, 6, 28, 10, 13, '#3a4654')      # 짙은 유리(수상한 승합차)
    v.box(1, 15, 38, 39, 2, 4, '#8a94a0'); v.box(1, 15, 0, 1, 2, 4, '#8a94a0')
    v.box(2, 4, 39, 39, 5, 6, '#fff2b0', glow=True); v.box(12, 14, 39, 39, 5, 6, '#fff2b0', glow=True)
    for y in (8, 31):
        v.wheel(0, 2, y, 2, 2); v.wheel(14, 16, y, 2, 2)
    return v


save('van', van(), note='vehicle')


def bus():
    v = Vox(21, 92, 26)
    v.box(1, 19, 2, 89, 2, 22, '#3fae5a')                         # 초록 시내버스
    v.box(1, 19, 2, 89, 2, 5, '#2b7a40')
    v.box(1, 19, 2, 89, 23, 23, '#e8ecef')
    for y in range(8, 84, 9):
        v.box(1, 1, y, y + 6, 12, 19, '#bfe6fb'); v.box(19, 19, y, y + 6, 12, 19, '#bfe6fb')
    v.box(2, 18, 89, 89, 9, 20, '#bfe6fb')                         # 앞 유리
    v.box(19, 19, 78, 85, 4, 19, '#2b3440')                        # 앞문 (오른쪽)
    v.box(19, 19, 40, 46, 4, 19, '#2b3440')                        # 뒷문
    v.box(3, 7, 90, 91, 5, 6, '#fff2b0', glow=True); v.box(13, 17, 90, 91, 5, 6, '#fff2b0', glow=True)
    v.box(4, 16, 89, 89, 21, 22, '#ffb300', glow=True)             # 행선지 표시
    for y in (16, 72):
        v.wheel(0, 2, y, 3, 3); v.wheel(18, 20, y, 3, 3)
    return v


save('bus', bus(), note='vehicle')


def ambulance():
    v = Vox(19, 46, 22)
    v.box(1, 17, 2, 43, 2, 17, '#f4f6f8')
    v.box(1, 17, 33, 43, 2, 12, '#f4f6f8'); v.clear(1, 17, 36, 43, 13, 17)
    v.box(2, 16, 34, 35, 9, 15, '#9fd8f5'); v.box(2, 16, 36, 42, 9, 12, '#f4f6f8')
    v.box(2, 16, 43, 43, 7, 11, '#9fd8f5')
    v.box(1, 17, 2, 43, 7, 8, '#e2463b')                          # 빨간 띠
    for dx in (0, 18):                                             # 옆 십자
        x = 1 if dx == 0 else 17
        v.box(x, x, 16, 22, 11, 13, '#e2463b'); v.box(x, x, 18, 20, 9, 15, '#e2463b')
    v.box(7, 11, 20, 26, 18, 18, '#e2463b'); v.box(8, 10, 18, 28, 18, 18, '#e2463b')   # 지붕 십자
    v.box(3, 8, 30, 32, 18, 19, '#ff2a2a', glow=True); v.box(10, 15, 30, 32, 18, 19, '#2a6bff', glow=True)
    v.box(2, 4, 44, 45, 4, 5, '#fff2b0', glow=True); v.box(14, 16, 44, 45, 4, 5, '#fff2b0', glow=True)
    for y in (9, 36):
        v.wheel(0, 2, y, 2, 2); v.wheel(16, 18, y, 2, 2)
    return v


save('ambulance', ambulance(), note='vehicle')


# ---------------- 소품 ----------------
def tree(kind):
    if kind == 'round':
        v = Vox(23, 23, 44)
        v.cyl(11, 11, 1.6, 0, 16, '#8b5a2b')
        v.ball(11, 11, 27, 10, '#4f9e45', rz=12); v.ball(8, 9, 33, 6, '#62b356'); v.ball(14, 13, 22, 6, '#3f8a3a')
    else:                                                            # 은행나무(원뿔)
        v = Vox(19, 19, 48)
        v.cyl(9, 9, 1.4, 0, 12, '#7a4f2a')
        for z in range(10, 46):
            r = 8.5 * (1 - (z - 10) / 38) + 1
            v.cyl(9, 9, r, z, z, '#f2c230' if (z // 3) % 2 else '#e8b020')
    return v


save('tree_round', tree('round'), note='prop')
save('tree_ginkgo', tree('ginkgo'), note='prop')


def ped_signal(state):
    v = Vox(9, 9, 40)
    v.cyl(4, 4, 1.2, 0, 30, '#5b626b')
    v.box(1, 7, 2, 6, 26, 39, '#2a2e33')
    red = '#ff3040' if state == 'red' else '#4a2a2e'; grn = '#2cff7a' if state == 'green' else '#24402e'
    v.box(2, 6, 7, 7, 33, 37, red, glow=state == 'red'); v.box(2, 6, 7, 7, 27, 31, grn, glow=state == 'green')
    v.box(3, 5, 7, 7, 34, 35, '#ffffff' if state == 'red' else '#5a3a3e', glow=state == 'red')       # 서 있는 사람 무늬
    v.box(3, 5, 7, 7, 28, 29, '#ffffff' if state == 'green' else '#34503e', glow=state == 'green')   # 걷는 사람 무늬
    return v


for st in ('red', 'green', 'off'):
    save('ped_signal_' + st, ped_signal(st), note='prop')


def car_signal(state):
    v = Vox(34, 9, 52)
    v.cyl(4, 4, 1.6, 0, 50, '#5b626b'); v.box(4, 32, 3, 5, 48, 49, '#5b626b')
    v.box(14, 32, 2, 6, 43, 48, '#2a2e33')
    cols = {'red': ('#ff3040', 0), 'yellow': ('#ffc21a', 1), 'green': ('#2cff7a', 2)}
    for k, (nm, (c, i)) in enumerate(cols.items()):
        on = nm == state
        v.box(16 + i * 5, 19 + i * 5, 7, 7, 44, 47, c if on else '#3a3a40', glow=on)
    return v


for st in ('red', 'yellow', 'green'):
    save('car_signal_' + st, car_signal(st), note='prop')


def bus_shelter():
    v = Vox(46, 18, 26)
    v.box(0, 45, 0, 17, 24, 25, '#4a90a4')                          # 지붕
    v.box(0, 45, 0, 1, 2, 23, '#bfe6fb')                            # 뒤 유리벽
    for x in (0, 22, 45): v.box(x, x, 0, 17, 0, 23, '#6f7882') if x != 22 else v.box(x, x, 0, 2, 0, 23, '#6f7882')
    v.box(4, 40, 3, 7, 5, 6, '#c8955a')                             # 의자
    v.box(30, 40, 2, 2, 12, 20, '#ffd23f', glow=True)               # 노선 안내판
    v.box(0, 45, 0, 17, 0, 0, '#9aa3ad')
    return v


save('bus_shelter', bus_shelter(), note='prop')


def slide2():
    v = Vox(14, 44, 30)
    # 계단 (뒤, y 0~10) → 판 (y 10~19, z 20) → 미끄럼판 (앞 y 20~43)
    for k in range(10):
        v.box(3, 10, k, k, 0, 2 * k + 1, '#ff9f1c')
    v.box(2, 2, 0, 9, 0, 22, '#2f7de1'); v.box(11, 11, 0, 9, 0, 22, '#2f7de1')
    v.box(1, 12, 10, 19, 20, 21, '#ffd23f')
    for x in (1, 12):
        for y in (10, 19): v.box(x, x, y, y, 0, 28, '#2f7de1')
    v.box(1, 12, 10, 10, 22, 28, '#2f7de1'); v.box(1, 1, 10, 19, 22, 25, '#2f7de1'); v.box(12, 12, 10, 19, 22, 25, '#2f7de1')
    v.box(1, 12, 10, 19, 29, 29, '#e2463b')
    for z in range(20):
        y = 20 + int((19 - z) * 1.2)
        v.box(3, 10, y, y + 1, z, z, '#e2463b'); v.box(2, 2, y, y + 1, z, z + 2, '#ff7a6b'); v.box(11, 11, y, y + 1, z, z + 2, '#ff7a6b')
    return v


save('slide', slide2(), note='prop')


def swing():
    v = Vox(40, 12, 30)
    for x in (1, 38):
        v.box(x, x + 1, 1, 2, 0, 28, '#2f7de1'); v.box(x, x + 1, 9, 10, 0, 28, '#2f7de1')
        v.box(x, x + 1, 1, 10, 27, 28, '#2f7de1')
    v.box(1, 39, 5, 6, 28, 29, '#2f7de1')
    for sx in (9, 25):
        v.box(sx, sx, 5, 6, 8, 27, '#9aa3ad'); v.box(sx + 6, sx + 6, 5, 6, 8, 27, '#9aa3ad')
        v.box(sx, sx + 6, 3, 8, 6, 7, '#ffd23f')
    return v


save('swing', swing(), note='prop')


def seesaw():
    v = Vox(8, 40, 10)
    v.box(2, 5, 17, 22, 0, 5, '#e2463b')
    for y in range(40):
        z = 6 + int((y - 20) * 0.08)
        v.box(1, 6, y, y, z, z, '#ffd23f')
    for y in (3, 36): v.box(1, 6, y, y, 7, 9, '#2f7de1')
    return v


save('seesaw', seesaw(), note='prop')


def bench():
    v = Vox(30, 10, 10)
    v.box(0, 29, 2, 8, 4, 5, '#c8955a'); v.box(0, 29, 0, 1, 6, 9, '#c8955a')
    for x in (2, 27): v.box(x, x + 1, 2, 8, 0, 3, '#5b626b')
    return v


save('bench', bench(), note='prop')


def kickboard():
    v = Vox(8, 20, 24)
    v.box(2, 5, 2, 16, 2, 2, '#2fa84f'); v.box(2, 5, 2, 16, 1, 1, '#1f7a37')
    v.wheel(2, 5, 2, 1, 1); v.wheel(2, 5, 17, 1, 1)
    v.box(3, 4, 16, 17, 3, 21, '#9aa3ad'); v.box(0, 7, 16, 17, 21, 22, '#2b2b33')
    return v


save('kickboard', kickboard(), note='prop')


def bicycle():
    v = Vox(8, 32, 20)
    for cy in (6, 25):
        for y in range(32):
            for z in range(14):
                d = (y - cy) ** 2 + (z - 6) ** 2
                if 20 <= d <= 38: v.box(3, 4, y, y, z, z, '#2b2b33')
        v.box(3, 4, cy, cy, 6, 6, '#9aa3ad')
    v.box(3, 4, 6, 25, 9, 10, '#2f7de1'); v.box(3, 4, 10, 11, 6, 15, '#2f7de1'); v.box(3, 4, 23, 24, 6, 17, '#2f7de1')
    v.box(2, 5, 8, 13, 15, 16, '#2b2b33'); v.box(0, 7, 23, 24, 17, 18, '#2b2b33')
    return v


save('bicycle', bicycle(), note='prop')


def helmet():
    v = Vox(9, 9, 6)
    v.ball(4, 4, 0, 4, '#2fa84f', rz=5)
    v.box(2, 6, 7, 8, 1, 1, '#1f7a37')
    return v


save('helmet', helmet(), note='item')


def hydrant():
    v = Vox(7, 7, 10)
    v.cyl(3, 3, 2, 0, 7, '#e2463b'); v.ball(3, 3, 8, 2, '#e2463b'); v.box(0, 6, 3, 3, 4, 5, '#c8312b')
    return v


save('hydrant', hydrant(), note='prop')


def fence():
    v = Vox(40, 4, 16)
    v.box(0, 39, 1, 2, 0, 15, '#f5a623')
    for x in range(0, 40, 8): v.box(x, x + 3, 1, 2, 4, 11, '#ffffff')
    v.box(0, 39, 0, 3, 0, 0, '#5b626b')
    return v


save('fence', fence(), note='prop')


def cone():
    v = Vox(7, 7, 9)
    v.box(0, 6, 0, 6, 0, 0, '#e2463b')
    for z in range(1, 9):
        r = 3 * (1 - z / 9) + 0.6
        v.cyl(3, 3, r, z, z, '#ffffff' if z in (3, 4, 6) else '#ff7a1a')
    return v


save('cone', cone(), note='prop')


def scaffold():
    v = Vox(30, 10, 46)
    for x in (0, 14, 29):
        for y in (0, 9): v.box(x, x, y, y, 0, 45, '#9aa0a8')
    for z in (12, 24, 36):
        v.box(0, 29, 0, 9, z, z, '#c8955a'); v.box(0, 29, 0, 0, z + 1, z + 3, '#9aa0a8')
    v.box(0, 29, 9, 9, 0, 45, '#3fae5a')                            # 초록 그물 (+y 쪽)
    return v


save('scaffold', scaffold(), note='prop')


def sign(col, mark):
    v = Vox(9, 3, 24)
    v.box(4, 4, 1, 1, 0, 15, '#9aa3ad')
    v.box(0, 8, 0, 2, 15, 23, '#ffffff')
    v.box(1, 7, 2, 2, 16, 22, col)
    if mark == 'school':
        v.box(3, 5, 2, 2, 17, 21, '#ffffff')
    return v


save('sign_school', sign('#ffd23f', 'school'), note='prop')
save('sign_30', sign('#e2463b', '30'), note='prop')


def safe_house():                                                   # 아동안전지킴이집 표지 (노란 간판)
    v = Vox(14, 3, 10)
    v.box(0, 13, 0, 2, 0, 9, '#ffd23f'); v.box(2, 11, 2, 2, 2, 7, '#2f7de1'); v.box(5, 8, 2, 2, 3, 6, '#ffffff')
    return v


save('safe_sign', safe_house(), note='prop')


def desk():
    v = Vox(16, 10, 10)
    v.box(0, 15, 0, 9, 8, 9, '#c8955a')
    for x in (0, 15):
        for y in (0, 9): v.box(x, x, y, y, 0, 7, '#7a7f86')
    return v


save('desk', desk(), note='prop')


def smoke_puff():
    v = Vox(13, 13, 11)
    v.ball(6, 6, 5, 6, '#7a7f88', rz=5)
    return v


save('smoke', smoke_puff(), note='fx')


def flag():
    v = Vox(16, 3, 34)
    v.box(1, 1, 1, 1, 0, 33, '#9aa3ad'); v.box(2, 15, 1, 1, 24, 32, '#2fa84f'); v.box(5, 11, 1, 1, 26, 30, '#ffffff')
    return v


save('flag', flag(), note='prop')

# ---------------- 2차: 더 사실적인 동네 소품 ----------------
def police_car():
    v = car('#f4f6f8')
    v.box(1, 15, 3, 34, 4, 5, '#1f3a8a'); v.box(1, 15, 20, 22, 2, 6, '#1f3a8a')
    v.box(3, 7, 17, 20, 12, 13, '#ff2a2a', glow=True); v.box(9, 13, 17, 20, 12, 13, '#2a6bff', glow=True)
    return v


save('police_car', police_car(), note='vehicle')


def school_bus():
    v = Vox(19, 70, 24)
    v.box(1, 17, 2, 67, 2, 20, '#ffc21a'); v.box(1, 17, 2, 67, 2, 4, '#2b2b33')
    v.box(1, 17, 56, 69, 2, 11, '#ffc21a'); v.clear(1, 17, 60, 69, 12, 20)
    for y in range(8, 54, 8):
        v.box(1, 1, y, y + 5, 12, 18, '#bfe6fb'); v.box(17, 17, y, y + 5, 12, 18, '#bfe6fb')
    v.box(2, 16, 58, 59, 12, 19, '#bfe6fb')
    v.box(17, 17, 50, 55, 4, 18, '#2b3440')                    # 승강문(오른쪽)
    v.box(1, 17, 30, 38, 8, 10, '#2b2b33')                     # '어린이 보호차량' 띠
    v.box(4, 6, 2, 2, 14, 16, '#ff3040', glow=True); v.box(12, 14, 2, 2, 14, 16, '#ff3040', glow=True)
    v.box(3, 6, 68, 69, 5, 6, '#fff2b0', glow=True); v.box(12, 15, 68, 69, 5, 6, '#fff2b0', glow=True)
    v.box(17, 18, 52, 53, 13, 16, '#ff3040')                   # 정지 표지판
    for y in (12, 58):
        v.wheel(0, 2, y, 3, 3); v.wheel(16, 18, y, 3, 3)
    return v


save('school_bus', school_bus(), note='vehicle')


def delivery_truck():
    v = Vox(19, 50, 24)
    v.box(1, 17, 36, 47, 2, 15, '#f4f6f8'); v.box(2, 16, 46, 47, 9, 14, '#9fd8f5'); v.box(1, 17, 38, 44, 10, 14, '#9fd8f5'); v.box(2, 16, 39, 45, 10, 14, '#f4f6f8')
    v.box(0, 18, 1, 34, 4, 22, '#c8955a'); v.box(0, 18, 1, 34, 4, 5, '#8a6a42')                         # 택배 상자 칸
    v.box(0, 0, 8, 28, 10, 16, '#2f7de1'); v.box(18, 18, 8, 28, 10, 16, '#2f7de1')
    v.box(3, 5, 48, 49, 5, 6, '#fff2b0', glow=True); v.box(13, 15, 48, 49, 5, 6, '#fff2b0', glow=True)
    for y in (8, 40):
        v.wheel(0, 2, y, 3, 3); v.wheel(16, 18, y, 3, 3)
    return v


save('delivery_truck', delivery_truck(), note='vehicle')


def scooter():                                                  # 배달 오토바이 + 운전자
    v = Vox(11, 24, 24)
    v.wheel(4, 6, 3, 2, 2); v.wheel(4, 6, 20, 2, 2)
    v.box(3, 7, 4, 19, 3, 6, '#e2463b'); v.box(4, 6, 17, 19, 7, 14, '#e2463b'); v.box(1, 9, 18, 18, 14, 15, '#2b2b33')
    v.box(2, 8, 0, 5, 7, 13, '#f4f6f8')                         # 배달통
    v.box(3, 7, 8, 12, 7, 15, '#2b2b33'); v.box(3, 7, 9, 12, 16, 19, '#2b2b33'); v.box(3, 7, 9, 12, 20, 23, '#ffd23f')  # 운전자 + 헬멧
    return v


save('scooter', scooter(), note='vehicle')


def excavator():
    v = Vox(30, 46, 32)
    v.box(2, 27, 6, 39, 0, 5, '#2b2b33'); v.box(2, 27, 8, 37, 1, 4, '#4a4f5a')
    v.box(4, 25, 10, 35, 6, 14, '#ffb300'); v.box(4, 13, 22, 33, 15, 24, '#ffb300'); v.box(5, 12, 30, 33, 16, 22, '#9fd8f5')
    for k in range(12):
        v.box(16, 19, 30 + k, 30 + k, 14 + k, 16 + k, '#ffb300')
    v.box(16, 19, 41, 45, 4, 27, '#ffb300'); v.box(14, 21, 42, 45, 0, 5, '#5b626b')
    return v


save('excavator', excavator(), note='vehicle')


def street_lamp():
    v = Vox(16, 7, 60)
    v.cyl(3, 3, 1.2, 0, 56, '#5b626b'); v.box(3, 13, 2, 4, 55, 56, '#5b626b'); v.box(9, 14, 1, 5, 53, 54, '#fff5c8', glow=True)
    return v


save('street_lamp', street_lamp(), note='prop')


def trash_bins():
    v = Vox(26, 12, 14)
    for x0, col in ((0, '#2f7de1'), (9, '#2fa84f'), (18, '#9aa3ad')):
        v.box(x0, x0 + 7, 1, 10, 0, 11, col); v.box(x0, x0 + 7, 0, 11, 12, 13, col)
        v.box(x0 + 2, x0 + 5, 11, 11, 7, 9, '#ffffff')
    return v


save('trash_bins', trash_bins(), note='prop')


def bollard():
    v = Vox(5, 5, 10)
    v.cyl(2, 2, 1.8, 0, 9, '#8a94a0'); v.cyl(2, 2, 1.8, 7, 7, '#ffd23f')
    return v


save('bollard', bollard(), note='prop')


def vending():
    v = Vox(12, 9, 24)
    v.box(0, 11, 0, 8, 0, 23, '#e2463b'); v.box(1, 10, 8, 8, 9, 21, '#bfe6fb', glow=True)
    for z in (11, 15, 19):
        for x in range(2, 10, 2): v.put(x, 8, z, ['#ffd23f', '#2fa84f', '#2f7de1', '#ff9f1c'][x // 2 % 4], glow=True)
    v.box(3, 8, 8, 8, 2, 4, '#2b2b33')
    return v


save('vending', vending(), note='prop')


def postbox():
    v = Vox(8, 8, 16)
    v.box(0, 7, 0, 7, 0, 13, '#e2463b'); v.box(0, 7, 0, 7, 14, 15, '#c8312b'); v.box(2, 5, 7, 7, 10, 10, '#2b2b33')
    return v


save('postbox', postbox(), note='prop')


def cctv():
    v = Vox(12, 7, 52)
    v.cyl(3, 3, 1.2, 0, 50, '#9aa3ad'); v.box(3, 10, 2, 4, 47, 48, '#9aa3ad'); v.box(7, 11, 2, 6, 44, 46, '#f4f6f8'); v.box(9, 10, 6, 6, 44, 45, '#2b2b33')
    v.box(1, 5, 4, 4, 28, 34, '#ffd23f'); v.box(2, 4, 4, 4, 30, 32, '#2b2b33')     # 'CCTV 작동 중' 노란 판
    return v


save('cctv', cctv(), note='prop')


def bike_rack():
    v = Vox(40, 30, 16)
    v.box(0, 39, 13, 16, 0, 1, '#9aa3ad')
    for x in range(2, 40, 9):
        v.box(x, x + 1, 13, 16, 2, 6, '#9aa3ad')
    for x, col in ((3, '#e2463b'), (21, '#2fa84f')):
        b = bicycle()
        for z in range(b.h):
            for y in range(b.l):
                for xx in range(b.w):
                    if b.a[z, y, xx] and x + xx < 40 and y < 30: v.put(x + xx, y, z, tuple(int(t) for t in b.c[z, y, xx]) if not (b.c[z, y, xx] == hexc('#2f7de1')).all() else col)
    return v


save('bike_rack', bike_rack(), note='prop')


def soccer_goal():
    v = Vox(56, 20, 22)
    for x in (0, 55):
        v.box(x, x, 18, 19, 0, 21, '#f4f6f8'); v.box(x, x, 0, 19, 0, 0, '#f4f6f8')
    v.box(0, 55, 18, 19, 20, 21, '#f4f6f8')
    for x in range(0, 56, 3): v.box(x, x, 0, 0, 0, 20, '#d9dde2')
    for z in range(0, 21, 3): v.box(0, 55, 0, 0, z, z, '#d9dde2')
    return v


save('soccer_goal', soccer_goal(), note='prop')


def hoop():
    v = Vox(14, 16, 42)
    v.box(6, 7, 0, 2, 0, 33, '#2f7de1'); v.box(6, 7, 2, 6, 32, 33, '#2f7de1')
    v.box(1, 12, 6, 6, 30, 39, '#f4f6f8'); v.box(4, 9, 6, 6, 32, 35, '#e2463b')
    for y in range(7, 13):
        for x in range(3, 11):
            if 6 <= (x - 6.5) ** 2 + (y - 9.5) ** 2 <= 12: v.put(x, y, 31, '#ff7a1a')
    return v


save('hoop', hoop(), note='prop')


def planter():
    v = Vox(24, 10, 10)
    v.box(0, 23, 0, 9, 0, 5, '#b9a08a'); v.box(1, 22, 1, 8, 6, 6, '#6a4a2a')
    for x in range(2, 22, 3):
        v.box(x, x + 1, 3 + (x % 2) * 2, 4 + (x % 2) * 2, 7, 9, ['#ff6b8b', '#ffd23f', '#ffffff', '#c86bff'][x % 4])
    return v


save('planter', planter(), note='prop')


def guard_booth():
    v = Vox(26, 24, 30)
    v.box(0, 25, 0, 23, 0, 23, '#e8e2d4'); v.box(0, 25, 0, 23, 24, 25, '#8a6a42')
    v.box(-1 + 1, 25, 23, 23, 8, 17, '#bfe6fb'); v.box(25, 25, 4, 19, 8, 17, '#bfe6fb')
    v.box(8, 15, 23, 23, 0, 18, '#7a5236') if False else v.box(3, 8, 23, 23, 0, 18, '#7a5236')
    v.box(-0, 25, 0, 23, 26, 27, '#c8955a')
    return v


save('guard_booth', guard_booth(), note='prop')


def parking_gate():
    v = Vox(60, 8, 16)
    v.box(0, 7, 0, 7, 0, 12, '#ffd23f'); v.box(2, 5, 7, 7, 8, 11, '#2b2b33')
    for x in range(8, 60):
        v.box(x, x, 3, 4, 10, 11, '#e2463b' if (x // 6) % 2 else '#ffffff')
    return v


save('parking_gate', parking_gate(), note='prop')


def mirror():                                                    # 볼록거울
    v = Vox(14, 9, 36)
    v.cyl(4, 2, 1, 0, 30, '#ff7a1a')
    for x in range(14):
        for z in range(22, 36):
            d = (x - 7) ** 2 + (z - 29) ** 2
            if d <= 36: v.put(x, 6, z, '#cfe8f5' if d <= 20 else '#ff7a1a', glow=d <= 20); 
            if d <= 30: v.put(x, 5, z, '#ff7a1a')
    return v


save('mirror', mirror(), note='prop')


def school_gate():
    v = Vox(90, 12, 36)
    for x0 in (0, 80):
        v.box(x0, x0 + 9, 0, 11, 0, 30, '#c8a27a'); v.box(x0 - 1 if x0 else 0, x0 + 10, 0, 11, 31, 33, '#8a6a42')
    v.box(10, 79, 5, 6, 0, 1, '#9aa3ad')                                     # 미닫이 문 레일
    v.box(81, 88, 11, 11, 12, 26, '#f4f6f8'); v.box(82, 87, 11, 11, 14, 24, '#2f5d3a')   # 학교 이름 현판
    return v


save('school_gate', school_gate(), note='prop')


def safety_fence():                                              # 스쿨존 보행자 안전 울타리 (초록·노랑)
    v = Vox(48, 4, 12)
    for x in range(0, 48, 12):
        v.box(x, x + 1, 1, 2, 0, 11, '#2fa84f')
    v.box(0, 47, 1, 2, 10, 11, '#2fa84f'); v.box(0, 47, 1, 2, 2, 3, '#2fa84f')
    for x in range(2, 48, 4): v.box(x, x, 1, 2, 4, 9, '#ffd23f')
    return v


save('safety_fence', safety_fence(), note='prop')


def aed():
    v = Vox(10, 5, 14)
    v.box(0, 9, 0, 4, 0, 13, '#2fa84f'); v.box(2, 7, 4, 4, 3, 10, '#f4f6f8'); v.box(4, 5, 4, 4, 4, 9, '#e2463b'); v.box(3, 6, 4, 4, 6, 7, '#e2463b')
    return v


save('aed', aed(), note='prop')


def extinguisher():
    v = Vox(6, 6, 12)
    v.cyl(3, 3, 2, 0, 9, '#e2463b'); v.box(2, 4, 2, 4, 10, 11, '#2b2b33'); v.box(4, 5, 3, 3, 9, 10, '#2b2b33')
    return v


save('extinguisher', extinguisher(), note='prop')


def shop_front(sign_col, awning):
    v = Vox(60, 10, 40)
    v.box(0, 59, 0, 9, 0, 33, '#e8e2d4')
    v.box(2, 57, 9, 9, 2, 22, '#bfe6fb', glow=True); v.box(24, 35, 9, 9, 2, 22, '#8fc9e8', glow=True)  # 유리창 · 문
    v.box(0, 59, 9, 9, 24, 31, sign_col, glow=True)                                                 # 간판
    for x in range(0, 60, 2):
        v.box(x, x, 9, 9 if x % 4 else 9, 22, 23, awning)
    return v


save('shop_conv', shop_front('#2f7de1', '#2fa84f'), note='facade')
save('shop_snack', shop_front('#ff9f1c', '#e2463b'), note='facade')


def dog():
    v = Vox(7, 14, 9)
    v.box(2, 4, 3, 10, 3, 5, '#c8955a'); v.box(2, 4, 10, 13, 5, 7, '#c8955a'); v.box(2, 4, 13, 13, 5, 5, '#2b2b33')
    for y in (4, 9):
        v.box(2, 2, y, y, 0, 2, '#a87a45'); v.box(4, 4, y, y, 0, 2, '#a87a45')
    v.box(3, 3, 1, 3, 5, 7, '#c8955a'); v.box(2, 2, 11, 11, 8, 8, '#8a5a2b'); v.box(4, 4, 11, 11, 8, 8, '#8a5a2b')
    return v


save('dog', dog(), vox=0.075, note='person')


def stroller():
    v = Vox(10, 16, 16)
    v.wheel(1, 2, 3, 1, 1); v.wheel(7, 8, 3, 1, 1); v.wheel(1, 2, 12, 1, 1); v.wheel(7, 8, 12, 1, 1)
    v.box(1, 8, 2, 12, 3, 8, '#5bc0eb'); v.box(1, 8, 2, 6, 9, 13, '#3a8ab0'); v.box(2, 7, 0, 1, 10, 14, '#2b2b33')
    return v


save('stroller', stroller(), vox=0.075, note='person')


def crosswalk_sign():
    v = Vox(11, 3, 30)
    v.box(5, 5, 1, 1, 0, 20, '#9aa3ad')
    v.box(0, 10, 0, 2, 20, 29, '#2f7de1'); v.box(2, 8, 2, 2, 22, 27, '#f4f6f8'); v.box(4, 6, 2, 2, 23, 26, '#2b2b33')
    return v


save('crosswalk_sign', crosswalk_sign(), note='prop')


def busstop_sign():
    v = Vox(9, 3, 34)
    v.box(4, 4, 1, 1, 0, 26, '#9aa3ad'); v.box(0, 8, 0, 2, 25, 33, '#2fa84f'); v.box(2, 6, 2, 2, 27, 31, '#ffffff')
    return v


save('busstop_sign', busstop_sign(), note='prop')


def rubble():                                                   # 지진 때 떨어지는 유리·간판 조각
    v = Vox(9, 9, 3)
    for (x, y, c) in ((1, 2, '#bfe6fb'), (4, 5, '#9aa3ad'), (6, 1, '#bfe6fb'), (2, 6, '#c8955a'), (7, 7, '#9aa3ad')):
        v.box(x, x + 1, y, y + 1, 0, 1, c)
    return v


save('rubble', rubble(), note='fx')


# 소방차: 앞서 sprite-stacking 스킬로 4방향을 그려 깎은 띠를 그대로 쓴다
_ft = Image.open(os.path.join(OUT, '..', 'assets', 'firetruck_slices.png'))
_ft.save(os.path.join(OUT, 'firetruck.png'))
MANIFEST['firetruck'] = {'w': _ft.width // 24, 'l': _ft.height, 'n': 24, 'vox': 0.17, 'note': 'vehicle'}


# 슬라이스 띠 계약 확인: 가로 = w * n, 세로 = l
for nm, m in MANIFEST.items():
    im = Image.open(os.path.join(OUT, nm + '.png'))
    assert im.width == m['w'] * m['n'] and im.height == m['l'], nm
json.dump(MANIFEST, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)
print(len(MANIFEST), 'sprites')
