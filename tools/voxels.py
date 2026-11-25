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
    'pharmacist': dict(shirt='#f4f6f8', pants='#5a6a7a', hair='#2b1d14', adult=True, glasses=True, long_hair=True),
    'master':   dict(shirt='#f8f8f4', pants='#f0f0ea', hair='#1d1a1a', adult=True, shoes='#e8c8a8'),
    'kid_dobok': dict(shirt='#f8f8f4', pants='#f0f0ea', hair='#3a2a20', shoes='#e8c8a8'),
    'scientist': dict(shirt='#eef4f8', pants='#3c4048', hair='#6a4a2a', adult=True, glasses=True),
    'pe_teacher': dict(shirt='#2f5fb3', pants='#2f5fb3', hair='#1d1a1a', adult=True, hat='#e2463b', shoes='#f4f6f8'),
    'nurse':    dict(shirt='#f4f6f8', pants='#ff9fb8', hair='#3a2a20', adult=True, long_hair=True),
    'cook':     dict(shirt='#f8f8f4', pants='#f0f0ea', hair='#3a2a20', adult=True, hat='#ffffff', mask=True),
    'tutor':    dict(shirt='#8e5cd9', pants='#3c4048', hair='#2b1d14', adult=True, glasses=True),
    'little':   dict(shirt='#ffd23f', pants='#5b8def', hair='#3a2a20', hat='#ffd23f', bag='#ff9fb8'),
    'barista':  dict(shirt='#f4efe4', pants='#2b2b33', hair='#5a3a22', adult=True, vest='#6b4a2a', hat='#2b2b33'),
}
BELT = {'master': '#1d1a1a', 'kid_dobok': '#ffd23f'}
for name, kw in PEOPLE.items():
    for f in (0, 1):
        pv = person(step=f, **kw)
        if name in BELT:                      # 도복 띠
            lz = 10 if kw.get('adult') else 6
            pv.box(3, 9, 3, 7, lz, lz, BELT[name]); pv.box(5, 6, 7, 7, lz - 2, lz - 1, BELT[name])
        save(f'{name}_{f}', pv, vox=0.075, note='person')
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


# ---------------- 3차: 학교 건물을 실제 지도 발자국으로 (1칸 = 8복셀) ----------------
GRIDD = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'songmyeong_grid.json')))


