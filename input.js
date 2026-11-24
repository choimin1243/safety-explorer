// 키보드 · 터치 입력. 놓친 키 떼기 이벤트에 견디도록 최소한만 처리한다.
export const keys = new Set(), pressed = new Set();
export const touch = { x: 0, y: 0, crouch: false, act: false };
const OPP = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA', ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };
let log = [];
const note = (s) => { log.push(s); log = log.slice(-8); };

addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;                 // 한글 입력 조합 중
  if (e.target && e.target.tagName === 'INPUT') return;           // 이름 입력칸
  if (/^(Meta|Alt|Control)/.test(e.code)) { keys.clear(); return; }
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) { note('↓' + e.code); if (OPP[e.code]) keys.delete(OPP[e.code]); }
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { note('↑' + e.code); keys.delete(e.code); if (/^(Meta|Alt|Control)/.test(e.code)) keys.clear(); });
for (const ev of ['blur', 'focus', 'pagehide']) addEventListener(ev, () => { note('[' + ev + ']'); keys.clear(); });
document.addEventListener('visibilitychange', () => keys.clear());
export function endFrame() { pressed.clear(); }

// 터치: 화면 왼쪽 60% 를 누른 곳에 떠오르는 조이스틱
const stick = document.getElementById('stick'), knob = stick.firstElementChild;
let sid = null, sx = 0, sy = 0;
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || sid !== null) return;
  if (e.target.closest('button, input, .screen')) return;
  if (e.clientX > innerWidth * 0.6) return;
  sid = e.pointerId; sx = e.clientX; sy = e.clientY;
  stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.style.display = 'block'; knob.style.transform = '';
});
addEventListener('pointermove', (e) => {
  if (e.pointerId !== sid) return;
  let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy), m = 50;
  if (d > m) { dx = dx / d * m; dy = dy / d * m; }
  touch.x = dx / m; touch.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; touch.x = touch.y = 0; stick.style.display = 'none'; };
addEventListener('pointerup', endStick); addEventListener('pointercancel', endStick);
const cb = document.getElementById('btn-crouch');
const setC = (v) => (e) => { e.preventDefault(); touch.crouch = v; cb.classList.toggle('on', v); };
cb.addEventListener('pointerdown', setC(true));
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cb.addEventListener(ev, setC(false));
const ab = document.getElementById('btn-act');
ab.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('Space'); ab.classList.add('on'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) ab.addEventListener(ev, () => ab.classList.remove('on'));
// 두 손가락 오므리기 = 확대/축소
export const pinch = { d: 0, delta: 0 };
const tps = new Map();
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') tps.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointermove', (e) => {
  if (!tps.has(e.pointerId)) return; tps.set(e.pointerId, [e.clientX, e.clientY]);
  if (tps.size === 2) { const [a, b] = [...tps.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch.d) pinch.delta += (pinch.d - d) / 200; pinch.d = d; }
});
const tpEnd = (e) => { tps.delete(e.pointerId); pinch.d = 0; };
addEventListener('pointerup', tpEnd); addEventListener('pointercancel', tpEnd);

// F3: 입력 문제를 알릴 때 쓰는 작은 패널
export function debugPanel(extra = () => '') {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;bottom:60px;z-index:99;font:11px ui-monospace,Menlo,monospace;color:#9fe0c0;background:rgba(0,0,0,.6);padding:6px 8px;white-space:pre;display:none;pointer-events:none';
  document.body.appendChild(d);
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); d.style.display = d.style.display === 'none' ? 'block' : 'none'; } }, true);
  return () => { if (d.style.display !== 'none') d.textContent = `held: ${[...keys].join(' ') || '-'}  touch ${touch.x.toFixed(2)},${touch.y.toFixed(2)} ${touch.crouch ? 'C' : ''}\n${extra()}\nrecent: ${log.join(' ')}`; };
}