def footprint(chars=None, rect=None):
    cells = set()
    if rect:
        x0, x1, y0, y1 = rect
        cells = {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
    else:
        for y in range(GRIDD['H']):
            for x in range(GRIDD['W']):
                if GRIDD['bldg'][y][x] in chars: cells.add((x, y))
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    return cells, min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


def school_building(cells, bx, by, tw, th, *, floors=4, wall='#f2e3c4', band='#c98f5a', accent='#2f7de1', entrance='S', gym=False, name_board=True):
    K = 8
    W_, L_ = tw * K, th * K
    FH = 6
    Hgt = floors * FH + (8 if gym else 3)
    v = Vox(W_, L_, Hgt + 1)
    inside = np.zeros((L_, W_), bool)
    for (x, y) in cells:
        inside[(y - by) * K:(y - by + 1) * K, (x - bx) * K:(x - bx + 1) * K] = True
    edge = inside & ~(np.roll(inside, 1, 0) & np.roll(inside, -1, 0) & np.roll(inside, 1, 1) & np.roll(inside, -1, 1))
    edge[0, :] |= inside[0, :]; edge[-1, :] |= inside[-1, :]; edge[:, 0] |= inside[:, 0]; edge[:, -1] |= inside[:, -1]
    top = floors * FH
    for y in range(L_):
        for x in range(W_):
            if not inside[y, x]: continue
            h = top
            if gym:                                   # 체육관: 둥근 지붕
                cx = (W_ - 1) / 2; d = abs(x - cx) / (W_ / 2); h = top + int(8 * (1 - d * d))
            for z in range(h):
                if edge[y, x]:
                    fz = z % FH
                    along = x if (y == 0 or y == L_ - 1 or not inside[max(0, y - 1), x] or not inside[min(L_ - 1, y + 1), x]) else y
                    if z < top and fz == 0: col = band
                    elif z < top and 2 <= fz <= 4 and along % 4 in (1, 2) and not gym: col = '#8fc3e0' if fz != 4 else '#cfe8f5'
                    elif gym and top - 6 <= z < top and along % 3 != 0: col = '#9fd0ea'
                    else: col = wall
                    v.put(x, y, z, col)
                else:
                    if z >= h - 1: v.put(x, y, z, '#a7b3a2' if not gym else '#6f8fb0')
            if edge[y, x] and not gym:
                v.put(x, y, top, '#d0743c'); v.put(x, y, top + 1, '#d0743c')     # 옥상 난간
    if not gym:
        # 옥상: 물탱크, 태양광 판, 실외기
        cy, cx = np.argwhere(inside).mean(0).astype(int)
        v.box(cx - 3, cx + 2, cy - 3, cy + 2, top, top + 4, '#dfe6ea'); v.box(cx - 3, cx + 2, cy - 3, cy + 2, top + 5, top + 5, '#2f7de1')
        ys_, xs_ = np.where(inside)
        for k in range(0, 18, 3):
            x0 = xs_.min() + 4 + k
            if x0 + 2 < xs_.max(): v.box(x0, x0 + 1, ys_.min() + 3, ys_.min() + 9, top, top + 1, '#1f3a6b')
        for k in range(3):
            x0 = xs_.max() - 6 - k * 4
            v.box(x0, x0 + 2, ys_.max() - 5, ys_.max() - 3, top, top + 2, '#c8ced4')
    # 현관 (남쪽 가운데): 유리문, 차양, 시계, 학교 이름판
    if entrance == 'S':
        rows = np.where(inside.any(1))[0]; yb = rows.max()
        xs_ = np.where(inside[yb])[0]; cx = int(xs_.mean())
        v.box(cx - 4, cx + 3, yb, yb, 0, 4, '#4a7fa8'); v.box(cx - 1, cx, yb, yb, 0, 4, '#2b3440')
        if yb + 3 < L_: v.box(cx - 6, cx + 5, yb + 1, min(L_ - 1, yb + 3), 5, 5, '#c98f5a')
        if not gym:
            for x in range(W_):
                for z in range(Hgt):
                    d = (x - cx) ** 2 + (z - (top - 4)) ** 2
                    if d <= 6.5: v.put(x, yb, z, '#ffffff' if d <= 4 else '#2b3440')
            v.put(cx, yb, top - 4, '#2b3440'); v.put(cx, yb, top - 3, '#2b3440'); v.put(cx + 1, yb, top - 4, '#2b3440')
            if name_board:
                x0 = max(0, cx - 16); v.box(x0, x0 + 9, yb, yb, top - 5, top - 2, '#2f5d3a')
                for xx in range(x0 + 1, x0 + 9, 2): v.box(xx, xx, yb, yb, top - 4, top - 3, '#ffffff')
            v.box(cx - 6, cx + 5, yb, yb, top + 1, top + 2, accent)
    return v


for nm, chars, rect, kw in (
    ('bld_songmyeong', 'b', None, dict(wall='#f2e3c4', band='#c98f5a', accent='#2f7de1')),
    ('bld_songmyeong_gym', 'c', None, dict(wall='#e8d6b0', band='#a87a45', gym=True, floors=2, name_board=False)),
    ('bld_cheomdan', '\x92', None, dict(wall='#eef1f4', band='#5b8def', accent='#ff9f1c')),
    ('bld_neunghuh', None, (72, 83, 13, 16), dict(wall='#f1e6f5', band='#9b6bc8', accent='#7c3aed')),
):
    cells, bx, by, tw, th = footprint(chars, rect)
    save(nm, school_building(cells, bx, by, tw, th, **kw), vox=0.5, note='world')
    MANIFEST[nm].update(bx=bx, by=by, tw=tw, th=th)


# ---------------- 운동장 · 학교 소품 ----------------
def stage():                                                    # 구령대
    v = Vox(48, 24, 30)
    v.box(0, 47, 4, 23, 0, 7, '#d8c3a0'); v.box(0, 47, 4, 23, 8, 8, '#a87a45')
    for k in range(4): v.box(14 + 0, 33, 20 + k if False else 23 - k, 23 - k, 0, 7 - 2 * k, '#c8b08a')
    for x in (1, 46):
        v.box(x, x, 5, 5, 9, 26, '#9aa3ad'); v.box(x, x, 22, 22, 9, 26, '#9aa3ad')
    v.box(0, 47, 2, 23, 27, 28, '#2f7de1'); v.box(2, 45, 3, 22, 29, 29, '#5b9df0')
    v.box(20, 27, 6, 9, 9, 14, '#8a6a42')                       # 단상
    return v


save('stage', stage(), note='prop')


def bleachers():                                                # 스탠드
    v = Vox(80, 20, 14)
    for k in range(5):
        v.box(0, 79, k * 4, 19, 0, 2 + k * 3 - 1 if k else 1, ['#d9d2c3', '#2f7de1', '#2fa84f', '#ff9f1c', '#e2463b'][k])
    return v


save('bleachers', bleachers(), note='prop')


def flagpoles():
    v = Vox(30, 8, 72)
    for i, (x, col) in enumerate(((5, '#ffffff'), (15, '#2f7de1'), (25, '#2fa84f'))):
        v.box(x, x + 1, 3, 4, 0, 70 if i == 0 else 62, '#c8ced4')
        top = 70 if i == 0 else 62
        v.box(x + 2, x + 13 if x < 25 else x + 4, 3, 3, top - 9, top - 2, col)
        if i == 0: v.ball(x + 7, 3, top - 5, 2, '#e2463b', rz=2); v.box(x + 3, x + 4, 3, 3, top - 8, top - 7, '#2b2b33')
    v.box(0, 29, 0, 7, 0, 1, '#9aa3ad')
    return v


save('flagpoles', flagpoles(), note='prop')


def pullup_bars():                                              # 철봉
    v = Vox(40, 6, 26)
    for x, h in ((0, 24), (13, 24), (26, 18), (39, 14)):
        v.box(x, x, 2, 3, 0, h, '#e2463b')
    v.box(0, 13, 2, 3, 23, 23, '#c8ced4'); v.box(13, 26, 2, 3, 17, 17, '#c8ced4'); v.box(26, 39, 2, 3, 13, 13, '#c8ced4')
    return v


save('pullup_bars', pullup_bars(), note='prop')


def jungle_gym():
    v = Vox(30, 30, 30)
    for i in range(0, 30, 7):
        for j in range(0, 30, 7):
            v.box(i, i + 1, j, j + 1, 0, 29, ['#e2463b', '#2f7de1', '#ffd23f', '#2fa84f', '#ff9f1c'][(i + j) // 7 % 5])
    for z in (9, 19, 28):
        for i in range(0, 30, 7): v.box(i, i + 1, 0, 29, z, z, '#ffd23f'); v.box(0, 29, i, i + 1, z, z, '#2f7de1')
    return v


save('jungle_gym', jungle_gym(), note='prop')


def garden():                                                   # 학교 텃밭
    v = Vox(40, 30, 10)
    for k in range(3):
        y0 = 1 + k * 10
        v.box(0, 39, y0, y0 + 7, 0, 3, '#8a5a2b'); v.box(1, 38, y0 + 1, y0 + 6, 4, 4, '#5a3a20')
        for x in range(3, 38, 4):
            v.box(x, x + 1, y0 + 2, y0 + 5, 5, 6 + (x % 3), ['#3fae5a', '#62b356', '#e2463b'][k] if (x // 4) % 3 == 0 else '#3fae5a')
    v.box(1, 6, 0, 0, 0, 8, '#ffffff'); v.box(2, 5, 0, 0, 5, 7, '#2fa84f')
    return v


save('garden', garden(), note='prop')


def pavilion():                                                 # 정자
    v = Vox(36, 36, 40)
    v.box(2, 33, 2, 33, 0, 4, '#b98b5a')
    for x in (4, 31):
        for y in (4, 31): v.box(x, x + 1, y, y + 1, 5, 26, '#8a3a2a')
    for k in range(10):
        v.box(0 + k * 2, 35 - k * 2, 0 + k * 2, 35 - k * 2, 27 + k, 27 + k, '#4a5a4a' if k % 2 else '#3a4a3a')
    v.box(0, 35, 0, 35, 26, 26, '#c8312b')
    return v


save('pavilion', pavilion(), note='prop')


def statue():                                                   # 책 읽는 소녀상
    v = Vox(16, 16, 30)
    v.box(1, 14, 1, 14, 0, 8, '#c8c2b8'); v.box(2, 13, 2, 13, 9, 9, '#a8a29a')
    v.box(5, 10, 5, 10, 10, 15, '#7a8a7a'); v.box(6, 9, 6, 9, 16, 21, '#7a8a7a'); v.ball(7.5, 7.5, 24, 2.6, '#7a8a7a')
    v.box(5, 10, 10, 11, 18, 19, '#ffffff')                       # 책
    return v


save('statue', statue(), note='prop')


def track_marker():
    v = Vox(6, 6, 8)
    v.cyl(3, 3, 2, 0, 7, '#ffffff'); v.box(1, 5, 1, 5, 7, 7, '#e2463b')
    return v


save('track_marker', track_marker(), note='prop')


def shoe_rack():
    v = Vox(30, 8, 18)
    v.box(0, 29, 0, 7, 0, 17, '#c8955a')
    for z in (4, 9, 14):
        v.box(1, 28, 2, 7, z, z + 3, '#8a6a42')
        for x in range(2, 28, 4): v.box(x, x + 2, 5, 7, z, z + 1, ['#ffffff', '#2f7de1', '#e2463b', '#ffd23f'][x % 4])
    return v


save('shoe_rack', shoe_rack(), note='prop')


# ---------------- 동네: 상가 앞면 더, 주차, 운동기구 ----------------
def shop2(wall, sign_col, glass='#bfe6fb', mark=None):
    v = Vox(48, 10, 40)
    v.box(0, 47, 0, 9, 0, 33, wall)
    v.box(2, 45, 9, 9, 2, 21, glass, glow=True); v.box(19, 28, 9, 9, 2, 21, '#8fc9e8', glow=True)
    v.box(0, 47, 9, 9, 24, 31, sign_col, glow=True)
    if mark == 'cross':
        v.box(4, 10, 9, 9, 25, 30, '#ffffff', glow=True); v.box(6, 8, 9, 9, 25, 30, '#2fa84f', glow=True); v.box(4, 10, 9, 9, 27, 28, '#2fa84f', glow=True)
    if mark == 'belt':
        v.box(4, 12, 9, 9, 27, 28, '#2b2b33', glow=True)
    if mark == 'cup':
        v.box(4, 9, 9, 9, 25, 29, '#ffffff', glow=True); v.box(10, 10, 9, 9, 26, 28, '#ffffff', glow=True)
    return v


save('shop_pharmacy', shop2('#eef1f4', '#2fa84f', mark='cross'), note='facade')
save('shop_taekwondo', shop2('#f4e8cc', '#e2463b', mark='belt'), note='facade')
save('shop_cafe', shop2('#e8d6c0', '#7a4f2a', mark='cup'), note='facade')
save('shop_academy', shop2('#eef1f4', '#5b8def'), note='facade')


def outdoor_gym():
    v = Vox(40, 20, 24)
    v.box(0, 39, 0, 19, 0, 0, '#3fae5a')
    v.box(3, 4, 8, 9, 1, 20, '#ffd23f'); v.box(3, 12, 8, 9, 20, 21, '#ffd23f'); v.wheel(10, 12, 9, 12, 5, tire='#2f7de1', hub='#ffd23f')
    v.box(22, 23, 4, 5, 1, 16, '#ffd23f'); v.box(32, 33, 4, 5, 1, 16, '#ffd23f'); v.box(22, 33, 4, 5, 16, 17, '#2f7de1')
    v.box(25, 30, 10, 16, 4, 5, '#2f7de1'); v.box(27, 28, 13, 14, 1, 3, '#ffd23f')
    return v


save('outdoor_gym', outdoor_gym(), note='prop')


def recycle_station():                                          # 아파트 분리수거장
    v = Vox(46, 16, 26)
    v.box(0, 45, 0, 15, 24, 25, '#2fa84f'); v.box(0, 1, 0, 1, 0, 23, '#9aa3ad'); v.box(44, 45, 0, 1, 0, 23, '#9aa3ad')
    v.box(0, 1, 14, 15, 0, 23, '#9aa3ad'); v.box(44, 45, 14, 15, 0, 23, '#9aa3ad')
    for i, col in enumerate(('#2f7de1', '#ffd23f', '#2fa84f', '#9aa3ad', '#e2463b')):
        x0 = 3 + i * 8; v.box(x0, x0 + 6, 3, 12, 0, 12, col); v.box(x0 + 1, x0 + 5, 12, 12, 9, 10, '#ffffff')
    return v


save('recycle_station', recycle_station(), note='prop')


def apt_sign(num_col='#2f7de1'):
    v = Vox(16, 6, 22)
    v.box(2, 13, 2, 3, 0, 21, '#f4f1ea'); v.box(3, 12, 4, 4, 12, 19, num_col); v.box(5, 10, 4, 4, 14, 17, '#ffffff')
    return v


save('apt_sign', apt_sign(), note='prop')


def parcel_locker():
    v = Vox(24, 8, 22)
    v.box(0, 23, 0, 7, 0, 21, '#5b8def')
    for x in range(1, 23, 5):
        for z in range(2, 20, 6): v.box(x, x + 3, 7, 7, z, z + 4, '#d9e6f5')
    return v


save('parcel_locker', parcel_locker(), note='prop')


def yellow_carpet():                                            # 옐로카펫 (횡단보도 대기 공간 노란 바닥·벽)
    v = Vox(24, 24, 22)
    for x in range(24):
        for y in range(24):
            if x + y <= 24: v.put(x, y, 0, '#ffd23f')
    v.box(0, 0, 0, 23, 1, 20, '#ffd23f'); v.box(0, 23, 0, 0, 1, 20, '#ffd23f')
    v.box(0, 0, 4, 19, 8, 12, '#ffffff', glow=True); v.box(4, 19, 0, 0, 8, 12, '#ffffff', glow=True)
    return v


save('yellow_carpet', yellow_carpet(), note='prop')


# ---------------- 건물 안 (교실 · 편의점 · 분식집) ----------------
def blackboard():
    v = Vox(60, 4, 30)
    v.box(0, 59, 0, 3, 8, 27, '#8a6a42'); v.box(2, 57, 3, 3, 10, 25, '#2f5d3a')
    for x in range(8, 50, 6): v.box(x, x + 3, 3, 3, 20, 20, '#f4f6f8')
    v.box(0, 59, 0, 3, 7, 7, '#c8955a')
    return v


save('blackboard', blackboard(), note='prop')


def locker():
    v = Vox(40, 10, 22)
    v.box(0, 39, 0, 9, 0, 21, '#c8955a')
    for x in range(1, 39, 5):
        for z in (2, 12): v.box(x, x + 3, 9, 9, z, z + 7, '#e8c08a'); v.put(x + 2, 9, z + 4, '#8a6a42')
    return v


save('locker', locker(), note='prop')


def teacher_desk():
    v = Vox(28, 14, 12)
    v.box(0, 27, 0, 13, 9, 10, '#a87a45'); v.box(0, 27, 0, 1, 0, 8, '#8a6a42'); v.box(0, 1, 0, 13, 0, 8, '#8a6a42'); v.box(26, 27, 0, 13, 0, 8, '#8a6a42')
    v.box(18, 24, 4, 9, 11, 11, '#2b2b33'); v.box(18, 24, 3, 3, 11, 15, '#2b2b33'); v.box(19, 23, 3, 3, 12, 14, '#5bc0eb', glow=True)
    return v


save('teacher_desk', teacher_desk(), note='prop')


def tv():
    v = Vox(30, 4, 22)
    v.box(0, 29, 0, 3, 4, 21, '#2b2b33'); v.box(1, 28, 3, 3, 5, 20, '#5b9df0', glow=True); v.box(13, 16, 1, 2, 0, 3, '#5b626b')
    return v


save('tv', tv(), note='prop')


def shelf(cols):
    v = Vox(40, 10, 22)
    v.box(0, 39, 0, 9, 0, 0, '#9aa3ad'); v.box(0, 39, 0, 1, 0, 21, '#c8ced4')
    for z in (1, 7, 13, 19):
        v.box(0, 39, 0, 9, z, z, '#9aa3ad')
        if z < 19:
            for x in range(1, 39, 3): v.box(x, x + 1, 3, 8, z + 1, z + 3 + (x % 2), cols[(x // 3 + z) % len(cols)])
    return v


save('shelf_snack', shelf(['#e2463b', '#ffd23f', '#2f7de1', '#ff9f1c']), note='prop')
save('shelf_drink', shelf(['#5bc0eb', '#2fa84f', '#ffffff', '#ff6b8b']), note='prop')


def fridge():
    v = Vox(30, 12, 26)
    v.box(0, 29, 0, 11, 0, 25, '#d9dde2'); v.box(1, 28, 11, 11, 2, 23, '#cfe8f5', glow=True)
    for z in (6, 12, 18):
        for x in range(2, 28, 3): v.box(x, x + 1, 9, 10, z, z + 3, ['#2fa84f', '#e2463b', '#ffd23f', '#5bc0eb'][x % 4])
    return v


save('fridge', fridge(), note='prop')


def counter():
    v = Vox(34, 14, 14)
    v.box(0, 33, 0, 13, 0, 9, '#2f7de1'); v.box(0, 33, 0, 13, 10, 10, '#eef1f4')
    v.box(4, 9, 4, 9, 11, 14, '#2b2b33'); v.box(5, 8, 9, 9, 12, 13, '#5bc0eb', glow=True)
    v.box(22, 30, 9, 13, 2, 7, '#ffd23f'); v.box(24, 28, 13, 13, 3, 6, '#2f7de1')       # 아동안전지킴이집 스티커
    return v


save('counter', counter(), note='prop')


def stove():
    v = Vox(30, 14, 14)
    v.box(0, 29, 0, 13, 0, 9, '#9aa3ad'); v.box(0, 29, 0, 13, 10, 10, '#5b626b')
    for x in (6, 20):
        v.cyl(x, 6, 3, 11, 11, '#2b2b33'); v.box(x - 3, x + 2, 3, 9, 12, 14, '#c8ced4')
    return v


save('stove', stove(), note='prop')


def table():
    v = Vox(24, 16, 12)
    v.box(0, 23, 0, 15, 9, 10, '#f4f1ea')
    for x in (1, 22):
        for y in (1, 14): v.box(x, x, y, y, 0, 8, '#9aa3ad')
    v.box(4, 9, 5, 9, 11, 11, '#e2463b'); v.box(14, 19, 6, 10, 11, 11, '#ff9f1c')       # 떡볶이·튀김
    return v


save('table', table(), note='prop')


def stool():
    v = Vox(6, 6, 7)
    v.cyl(3, 3, 2.5, 6, 6, '#e2463b'); v.box(2, 3, 2, 3, 0, 5, '#9aa3ad')
    return v


save('stool', stool(), note='prop')


# ---------------- 건물 안 꾸미기 (추가) ----------------
def bookshelf():
    v = Vox(30, 10, 26)
    v.box(0, 29, 0, 9, 0, 25, '#a87a45'); v.clear(1, 28, 2, 9, 1, 24)
    cols = ['#e2463b', '#2f7de1', '#ffd23f', '#2fa84f', '#ff9f1c', '#8e5cd9', '#f4f6f8']
    for z0 in (1, 9, 17):
        v.box(1, 28, 2, 9, z0 + 7, z0 + 7, '#8a6a42')
        for x in range(1, 29):
            if x % 7 == 6: continue
            hgt = 4 + (x * 3) % 3
            v.box(x, x, 3 + (x % 2), 8, z0, z0 + hgt, cols[(x + z0) % len(cols)])
    return v


save('bookshelf', bookshelf(), note='prop')


def board_notice():                     # 교실 뒤 게시판(우리 반 작품)
    v = Vox(50, 3, 26)
    v.box(0, 49, 0, 2, 2, 25, '#c8955a'); v.box(1, 48, 2, 2, 3, 24, '#f2d9a8')
    arts = [('#ff6b8b', '#ffd23f'), ('#5bc0eb', '#2fa84f'), ('#ffd23f', '#e2463b'), ('#8e5cd9', '#f4f6f8'), ('#2fa84f', '#ff9f1c')]
    for i, (a, b) in enumerate(arts):
        x = 3 + i * 9
        for z in (5, 15):
            v.box(x, x + 6, 2, 2, z, z + 7, '#ffffff'); v.box(x + 1, x + 5, 2, 2, z + 1, z + 4, a if z == 5 else b)
            v.box(x + 2, x + 4, 2, 2, z + 5, z + 6, b if z == 5 else a)
    v.box(18, 31, 2, 2, 24, 25, '#e2463b')
    return v


save('board_notice', board_notice(), note='prop')


def wall_clock():
    v = Vox(10, 2, 10)
    for x in range(10):
        for z in range(10):
            d = (x - 4.5) ** 2 + (z - 4.5) ** 2
            if d <= 21: v.put(x, 0, z, '#2b2b33')
            if d <= 13: v.put(x, 1, z, '#ffffff')
    v.box(4, 5, 1, 1, 5, 8, '#2b2b33'); v.box(5, 7, 1, 1, 4, 5, '#e2463b')
    return v


save('wall_clock', wall_clock(), note='prop')


def plant_pot():
    v = Vox(12, 12, 20)
    v.cyl(6, 6, 4, 0, 6, '#c8653a'); v.cyl(6, 6, 4.5, 6, 7, '#a84e2a')
    v.ball(6, 6, 12, 5, '#2fa84f', rz=6); v.ball(4, 5, 15, 3, '#4cc46a'); v.ball(8, 7, 14, 3, '#1f7a37')
    return v


save('plant_pot', plant_pot(), note='prop')


def globe():
    v = Vox(10, 10, 16)
    v.box(3, 6, 3, 6, 0, 1, '#8a6a42'); v.box(4, 5, 4, 5, 2, 5, '#c8955a')
    v.ball(4.5, 4.5, 10.5, 4.5, '#2f7de1')
    for (x, y, z) in [(1, 4, 11), (2, 3, 12), (2, 5, 9), (7, 2, 11), (6, 8, 12), (3, 7, 10), (8, 5, 9)]:
        v.ball(x, y, z, 1.5, '#2fa84f')
    return v


save('globe', globe(), note='prop')


def cleaning_cab():                     # 청소함 + 빗자루
    v = Vox(16, 10, 28)
    v.box(0, 15, 0, 9, 0, 27, '#7da7c9'); v.box(7, 8, 9, 9, 1, 26, '#5b7f9e'); v.put(6, 9, 14, '#2b2b33'); v.put(9, 9, 14, '#2b2b33')
    v.box(1, 6, 9, 9, 22, 25, '#ffffff')
    return v


save('cleaning_cab', cleaning_cab(), note='prop')


def class_flag():                       # 칠판 위 태극기 액자
    v = Vox(14, 2, 10)
    v.box(0, 13, 0, 1, 0, 9, '#8a6a42'); v.box(1, 12, 1, 1, 1, 8, '#ffffff')
    for x in range(5, 9):
        for z in range(3, 7):
            v.put(x, 1, z, '#e2463b' if z >= 5 else '#2f5da8')
    for (x, z) in [(2, 7), (3, 7), (10, 7), (11, 7), (2, 2), (3, 2), (10, 2), (11, 2)]: v.put(x, 1, z, '#2b2b33')
    return v


save('class_flag', class_flag(), note='prop')


def bottle_rack():                      # 물병·실내화 선반
    v = Vox(30, 8, 14)
    v.box(0, 29, 0, 7, 0, 0, '#c8ced4'); v.box(0, 29, 0, 7, 7, 7, '#c8ced4'); v.box(0, 0, 0, 7, 0, 13, '#9aa3ad'); v.box(29, 29, 0, 7, 0, 13, '#9aa3ad')
    cols = ['#ff6b8b', '#5bc0eb', '#ffd23f', '#2fa84f', '#8e5cd9', '#ff9f1c']
    for i, x in enumerate(range(2, 28, 4)):
        v.box(x, x + 1, 3, 4, 8, 12, cols[i % 6]); v.box(x, x + 2, 1, 6, 1, 2, cols[(i + 2) % 6])
    return v


save('bottle_rack', bottle_rack(), note='prop')


def atm():
    v = Vox(14, 12, 28)
    v.box(0, 13, 0, 11, 0, 27, '#d9dde2'); v.box(0, 13, 0, 11, 25, 27, '#2f7de1')
    v.box(2, 11, 11, 11, 16, 22, '#5bc0eb', glow=True); v.box(3, 10, 11, 11, 12, 14, '#5b626b'); v.box(4, 9, 11, 11, 8, 9, '#2b2b33')
    return v


save('atm', atm(), note='prop')


def coffee_machine():
    v = Vox(20, 12, 22)
    v.box(0, 19, 0, 11, 0, 9, '#8a6a42'); v.box(2, 17, 2, 10, 10, 21, '#2b2b33'); v.box(4, 9, 10, 10, 16, 19, '#e2463b', glow=True)
    v.box(11, 15, 10, 11, 10, 13, '#ffffff'); v.box(12, 14, 9, 9, 17, 18, '#ffd23f', glow=True)
    return v


save('coffee_machine', coffee_machine(), note='prop')


def ice_freezer():                      # 아이스크림 냉동고(윗면 유리)
    v = Vox(30, 16, 12)
    v.box(0, 29, 0, 15, 0, 11, '#ffffff'); v.box(0, 29, 15, 15, 2, 8, '#2f7de1'); v.clear(2, 27, 2, 13, 6, 11)
    cols = ['#ff6b8b', '#ffd23f', '#8a5a3a', '#5bc0eb', '#2fa84f']
    for x in range(2, 28, 2):
        for y in range(2, 14, 3): v.box(x, x + 1, y, y + 1, 6, 7 + (x + y) % 3, cols[(x + y) % 5])
    v.box(1, 28, 1, 14, 11, 11, '#cfe8f5', glow=True)
    return v


save('ice_freezer', ice_freezer(), note='prop')


def ramen_station():                    # 컵라면 온수기 + 테이블
    v = Vox(30, 12, 18)
    v.box(0, 29, 0, 11, 9, 10, '#eef1f4'); v.box(1, 2, 1, 10, 0, 8, '#9aa3ad'); v.box(27, 28, 1, 10, 0, 8, '#9aa3ad')
    v.box(3, 10, 2, 9, 11, 17, '#d9dde2'); v.box(5, 8, 9, 9, 12, 13, '#e2463b', glow=True)
    for x in (14, 19, 24): v.cyl(x, 6, 2, 11, 14, '#ffd23f'); v.cyl(x, 6, 2, 14, 14, '#e2463b')
    return v


save('ramen_station', ramen_station(), note='prop')


def mag_rack():
    v = Vox(24, 8, 20)
    v.box(0, 23, 0, 1, 0, 19, '#9aa3ad')
    cols = ['#e2463b', '#2f7de1', '#ffd23f', '#ff6b8b', '#2fa84f', '#8e5cd9']
    for row, z in enumerate((2, 8, 14)):
        v.box(0, 23, 2, 7, z - 1, z - 1, '#c8ced4')
        for i, x in enumerate(range(1, 23, 5)): v.box(x, x + 3, 3 + row % 2, 3 + row % 2, z, z + 5, cols[(i + row) % 6])
    return v


save('mag_rack', mag_rack(), note='prop')


def umbrella_stand():
    v = Vox(8, 8, 20)
    v.cyl(4, 4, 3, 0, 8, '#5b626b')
    for (x, y, c) in [(3, 3, '#2f7de1'), (5, 4, '#ffd23f'), (4, 5, '#e2463b')]:
        v.box(x, x, y, y, 8, 17, c); v.box(x, x + 1, y, y, 18, 19, '#2b2b33')
    return v


save('umbrella_stand', umbrella_stand(), note='prop')


def menu_board():                       # 분식집 벽 메뉴판
    v = Vox(50, 3, 18)
    v.box(0, 49, 0, 2, 0, 17, '#2b2b33'); v.box(1, 48, 2, 2, 1, 16, '#ffd23f')
    items = ['#e2463b', '#ff9f1c', '#f4f1ea', '#2fa84f', '#8a5a3a']
    for i, c in enumerate(items):
        x = 3 + i * 9
        v.box(x, x + 6, 2, 2, 8, 14, c); v.box(x, x + 6, 2, 2, 3, 5, '#2b2b33')
    return v


save('menu_board', menu_board(), note='prop')


def tteok_pan():                        # 떡볶이 큰 판 + 어묵 통
    v = Vox(34, 16, 14)
    v.box(0, 33, 0, 15, 0, 8, '#c8ced4'); v.box(0, 33, 0, 15, 9, 9, '#9aa3ad')
    v.box(2, 17, 2, 13, 10, 11, '#2b2b33'); v.box(3, 16, 3, 12, 11, 11, '#e2463b')
    for (x, y) in [(5, 5), (8, 7), (11, 5), (13, 9), (6, 10), (10, 10), (14, 6)]: v.box(x, x + 1, y, y, 12, 12, '#f4f1ea')
    v.box(20, 31, 2, 13, 10, 13, '#9aa3ad'); v.box(21, 30, 3, 12, 13, 13, '#c88a4a')
    for x in range(22, 30, 3): v.box(x, x, 6, 6, 14, 13 + 1, '#e8c08a')
    return v


save('tteok_pan', tteok_pan(), note='prop')


def water_purifier():
    v = Vox(10, 10, 26)
    v.box(0, 9, 0, 9, 0, 25, '#f4f6f8'); v.box(2, 7, 9, 9, 16, 22, '#5bc0eb', glow=True); v.box(3, 6, 9, 9, 10, 12, '#9aa3ad')
    v.box(1, 8, 4, 9, 2, 3, '#c8ced4'); v.box(3, 4, 9, 9, 13, 13, '#e2463b'); v.box(5, 6, 9, 9, 13, 13, '#2f7de1')
    return v


save('water_purifier', water_purifier(), note='prop')


def cushion_bench():                    # 분식집 벽쪽 긴 의자
    v = Vox(40, 8, 12)
    v.box(0, 39, 0, 7, 0, 4, '#8a6a42'); v.box(0, 39, 0, 7, 5, 6, '#e2463b'); v.box(0, 39, 0, 1, 7, 11, '#c2312a')
    return v


save('cushion_bench', cushion_bench(), note='prop')


def rug():
    v = Vox(40, 24, 1)
    for x in range(40):
        for y in range(24):
            c = '#ffd23f' if (x // 4 + y // 4) % 2 else '#5bc0eb'
            if x in (0, 39) or y in (0, 23): c = '#e2463b'
            v.put(x, y, 0, c)
    return v


save('rug', rug(), note='prop')


# ---------------- 새 건물 안 + 실내 미션 소품 ----------------
def bag_floor():                        # 통로에 놓인 책가방(걸려 넘어짐)
    v = Vox(12, 8, 10)
    v.box(1, 10, 1, 6, 0, 8, '#e2463b'); v.box(2, 9, 6, 7, 1, 5, '#c2312a'); v.box(3, 8, 7, 7, 2, 4, '#ffd23f'); v.box(4, 7, 0, 0, 7, 9, '#2b2b33')
    return v
save('bag_floor', bag_floor(), note='prop')


def multitap():                         # 문어발 콘센트
    v = Vox(16, 12, 4)
    v.box(2, 13, 4, 7, 0, 2, '#f4f6f8')
    for x in range(3, 13, 2): v.put(x, 5, 3, '#2b2b33')
    for i, (x, y) in enumerate([(1, 0), (5, 1), (9, 0), (14, 1), (0, 11), (7, 11), (13, 10)]):
        c = ['#2b2b33', '#e2463b', '#2f7de1', '#ffd23f'][i % 4]
        v.box(min(x, 7), max(x, 7), y, y, 0, 0, c); v.box(x, x, min(y, 6), max(y, 6), 0, 0, c)
    v.box(6, 9, 5, 6, 3, 3, '#ff6b2c', glow=True)
    return v
save('multitap', multitap(), note='prop')


def scissors():                         # 책상 위 펼쳐진 가위
    v = Vox(12, 12, 10)
    v.box(0, 11, 0, 11, 7, 8, '#e8c08a'); v.box(1, 2, 1, 2, 0, 6, '#8a6a42'); v.box(9, 10, 9, 10, 0, 6, '#8a6a42'); v.box(1, 2, 9, 10, 0, 6, '#8a6a42'); v.box(9, 10, 1, 2, 0, 6, '#8a6a42')
    for i in range(6): v.put(3 + i, 3 + i, 9, '#c8ced4'); v.put(8 - i, 3 + i, 9, '#c8ced4')
    v.box(2, 3, 8, 9, 9, 9, '#e2463b'); v.box(8, 9, 8, 9, 9, 9, '#e2463b')
    return v
save('scissors', scissors(), note='prop')


def puddle():                           # 젖은 바닥(물 웅덩이)
    v = Vox(16, 12, 1)
    for x in range(16):
        for y in range(12):
            if ((x - 8) / 7.5) ** 2 + ((y - 6) / 5.5) ** 2 <= 1 - 0.15 * ((x * 7 + y * 3) % 3 == 0):
                v.put(x, y, 0, '#8fd0f0' if (x + y) % 5 else '#d8f2ff', glow=True)
    return v
save('puddle', puddle(), note='prop')


def box_stack():                        # 높이 쌓여 기울어진 상자
    v = Vox(14, 12, 30)
    for i, (dx, c) in enumerate([(0, '#c8955a'), (1, '#b88548'), (2, '#c8955a'), (3, '#d8a56a'), (4, '#b88548')]):
        v.box(1 + dx, 9 + dx, 1, 10, i * 6, i * 6 + 5, c); v.box(1 + dx, 9 + dx, 10, 10, i * 6 + 2, i * 6 + 3, '#8a6a42')
    return v
save('box_stack', box_stack(), note='prop')


def cable_floor():                      # 바닥을 가로지르는 전선
    v = Vox(30, 8, 2)
    for x in range(30): v.box(x, x, 3 + int(2 * np.sin(x / 3)), 3 + int(2 * np.sin(x / 3)), 0, 0, '#2b2b33')
    v.box(26, 29, 2, 5, 0, 1, '#f4f6f8')
    return v
save('cable_floor', cable_floor(), note='prop')


def pot_handle():                       # 손잡이가 바깥으로 나온 냄비
    v = Vox(16, 20, 12)
    v.cyl(8, 7, 6, 0, 7, '#9aa3ad'); v.cyl(8, 7, 5, 7, 7, '#e2463b'); v.box(7, 9, 13, 19, 5, 6, '#2b2b33')
    for (x, y) in [(6, 5), (10, 8), (8, 4)]: v.put(x, y, 8, '#f4f1ea')
    return v
save('pot_handle', pot_handle(), note='prop')


def med_shelf():                        # 약국 약장
    v = Vox(40, 10, 28)
    v.box(0, 39, 0, 9, 0, 27, '#f4f6f8'); v.clear(1, 38, 3, 9, 1, 26)
    cols = ['#2f7de1', '#e2463b', '#2fa84f', '#ffd23f', '#ffffff', '#ff9f1c']
    for z0 in (1, 8, 15, 22):
        v.box(1, 38, 3, 9, z0 - 1 if z0 > 1 else 0, z0 - 1 if z0 > 1 else 0, '#d9dde2')
        for x in range(2, 38, 3): v.box(x, x + 1, 4, 7, z0, z0 + 2 + (x % 3), cols[(x + z0) % 6])
    v.box(14, 25, 0, 0, 24, 27, '#2fa84f'); v.box(19, 20, 0, 0, 25, 26, '#ffffff')
    return v
save('med_shelf', med_shelf(), note='prop')


def pharm_counter():
    v = Vox(40, 12, 14)
    v.box(0, 39, 0, 11, 0, 10, '#ffffff'); v.box(0, 39, 0, 11, 11, 11, '#2fa84f'); v.box(0, 39, 11, 11, 2, 4, '#2fa84f')
    v.box(30, 35, 3, 8, 12, 15, '#2b2b33'); v.box(31, 34, 8, 8, 13, 14, '#5bc0eb', glow=True)
    v.box(6, 11, 3, 7, 12, 13, '#e8eef2'); v.box(15, 18, 4, 6, 12, 13, '#ffd23f')
    return v
save('pharm_counter', pharm_counter(), note='prop')


def pill_bottle():                      # 낮은 탁자 위 알약통(뚜껑 열림)
    v = Vox(14, 12, 14)
    v.box(0, 13, 0, 11, 6, 7, '#c8955a'); v.box(1, 2, 1, 2, 0, 5, '#8a6a42'); v.box(11, 12, 9, 10, 0, 5, '#8a6a42'); v.box(1, 2, 9, 10, 0, 5, '#8a6a42'); v.box(11, 12, 1, 2, 0, 5, '#8a6a42')
    v.cyl(5, 5, 2.5, 8, 13, '#ff9f1c'); v.box(4, 6, 6, 6, 9, 11, '#ffffff')
    for (x, y, c) in [(9, 4, '#ff6b8b'), (10, 7, '#ffd23f'), (8, 8, '#5bc0eb'), (11, 5, '#ff6b8b')]: v.put(x, y, 8, c)
    return v
save('pill_bottle', pill_bottle(), note='prop')


def syrup():                            # 냉장고 옆 바닥에 놓인 물약
    v = Vox(8, 8, 14)
    v.cyl(4, 4, 3, 0, 9, '#c8653a'); v.cyl(4, 4, 1.5, 10, 13, '#ffffff'); v.box(1, 6, 7, 7, 3, 7, '#ffffff'); v.box(2, 5, 7, 7, 4, 5, '#e2463b')
    return v
save('syrup', syrup(), note='prop')


def gummy_jar():                        # 사탕처럼 생긴 영양제 통
    v = Vox(10, 10, 14)
    v.cyl(5, 5, 4, 0, 10, '#e8f6ff'); v.cyl(5, 5, 4, 11, 13, '#ff6b8b')
    for z in range(1, 10, 2):
        for (x, y) in [(3, 2), (6, 3), (2, 6), (7, 7), (5, 8)]: v.put(x, y + (z % 3) - 1, z, ['#ff6b8b', '#ffd23f', '#2fa84f', '#ff9f1c'][(x + z) % 4])
    v.box(2, 7, 9, 9, 4, 7, '#ffffff')
    return v
save('gummy_jar', gummy_jar(), note='prop')


def punch_bag():
    v = Vox(10, 10, 32)
    v.box(4, 5, 4, 5, 28, 31, '#5b626b'); v.cyl(5, 5, 4, 4, 27, '#e2463b'); v.cyl(5, 5, 4, 4, 5, '#2b2b33'); v.cyl(5, 5, 4, 26, 27, '#2b2b33')
    v.box(1, 8, 1, 8, 0, 0, '#2b2b33')
    return v
save('punch_bag', punch_bag(), note='prop')


def trophy_shelf():
    v = Vox(36, 8, 26)
    v.box(0, 35, 0, 7, 0, 25, '#8a6a42'); v.clear(1, 34, 2, 7, 1, 24)
    for z0 in (1, 13):
        v.box(1, 34, 2, 7, z0 + 10, z0 + 10, '#a87a45')
        for x in range(3, 34, 6):
            v.box(x, x + 2, 4, 5, z0, z0 + 1, '#5b626b'); v.box(x + 1, x + 1, 4, 5, z0 + 2, z0 + 4, '#ffd23f'); v.box(x, x + 2, 3, 6, z0 + 5, z0 + 7, '#ffd23f')
    return v
save('trophy_shelf', trophy_shelf(), note='prop')


def shoe_loose():                       # 끈 풀린 운동화
    v = Vox(14, 10, 5)
    for x0 in (1, 8):
        v.box(x0, x0 + 4, 1, 8, 0, 1, '#f4f6f8'); v.box(x0, x0 + 4, 1, 5, 2, 3, '#2f7de1'); v.box(x0 + 1, x0 + 3, 2, 3, 4, 4, '#2f7de1')
    for i in range(6): v.put(6 + (i % 2), 9 - i // 2, 0, '#ffffff'); v.put(4 - i // 2, 9, 0, '#ffffff')
    return v
save('shoe_loose', shoe_loose(), note='prop')


def dumbbell():
    v = Vox(16, 6, 6)
    v.box(3, 12, 2, 3, 2, 3, '#9aa3ad'); v.box(0, 3, 0, 5, 0, 5, '#2b2b33'); v.box(12, 15, 0, 5, 0, 5, '#2b2b33')
    return v
save('dumbbell', dumbbell(), note='prop')


def elevator():                         # 엘리베이터 문(벽)
    v = Vox(30, 4, 34)
    v.box(0, 29, 0, 3, 0, 33, '#c8ced4'); v.box(4, 25, 3, 3, 0, 27, '#9aa3ad'); v.box(14, 15, 3, 3, 0, 27, '#5b626b')
    v.box(10, 19, 3, 3, 29, 32, '#2b2b33'); v.box(12, 17, 3, 3, 30, 31, '#ff6b2c', glow=True)
    return v
save('elevator', elevator(), note='prop')


def elev_panel():                       # 비상벨(인터폰) 버튼판
    v = Vox(8, 3, 26)
    v.box(0, 7, 0, 2, 12, 25, '#d9dde2')
    for z in (14, 17, 20): v.box(2, 5, 2, 2, z, z + 1, '#f4f6f8')
    v.box(1, 6, 2, 2, 22, 24, '#ffd23f', glow=True); v.box(3, 4, 2, 2, 23, 23, '#e2463b', glow=True)
    return v
save('elev_panel', elev_panel(), note='prop')


def mailboxes():
    v = Vox(30, 8, 22)
    v.box(0, 29, 0, 7, 0, 21, '#9aa3ad')
    for x in range(1, 29, 5):
        for z in range(2, 20, 5): v.box(x, x + 3, 7, 7, z, z + 3, '#c8ced4'); v.put(x + 1, 7, z + 2, '#2b2b33')
    return v
save('mailboxes', mailboxes(), note='prop')


def stairs_door():                      # 비상계단 문 + 초록 비상구 표시
    v = Vox(20, 4, 34)
    v.box(0, 19, 0, 3, 0, 33, '#d9dde2'); v.box(3, 16, 3, 3, 0, 26, '#7a8a9a'); v.box(13, 14, 3, 3, 12, 14, '#2b2b33')
    v.box(4, 15, 3, 3, 28, 32, '#2fa84f', glow=True); v.box(6, 8, 3, 3, 29, 31, '#ffffff', glow=True)
    return v
save('stairs_door', stairs_door(), note='prop')


def phone_stand():                      # 관리실 인터폰
    v = Vox(10, 6, 24)
    v.box(4, 5, 2, 3, 0, 14, '#5b626b'); v.box(1, 8, 1, 4, 15, 23, '#f4f6f8'); v.box(2, 7, 4, 4, 18, 21, '#5bc0eb', glow=True); v.box(3, 6, 4, 4, 16, 16, '#2fa84f')
    return v
save('phone_stand', phone_stand(), note='prop')


def lab_table():                        # 과학실 실험대(검은 상판)
    v = Vox(36, 18, 14)
    v.box(0, 35, 0, 17, 0, 10, '#c8ced4'); v.box(0, 35, 0, 17, 11, 11, '#2b2b33')
    v.box(15, 20, 6, 11, 12, 12, '#9aa3ad'); v.box(17, 18, 8, 9, 12, 16, '#c8ced4')
    return v
save('lab_table', lab_table(), note='prop')


def goggles():                          # 보안경 바구니
    v = Vox(14, 10, 8)
    v.box(0, 13, 0, 9, 0, 4, '#2f7de1'); v.clear(1, 12, 1, 8, 1, 4)
    for x0 in (2, 8): v.box(x0, x0 + 3, 3, 6, 4, 6, '#cfe8f5', glow=True); v.box(x0, x0 + 3, 3, 3, 4, 6, '#2b2b33')
    v.box(6, 7, 4, 5, 5, 5, '#2b2b33')
    return v
save('goggles', goggles(), note='prop')


def lab_coat():                         # 옷걸이의 실험복
    v = Vox(12, 6, 30)
    v.box(5, 6, 2, 3, 0, 29, '#8a6a42'); v.box(2, 9, 1, 4, 0, 0, '#8a6a42')
    v.box(2, 9, 0, 1, 10, 25, '#ffffff'); v.box(1, 1, 0, 1, 14, 24, '#ffffff'); v.box(10, 10, 0, 1, 14, 24, '#ffffff'); v.box(5, 6, 0, 0, 12, 24, '#d9dde2')
    return v
save('lab_coat', lab_coat(), note='prop')


def alcohol_lamp():                     # 켜진 알코올램프 + 뚜껑
    v = Vox(10, 10, 14)
    v.ball(4, 5, 3, 3.5, '#e8f6ff', rz=3); v.box(3, 5, 4, 6, 6, 7, '#9aa3ad')
    v.box(4, 4, 5, 5, 8, 12, '#ffd23f', glow=True); v.box(3, 5, 5, 5, 8, 9, '#ff6b2c', glow=True)
    v.cyl(8, 8, 1.5, 0, 3, '#c8ced4')
    return v
save('alcohol_lamp', alcohol_lamp(), note='prop')


def beaker():                           # 연기 나는 비커(직접 냄새 맡기 X)
    v = Vox(8, 8, 18)
    v.cyl(4, 4, 3, 0, 8, '#cfe8f5'); v.cyl(4, 4, 2.5, 1, 5, '#8e5cd9')
    for z in range(10, 18, 2): v.put(3 + (z % 4) // 2, 4, z, '#d8d0e8')
    return v
save('beaker', beaker(), note='prop')


def skeleton_model():
    v = Vox(12, 8, 34)
    v.box(5, 6, 3, 4, 0, 3, '#5b626b'); v.box(2, 9, 2, 5, 0, 0, '#5b626b')
    W = '#f4f1ea'
    v.box(4, 4, 3, 4, 4, 15, W); v.box(7, 7, 3, 4, 4, 15, W); v.box(3, 8, 3, 4, 16, 17, W)
    for z in (19, 21, 23, 25): v.box(3, 8, 3, 4, z, z, W)
    v.box(5, 6, 3, 4, 16, 27, W); v.box(1, 1, 3, 4, 15, 25, W); v.box(10, 10, 3, 4, 15, 25, W); v.box(2, 9, 3, 4, 26, 26, W)
    v.box(3, 8, 2, 6, 28, 33, W); v.put(4, 6, 31, '#2b2b33'); v.put(7, 6, 31, '#2b2b33')
    return v
save('skeleton_model', skeleton_model(), note='prop')


def sink():
    v = Vox(20, 12, 16)
    v.box(0, 19, 0, 11, 0, 10, '#d9dde2'); v.box(2, 17, 2, 9, 10, 10, '#9aa3ad'); v.box(9, 10, 1, 2, 11, 15, '#c8ced4'); v.box(9, 10, 2, 5, 15, 15, '#c8ced4')
    return v
save('sink', sink(), note='prop')


def apt_entrance():                     # 아파트 공동현관(외부)
    v = Vox(40, 14, 40)
    v.box(0, 39, 0, 3, 0, 39, '#d9cdb8')
    v.box(10, 29, 3, 3, 0, 27, '#5b7f9e'); v.box(11, 18, 3, 3, 1, 26, '#a8d8f0', glow=True); v.box(21, 28, 3, 3, 1, 26, '#a8d8f0', glow=True)
    v.box(6, 33, 3, 13, 30, 32, '#7a8a9a'); v.box(7, 8, 12, 13, 0, 29, '#7a8a9a'); v.box(31, 32, 12, 13, 0, 29, '#7a8a9a')
    v.box(14, 25, 3, 3, 34, 37, '#2f5da8'); v.box(17, 22, 3, 3, 35, 36, '#ffffff')
    v.box(8, 31, 4, 13, 0, 0, '#c8ced4'); v.box(32, 35, 3, 4, 10, 15, '#2b2b33'); v.box(33, 34, 4, 4, 12, 14, '#5bc0eb', glow=True)
    return v
save('apt_entrance', apt_entrance(), note='prop')


def school_door():                      # 학교 옆문(과학실 쪽)
    v = Vox(24, 10, 32)
    v.box(0, 23, 0, 2, 0, 31, '#e8dcc8'); v.box(5, 18, 2, 2, 0, 22, '#7da7c9'); v.box(6, 11, 2, 2, 2, 20, '#cfe8f5', glow=True); v.box(12, 17, 2, 2, 2, 20, '#cfe8f5', glow=True)
    v.box(2, 21, 2, 9, 24, 25, '#2fa84f'); v.box(4, 19, 2, 2, 27, 30, '#ffffff'); v.box(7, 16, 2, 2, 28, 29, '#2f7de1')
    return v
save('school_door', school_door(), note='prop')


def check_mark():                       # 찾은 물건 위 초록 체크
    v = Vox(12, 3, 12)
    for i in range(4): v.box(1 + i, 2 + i, 1, 1, 5 - i, 6 - i, '#2fa84f', glow=True)
    for i in range(7): v.box(4 + i, 5 + i, 1, 1, 2 + i, 3 + i, '#2fa84f', glow=True)
    return v
save('check_mark', check_mark(), note='prop')


# ---------------- 2차: 체육관 · 보건실 · 급식실 · 학원 ----------------
def gym_mat():
    v = Vox(30, 20, 4)
    v.box(0, 29, 0, 19, 0, 3, '#2f7de1'); v.box(1, 28, 1, 18, 3, 3, '#3b8af0'); v.box(14, 15, 0, 19, 3, 3, '#1f5fb3')
    return v
save('gym_mat', gym_mat(), note='prop')


def vault_box():                        # 매트 없이 놓인 뜀틀
    v = Vox(24, 12, 16)
    for i, z in enumerate(range(0, 12, 3)):
        v.box(i // 2, 23 - i // 2, 0, 11, z, z + 2, '#c8955a' if i % 2 else '#b88548')
    v.box(2, 21, 1, 10, 12, 15, '#f4f1ea'); v.box(2, 21, 1, 1, 13, 14, '#e2463b')
    return v
save('vault_box', vault_box(), note='prop')


def ball_cart():
    v = Vox(20, 14, 18)
    v.box(0, 19, 0, 13, 2, 2, '#9aa3ad'); v.box(0, 0, 0, 13, 2, 12, '#9aa3ad'); v.box(19, 19, 0, 13, 2, 12, '#9aa3ad'); v.box(0, 19, 0, 0, 2, 12, '#9aa3ad'); v.box(0, 19, 13, 13, 2, 12, '#9aa3ad')
    for (x, y) in [(1, 1), (18, 1), (1, 12), (18, 12)]: v.box(x, x, y, y, 0, 1, '#2b2b33')
    for i, (x, y, z) in enumerate([(5, 4, 6), (12, 4, 6), (5, 10, 6), (13, 10, 6), (9, 7, 11), (15, 6, 11)]):
        v.ball(x, y, z, 3.2, ['#ff9f1c', '#f4f6f8', '#e2463b', '#ff9f1c', '#2f7de1', '#ffd23f'][i])
    return v
save('ball_cart', ball_cart(), note='prop')


def ball_floor():                       # 굴러다니는 공
    v = Vox(9, 9, 9)
    v.ball(4, 4, 4, 4, '#ff9f1c')
    for z in range(9): v.put(4, 0 if z < 9 else 0, z, '#2b2b33')
    for x in range(9): v.put(x, 4, 8 if 2 < x < 6 else 4, '#2b2b33')
    return v
save('ball_floor', ball_floor(), note='prop')


def nurse_bed():
    v = Vox(20, 36, 12)
    v.box(0, 19, 0, 35, 4, 6, '#d9dde2'); v.box(1, 18, 1, 34, 7, 8, '#ffffff'); v.box(2, 17, 1, 8, 9, 10, '#cfe8f5'); v.box(1, 18, 14, 34, 9, 9, '#ff9fb8')
    for (x, y) in [(0, 0), (19, 0), (0, 35), (19, 35)]: v.box(x, x, y, y, 0, 3, '#9aa3ad')
    v.box(0, 19, 0, 0, 4, 11, '#c8ced4')
    return v
save('nurse_bed', nurse_bed(), note='prop')


def height_meter():
    v = Vox(10, 10, 36)
    v.box(0, 9, 0, 9, 0, 1, '#d9dde2'); v.box(4, 5, 0, 1, 0, 35, '#f4f6f8')
    for z in range(4, 36, 4): v.put(4, 2, z, '#e2463b')
    v.box(3, 6, 1, 5, 26, 26, '#5b626b')
    return v
save('height_meter', height_meter(), note='prop')


def first_aid_kit():                    # 구급상자(소독약)
    v = Vox(14, 10, 10)
    v.box(0, 13, 0, 9, 0, 7, '#ffffff'); v.box(0, 13, 0, 9, 8, 8, '#e2463b'); v.box(5, 8, 9, 9, 2, 6, '#e2463b'); v.box(4, 9, 9, 9, 3, 5, '#e2463b')
    v.box(10, 12, 3, 5, 9, 9, '#c8653a')
    return v
save('first_aid_kit', first_aid_kit(), note='prop')


def bandage():                          # 밴드 상자
    v = Vox(10, 8, 6)
    v.box(0, 9, 0, 7, 0, 4, '#ffd23f'); v.box(1, 8, 2, 5, 5, 5, '#f2c8a0'); v.box(4, 5, 2, 5, 5, 5, '#e8b090')
    return v
save('bandage', bandage(), note='prop')


def cafe_table():                       # 급식실 긴 식탁 + 식판
    v = Vox(44, 16, 12)
    v.box(0, 43, 0, 15, 8, 9, '#e8eef2'); v.box(2, 3, 2, 13, 0, 7, '#9aa3ad'); v.box(40, 41, 2, 13, 0, 7, '#9aa3ad')
    for x in (3, 15, 27):
        for y in (1, 9):
            v.box(x, x + 9, y, y + 5, 10, 10, '#c8ced4'); v.box(x + 1, x + 3, y + 1, y + 2, 11, 11, '#ffffff'); v.box(x + 5, x + 8, y + 1, y + 2, 11, 11, '#e2463b'); v.box(x + 2, x + 7, y + 4, y + 4, 11, 11, '#2fa84f')
    return v
save('cafe_table', cafe_table(), note='prop')


def serving_line():                     # 배식대
    v = Vox(50, 14, 16)
    v.box(0, 49, 0, 13, 0, 9, '#c8ced4'); v.box(0, 49, 0, 13, 10, 10, '#9aa3ad'); v.box(0, 49, 0, 0, 10, 15, '#cfe8f5', glow=True)
    for i, c in enumerate(['#f4f1ea', '#e2463b', '#2fa84f', '#ff9f1c', '#8a5a3a']):
        x = 3 + i * 9; v.box(x, x + 6, 3, 10, 11, 11, c)
    return v
save('serving_line', serving_line(), note='prop')


def tray_stack():
    v = Vox(14, 10, 14)
    v.box(0, 13, 0, 9, 0, 5, '#9aa3ad')
    for z in range(6, 14): v.box(1, 12, 1, 8, z, z, '#c8ced4' if z % 2 else '#d9dde2')
    return v
save('tray_stack', tray_stack(), note='prop')


def hot_soup():                         # 뜨거운 국통(김이 남)
    v = Vox(14, 14, 20)
    v.cyl(7, 7, 6, 0, 9, '#c8ced4'); v.cyl(7, 7, 5, 9, 9, '#c8653a'); v.box(0, 1, 6, 8, 6, 7, '#5b626b'); v.box(12, 13, 6, 8, 6, 7, '#5b626b')
    for z in range(11, 20, 2): v.put(5 + (z % 4), 7, z, '#f4f6f8'); v.put(9 - (z % 3), 5, z + 1 if z < 19 else z, '#f4f6f8')
    return v
save('hot_soup', hot_soup(), note='prop')


def whiteboard():
    v = Vox(50, 4, 26)
    v.box(0, 49, 0, 3, 4, 25, '#c8ced4'); v.box(1, 48, 3, 3, 5, 24, '#ffffff'); v.box(20, 23, 1, 2, 0, 4, '#9aa3ad')
    for i, x in enumerate(range(5, 40, 9)): v.box(x, x + 6, 3, 3, 18 - i % 2 * 2, 18 - i % 2 * 2, '#2f7de1')
    v.box(5, 30, 3, 3, 10, 10, '#e2463b'); v.box(5, 22, 3, 3, 13, 13, '#2b2b33')
    return v
save('whiteboard', whiteboard(), note='prop')


def heater():                           # 난로 옆 종이 더미
    v = Vox(20, 12, 18)
    v.box(0, 9, 2, 9, 0, 15, '#e2463b'); v.box(1, 8, 9, 9, 3, 12, '#ff6b2c', glow=True); v.box(1, 8, 9, 9, 5, 10, '#ffd23f', glow=True)
    v.box(12, 19, 3, 10, 0, 5, '#f4f1ea'); v.box(13, 18, 4, 9, 6, 6, '#e8e2d2')
    return v
save('heater', heater(), note='prop')


def exit_sign_blocked():                # 비상구 문 앞에 쌓인 의자
    v = Vox(24, 12, 34)
    v.box(0, 23, 0, 3, 0, 33, '#d9dde2'); v.box(4, 19, 3, 3, 0, 26, '#7a8a9a')
    v.box(5, 18, 3, 3, 28, 32, '#2fa84f', glow=True); v.box(7, 9, 3, 3, 29, 31, '#ffffff', glow=True)
    for i, z in enumerate((0, 7, 14)):
        x = 6 + i; v.box(x, x + 9, 6, 11, z + 5, z + 6, '#2f7de1'); v.box(x, x, 6, 6, z, z + 5, '#5b626b'); v.box(x + 9, x + 9, 11, 11, z, z + 5, '#5b626b'); v.box(x, x + 9, 11, 11, z + 6, z + 10, '#2f7de1')
    return v
save('exit_sign_blocked', exit_sign_blocked(), note='prop')


def kid_desk():                         # 학원 작은 책상
    v = Vox(16, 12, 10)
    v.box(0, 15, 0, 11, 8, 9, '#f4f1ea'); v.box(1, 2, 1, 2, 0, 7, '#9aa3ad'); v.box(13, 14, 1, 2, 0, 7, '#9aa3ad'); v.box(1, 2, 9, 10, 0, 7, '#9aa3ad'); v.box(13, 14, 9, 10, 0, 7, '#9aa3ad')
    v.box(4, 10, 3, 8, 10, 10, '#ffffff'); v.box(11, 11, 3, 8, 10, 10, '#e2463b')
    return v
save('kid_desk', kid_desk(), note='prop')


# ---------------- 가현초편: 실제 지도 발자국 학교 건물 + 동네 명소 ----------------
GH = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'gahyeon_grid.json')))


def footprint_gh(chars):
    cells = {(x, y) for y in range(GH['H']) for x in range(GH['W']) if GH['bldg'][y][x] in chars}
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    return cells, min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


for nm, chars, kw in (
    ('bld_gahyeon', 'b', dict(wall='#f6ecd9', band='#3f8f5a', accent='#2fa84f', floors=4)),
    ('bld_gahyeon_gym', 'c', dict(wall='#e9dcc0', band='#3f8f5a', gym=True, floors=2, name_board=False)),
    ('bld_gahyeon_mid', 'm', dict(wall='#eef1f4', band='#7c5cc8', accent='#7c3aed', floors=4)),
):
    cells, bx, by, tw, th = footprint_gh(chars)
    save(nm, school_building(cells, bx, by, tw, th, **kw), vox=0.5, note='world')
    MANIFEST[nm].update(bx=bx, by=by, tw=tw, th=th)


def waterwheel():                                               # 수차공원 물레방아
    v = Vox(30, 22, 34)
    v.box(0, 29, 0, 21, 0, 1, '#9aa3ad'); v.box(2, 27, 6, 15, 1, 2, '#5bc0eb', glow=True)      # 물길
    for y0 in (4, 17):                                          # 바퀴 두 장
        for a in range(0, 360, 8):
            import math
            r = 12; x = int(15 + r * math.cos(math.radians(a))); z = int(15 + r * math.sin(math.radians(a)))
            v.box(x, x, y0, y0 + 1, z, z, '#8a5a32')
        for a in range(0, 180, 30):
            for t in range(-12, 13):
                x = int(15 + t * math.cos(math.radians(a))); z = int(15 + t * math.sin(math.radians(a)))
                v.put(x, y0, z, '#a8743f')
    for a in range(0, 360, 30):                                 # 물받이 판
        x = int(15 + 12 * math.cos(math.radians(a))); z = int(15 + 12 * math.sin(math.radians(a)))
        v.box(x - 1, x + 1, 5, 16, z, z, '#c8955a')
    v.box(14, 16, 2, 19, 14, 16, '#5a3a22')                     # 굴대
    v.box(0, 3, 0, 21, 2, 18, '#7a8a6a'); v.box(26, 29, 0, 21, 2, 18, '#7a8a6a')   # 돌 기둥
    v.box(0, 29, 0, 3, 28, 31, '#6b4a2a'); v.box(0, 29, 18, 21, 28, 31, '#6b4a2a')
    return v


save('waterwheel', waterwheel(), note='prop')


def duck_spring():                                              # 오리 놀이터 스프링 오리
    v = Vox(14, 20, 22)
    for z in range(0, 7):
        v.put(7, 10, z, '#9aa3ad'); v.put(6 + z % 2, 9 + z % 2, z, '#c8ced4')
    v.box(3, 10, 5, 15, 7, 12, '#ffd23f'); v.box(4, 9, 4, 14, 13, 13, '#ffd23f')            # 몸통
    v.box(4, 9, 14, 18, 12, 18, '#ffd23f'); v.box(5, 8, 18, 19, 14, 15, '#ff9f1c')           # 머리·부리
    v.put(4, 17, 16, '#1d2a33'); v.put(9, 17, 16, '#1d2a33')
    v.box(2, 3, 8, 12, 10, 12, '#ffe680'); v.box(10, 11, 8, 12, 10, 12, '#ffe680')        # 날개
    v.box(3, 10, 2, 5, 10, 12, '#ffe680'); v.box(1, 12, 12, 12, 13, 13, '#e2463b')         # 꼬리·손잡이
    return v


save('duck_spring', duck_spring(), note='prop')


def fountain():                                                 # 루에블리 분수대
    v = Vox(30, 30, 26)
    v.cyl(15, 15, 14, 0, 3, '#c8ced4'); v.cyl(15, 15, 12, 2, 3, '#5bc0eb')
    for z in range(2, 4): v.cyl(15, 15, 12, z, z, '#5bc0eb')
    v.cyl(15, 15, 6, 4, 8, '#dfe6ea'); v.cyl(15, 15, 5, 8, 8, '#7fd0f0')
    v.cyl(15, 15, 2, 9, 14, '#dfe6ea')
    for z in range(14, 24): v.cyl(15, 15, 1 + (24 - z) // 5, z, z, '#bfeaff')
    for a in range(8):
        import math
        x = int(15 + 9 * math.cos(a * math.pi / 4)); y = int(15 + 9 * math.sin(a * math.pi / 4))
        for z in range(4, 11): v.put(x, y, z, '#cfefff')
    return v


save('fountain', fountain(), note='prop')


def school_stone():                                             # 교명 표지석 '가현초등학교'
    v = Vox(30, 12, 22)
    v.box(0, 29, 0, 11, 0, 2, '#9aa3ad')
    v.box(2, 27, 2, 9, 3, 18, '#b8b0a2'); v.box(4, 24, 2, 8, 19, 20, '#a89f90')
    v.box(5, 24, 10, 10, 6, 15, '#2f5d3a')
    for x in range(7, 23, 4): v.box(x, x + 1, 10, 10, 8, 13, '#ffffff')
    for x in (1, 28): v.box(x, x, 1, 10, 3, 5, '#7fb85a')
    return v


save('school_stone', school_stone(), note='prop')


def apt_gate():                                                 # 아파트 단지 문주(입구 기둥 + 이름판)
    v = Vox(80, 12, 44)
    for x0 in (0, 70):
        v.box(x0, x0 + 9, 0, 11, 0, 35, '#d9cdb8'); v.box(x0 + 2, x0 + 7, 11, 11, 6, 30, '#c2b49a')
    v.box(0, 79, 2, 9, 36, 41, '#6b5a48'); v.box(18, 61, 9, 9, 37, 40, '#f4efe4')
    for x in range(22, 58, 5): v.box(x, x + 2, 9, 9, 38, 39, '#2f5da8')
    v.box(10, 69, 4, 7, 0, 0, '#c8ced4')
    return v


save('apt_gate', apt_gate(), note='prop')


def flower_bed():                                               # 학교 앞 화단
    v = Vox(32, 10, 8)
    v.box(0, 31, 0, 9, 0, 3, '#a87a45'); v.box(1, 30, 1, 8, 4, 4, '#6b4a2a')
    cols = ['#ff6b8a', '#ffd23f', '#ffffff', '#c86bff', '#ff9f1c']
    for x in range(2, 30, 3):
        for y in (2, 6):
            v.box(x, x, y, y, 5, 5, '#3f8f3a'); v.put(x, y, 6, cols[(x + y) % 5]); v.put(x + 1, y, 6, cols[(x + y + 1) % 5])
    return v


save('flower_bed', flower_bed(), note='prop')


def drop_off_sign():                                            # 승하차 구역 표지판
    v = Vox(12, 4, 30)
    v.box(5, 6, 1, 2, 0, 20, '#9aa3ad'); v.box(0, 11, 0, 3, 20, 29, '#2f7de1')
    v.box(2, 9, 3, 3, 22, 27, '#ffffff'); v.box(4, 7, 3, 3, 23, 26, '#ffd23f')
    return v


save('drop_off_sign', drop_off_sign(), note='prop')


# ---------------- 가현초편 2차: 동네 생활 소품 ----------------
import math as _m


def shade_canopy():                                             # 횡단보도 그늘막(접이식 큰 파라솔)
    v = Vox(36, 36, 40)
    v.cyl(18, 18, 1.2, 0, 30, '#9aa3ad'); v.cyl(18, 18, 3, 0, 1, '#5b626b')
    for z in range(28, 38):
        r = 17 * (38 - z) / 10 + 1
        v.cyl(18, 18, r, z, z, '#2fa84f' if (z % 3) else '#25904a')
    for a in range(0, 360, 45):
        x = int(18 + 16 * _m.cos(_m.radians(a))); y = int(18 + 16 * _m.sin(_m.radians(a))); v.box(x, x, y, y, 26, 28, '#e8f5ea')
    return v


def shared_kick():                                              # 공유 전동킥보드(초록, 서 있는 것)
    v = Vox(6, 18, 22)
    v.wheel(2, 3, 2, 1, 1); v.wheel(2, 3, 15, 1, 1)
    v.box(1, 4, 2, 15, 2, 2, '#2fa84f'); v.box(2, 3, 15, 16, 3, 18, '#5b626b'); v.box(0, 5, 16, 16, 19, 19, '#2b2b33')
    v.box(2, 3, 15, 15, 14, 15, '#c8ff3a'); v.box(1, 4, 6, 10, 3, 3, '#1d2a33')
    return v


def bus_info():                                                 # 버스 도착 안내 전광판(BIT)
    v = Vox(22, 6, 34)
    v.box(2, 3, 2, 3, 0, 22, '#5b626b'); v.box(18, 19, 2, 3, 0, 22, '#5b626b')
    v.box(0, 21, 1, 4, 22, 33, '#2b3440'); v.box(1, 20, 4, 4, 23, 32, '#101418')
    for i, y in enumerate((30, 27, 24)):
        v.box(2, 7, 4, 4, y, y + 1, '#ffb020', glow=True); v.box(9, 18, 4, 4, y, y + 1, ['#2cff7a', '#ffd23f', '#ff6040'][i], glow=True)
    return v


def bungeoppang():                                              # 붕어빵 포장마차
    v = Vox(28, 18, 30)
    v.wheel(2, 3, 4, 2, 2); v.wheel(24, 25, 4, 2, 2)
    v.box(1, 26, 1, 16, 3, 12, '#e8dcc8'); v.box(1, 26, 1, 2, 3, 12, '#c8623a')
    v.box(4, 23, 3, 10, 13, 13, '#3a3f47')
    for x in range(5, 22, 4): v.box(x, x + 2, 4, 6, 14, 14, '#d8963a'); v.box(x, x + 2, 7, 9, 14, 14, '#c8822a')
    for x in (1, 26): v.box(x, x, 1, 1, 13, 26, '#9aa3ad'); v.box(x, x, 16, 16, 13, 26, '#9aa3ad')
    v.box(0, 27, 0, 17, 27, 28, '#e2463b'); v.box(0, 27, 0, 17, 26, 26, '#fff0e0')
    v.box(7, 20, 0, 0, 21, 25, '#ffd23f'); v.box(9, 18, 0, 0, 22, 24, '#c8623a')
    return v


def parasol_table():                                            # 편의점 앞 파라솔 테이블
    v = Vox(26, 26, 32)
    v.cyl(13, 13, 5, 9, 10, '#f4f6f8'); v.cyl(13, 13, 1, 0, 9, '#9aa3ad'); v.cyl(13, 13, 0.8, 10, 26, '#9aa3ad')
    for (x, y) in ((4, 13), (22, 13), (13, 4), (13, 22)): v.box(x - 1, x + 1, y - 1, y + 1, 0, 5, '#2f7de1')
    for z in range(24, 30):
        r = 12 * (30 - z) / 6 + 1
        for yy in range(26):
            for xx in range(26):
                d = (xx - 13) ** 2 + (yy - 13) ** 2
                if d <= r * r: v.put(xx, yy, z, '#ff9f1c' if int(_m.degrees(_m.atan2(yy - 13, xx - 13)) // 45) % 2 else '#ffffff')
    return v


def clothes_bin():                                              # 의류수거함
    v = Vox(14, 10, 22)
    v.box(0, 13, 0, 9, 0, 19, '#3f8f5a'); v.box(0, 13, 0, 9, 20, 21, '#2f6f45')
    v.box(3, 10, 9, 9, 13, 16, '#2b3440'); v.box(2, 11, 9, 9, 5, 9, '#ffffff'); v.box(4, 9, 9, 9, 6, 8, '#3f8f5a')
    return v


def ev_charger():                                               # 전기차 충전기
    v = Vox(10, 8, 22)
    v.box(1, 8, 1, 6, 0, 20, '#f4f6f8'); v.box(1, 8, 1, 6, 21, 21, '#2fa84f')
    v.box(3, 6, 6, 6, 13, 18, '#101418'); v.box(4, 5, 6, 6, 15, 16, '#2cff7a', glow=True)
    v.box(8, 9, 3, 4, 6, 12, '#2b2b33'); v.box(9, 9, 4, 6, 2, 6, '#2b2b33')
    return v


def delivery_bike():                                            # 세워 둔 배달 오토바이
    v = Vox(11, 22, 18)
    v.wheel(4, 6, 3, 2, 2); v.wheel(4, 6, 18, 2, 2)
    v.box(3, 7, 4, 17, 3, 6, '#2f7de1'); v.box(4, 6, 16, 18, 7, 13, '#2f7de1'); v.box(1, 9, 18, 18, 13, 14, '#2b2b33')
    v.box(2, 8, 0, 6, 7, 14, '#ffffff'); v.box(3, 7, 0, 0, 9, 12, '#ff9f1c'); v.box(4, 6, 8, 13, 7, 8, '#2b2b33')
    return v


def cat():
    v = Vox(6, 12, 8)
    v.box(1, 4, 2, 8, 1, 3, '#f2a65a'); v.box(1, 4, 8, 11, 2, 5, '#f2a65a'); v.put(1, 11, 6, '#f2a65a'); v.put(4, 11, 6, '#f2a65a')
    v.put(1, 11, 4, '#1d2a33'); v.put(4, 11, 4, '#1d2a33'); v.box(2, 3, 0, 1, 2, 5, '#d8823a')
    for (x, y) in ((1, 3), (4, 3), (1, 7), (4, 7)): v.put(x, y, 0, '#ffffff')
    for y in range(2, 8, 2): v.box(1, 4, y, y, 3, 3, '#d8823a')
    return v


def pigeon():
    v = Vox(5, 7, 6)
    v.box(1, 3, 1, 4, 1, 3, '#8a96a8'); v.box(1, 3, 4, 6, 3, 5, '#7a8698'); v.put(2, 6, 4, '#3fbf8a'); v.put(2, 6, 5, '#7a8698')
    v.put(1, 6, 5, '#1d2a33'); v.put(3, 6, 5, '#1d2a33'); v.box(1, 3, 0, 1, 2, 2, '#5a6678'); v.put(1, 3, 0, '#e8823a'); v.put(3, 3, 0, '#e8823a')
    return v


def tree_cherry():                                              # 벚나무
    v = Vox(25, 25, 40)
    v.cyl(12, 12, 1.6, 0, 16, '#6b4a3a')
    v.ball(12, 12, 26, 11, '#f7b6c8', rz=10); v.ball(8, 10, 31, 6, '#fbd0dc'); v.ball(16, 15, 22, 6, '#f29ab4')
    return v


def tree_pine():                                                # 소나무
    v = Vox(21, 21, 44)
    v.cyl(10, 10, 1.4, 0, 14, '#7a4a2a')
    for z0, r in ((14, 8), (22, 7), (29, 5.5), (35, 4)):
        for z in range(z0, z0 + 6): v.cyl(10 + (z0 % 3) - 1, 10, r - (z - z0) * 0.5, z, z, '#2f6f3a' if z % 2 else '#3a8045')
    return v


def hedge():                                                    # 생울타리(회양목)
    v = Vox(32, 8, 9)
    for x in range(32):
        hgt = 7 + (x * 7 % 3 == 0)
        v.box(x, x, 1, 6, 0, hgt, '#3f8a3a' if (x // 3) % 2 else '#4f9e45')
    v.box(0, 31, 0, 7, 0, 0, '#8a6a42')
    return v


def banner(text_col='#2f7de1'):                                 # 현수막 '안전한 등굣길'
    v = Vox(48, 4, 26)
    v.box(0, 1, 1, 2, 0, 25, '#9aa3ad'); v.box(46, 47, 1, 2, 0, 25, '#9aa3ad')
    v.box(2, 45, 2, 2, 15, 24, '#ffffff'); v.box(2, 45, 2, 2, 15, 15, text_col); v.box(2, 45, 2, 2, 24, 24, text_col)
    for x in range(5, 43, 5): v.box(x, x + 2, 2, 2, 17, 22, '#e2463b' if x < 20 else text_col)
    return v


def manhole():
    v = Vox(12, 12, 1)
    v.cyl(6, 6, 5.5, 0, 0, '#5b626b')
    for y in range(12):
        for x in range(12):
            if (x - 6) ** 2 + (y - 6) ** 2 <= 20 and (x + y) % 3 == 0: v.put(x, y, 0, '#3a3f47')
    return v


def kid_bike():                                                 # 세워 둔 어린이 자전거
    v = Vox(6, 18, 14)
    v.wheel(2, 3, 3, 3, 3); v.wheel(2, 3, 14, 3, 3)
    v.box(2, 3, 4, 13, 6, 7, '#e2463b'); v.box(2, 3, 13, 13, 7, 12, '#9aa3ad'); v.box(0, 5, 13, 13, 12, 12, '#2b2b33'); v.box(1, 4, 5, 7, 9, 9, '#2b2b33')
    v.box(1, 4, 15, 17, 9, 11, '#ffd23f')
    return v


def speed_bump():                                               # 과속방지턱
    v = Vox(40, 10, 2)
    for x in range(40):
        v.box(x, x, 1, 8, 0, 1, '#ffd23f' if (x // 5) % 2 else '#ffffff')
    return v


def phone_booth():                                              # 비상벨 기둥(안심 비상벨)
    v = Vox(8, 8, 34)
    v.box(2, 5, 2, 5, 0, 26, '#ffd23f'); v.box(1, 6, 1, 6, 27, 33, '#e2463b')
    v.box(3, 4, 6, 6, 18, 21, '#e2463b', glow=True); v.box(3, 4, 6, 6, 10, 15, '#2b3440'); v.box(1, 6, 1, 6, 30, 31, '#ffffff', glow=True)
    return v


for nm, fn in (('shade_canopy', shade_canopy), ('shared_kick', shared_kick), ('bus_info', bus_info), ('bungeoppang', bungeoppang),
               ('parasol_table', parasol_table), ('clothes_bin', clothes_bin), ('ev_charger', ev_charger), ('delivery_bike', delivery_bike),
               ('cat', cat), ('pigeon', pigeon), ('tree_cherry', tree_cherry), ('tree_pine', tree_pine), ('hedge', hedge),
               ('banner', banner), ('manhole', manhole), ('kid_bike', kid_bike), ('speed_bump', speed_bump), ('safety_bell', phone_booth)):
    save(nm, fn(), note='prop')


# ---------------- 담장: 1칸(=38복셀) 짜리 조각을 이어 붙인다 ----------------
def school_fence():                                             # 학교 초록 철망 울타리(아이 키보다 높게)
    v = Vox(38, 4, 30)
    v.box(0, 37, 0, 3, 0, 2, '#b8b0a2')                         # 콘크리트 받침
    for x in (0, 19): v.box(x, x + 2, 0, 3, 0, 29, '#1f6a3a')   # 기둥
    v.box(0, 37, 1, 2, 27, 29, '#f4f6f8'); v.box(0, 37, 1, 2, 14, 14, '#1f6a3a')
    for x in range(1, 38):
        for z in range(3, 27):
            if (x + z) % 3 == 0 or (x - z) % 3 == 0: v.put(x, 1, z, '#2fa84f')
    return v


def apt_fence():                                                # 아파트 담장: 생울타리 + 철제 난간 + 돌기둥
    v = Vox(38, 8, 24)
    v.box(0, 37, 0, 7, 0, 2, '#c8bca8')
    for x in range(38):
        hgt = 10 + (x * 5 % 3 == 0)
        v.box(x, x, 3, 7, 3, hgt, '#3f8a3a' if (x // 3) % 2 else '#4f9e45')
    for x in (0, 18): v.box(x, x + 3, 0, 4, 0, 23, '#d9cdb8'); v.box(x, x + 3, 0, 4, 23, 23, '#8a7a62')
    for x in range(4, 38, 3): v.box(x, x, 1, 1, 3, 21, '#2b3440')
    v.box(0, 37, 1, 1, 21, 22, '#2b3440'); v.box(0, 37, 1, 1, 12, 12, '#2b3440')
    for x in range(5, 38, 6): v.put(x, 1, 22, '#ffd23f')
    return v


save('school_fence', school_fence(), note='prop')
save('apt_fence', apt_fence(), note='prop')


# ---------------- 커피숍 안 ----------------
def cake_case():                                                # 케이크 진열장
    v = Vox(30, 12, 16)
    v.box(0, 29, 0, 11, 0, 7, '#6b4a2a'); v.box(0, 29, 0, 11, 8, 8, '#e8dcc8')
    v.box(0, 29, 11, 11, 9, 15, '#cfe8f5'); v.box(0, 29, 0, 11, 15, 15, '#e8dcc8')
    for i, x in enumerate(range(2, 28, 5)):
        c = ['#fff0f4', '#5a3a22', '#ffd23f', '#f7b6c8', '#ffffff', '#c8623a'][i % 6]
        v.box(x, x + 3, 4, 7, 9, 11, c); v.box(x + 1, x + 2, 5, 6, 12, 12, '#e2463b')
    return v


def cafe_chair_table():                                         # 작은 원탁 + 의자 둘
    v = Vox(26, 14, 14)
    v.cyl(13, 7, 5, 10, 10, '#c8a27a'); v.cyl(13, 7, 1, 0, 9, '#3a3f47')
    for x0 in (1, 21): v.box(x0, x0 + 3, 5, 9, 5, 5, '#6b4a2a'); v.box(x0, x0 + 3, 5, 9, 0, 4, '#3a3f47'); v.box(x0 if x0 < 10 else x0 + 3, x0 if x0 < 10 else x0 + 3, 5, 9, 6, 11, '#6b4a2a')
    v.box(11, 12, 6, 7, 11, 12, '#ffffff'); v.box(15, 16, 7, 8, 11, 13, '#ffffff')
    return v


def hot_cup():                                                  # 테이블 끝의 뜨거운 커피(김)
    v = Vox(10, 10, 16)
    v.box(0, 9, 0, 9, 0, 1, '#c8a27a'); v.box(3, 6, 6, 9, 2, 6, '#ffffff'); v.box(4, 5, 7, 8, 6, 6, '#5a3a22')
    for z, dx in ((8, 0), (10, 1), (12, 0), (14, 1)): v.put(4 + dx, 7, z, '#e8eef2')
    return v


def menu_wall():                                                # 벽 메뉴판
    v = Vox(30, 2, 16)
    v.box(0, 29, 0, 1, 0, 15, '#2b2b33')
    for z in (12, 9, 6, 3):
        v.box(2, 14, 1, 1, z, z, '#f4efe4'); v.box(18, 22, 1, 1, z, z, '#ffd23f')
    return v


for nm, fn in (('cake_case', cake_case), ('cafe_set', cafe_chair_table), ('hot_cup', hot_cup), ('menu_wall', menu_wall)):
    save(nm, fn(), note='prop')


# ---------------- 이벤트 미션 소품 ----------------
def mask_item():                                                # KF94 마스크 상자 + 마스크
    v = Vox(12, 10, 8)
    v.box(0, 11, 0, 9, 0, 4, '#f4f6f8'); v.box(0, 11, 9, 9, 1, 3, '#2f7de1'); v.box(2, 9, 9, 9, 2, 2, '#ffffff')
    v.box(2, 9, 2, 7, 5, 6, '#ffffff'); v.box(1, 1, 3, 6, 5, 5, '#c8ced4'); v.box(10, 10, 3, 6, 5, 5, '#c8ced4'); v.box(3, 8, 4, 5, 7, 7, '#e8eef2')
    return v


def ice_patch():                                                # 빙판 (납작)
    v = Vox(36, 36, 1)
    for y in range(36):
        for x in range(36):
            d = ((x - 18) / 17) ** 2 + ((y - 18) / 15) ** 2
            if d <= 1: v.put(x, y, 0, '#e8f6ff' if (x * 3 + y) % 7 else '#ffffff')
    return v


save('mask_item', mask_item(), note='prop')
save('ice_patch', ice_patch(), note='prop')


# 소방차: 앞서 sprite-stacking 스킬로 4방향을 그려 깎은 띠를 그대로 쓴다
_ft = Image.open(os.path.join(OUT, '..', 'assets', 'firetruck_slices.png'))
_ft.save(os.path.join(OUT, 'firetruck.png'))
MANIFEST['firetruck'] = {'w': _ft.width // 24, 'l': _ft.height, 'n': 24, 'vox': 0.17, 'note': 'vehicle'}


# 슬라이스 띠 계약 확인: 가로 = w * n, 세로 = l
for nm, m in MANIFEST.items():
    im = Image.open(os.path.join(OUT, nm + '.png'))
    assert im.width == m['w'] * m['n'] and im.height == m['l'], nm
    assert im.width <= 4096 and im.height <= 4096, ('태블릿 최대 텍스처 크기 초과', nm, im.size)
json.dump(MANIFEST, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)
print(len(MANIFEST), 'sprites')
