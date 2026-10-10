/*
 * BloopMind - reminders that live as bubbles
 * Copyright (C) 2026 Hasan Berat Kaylan
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://github.com/hasanbkaylan/bloopmind
 */

(() => {
'use strict';

const APP_VERSION = '1.0.0';
const tr = I18n.t, trn = I18n.tn;

const $ = (s, r = document) => r.querySelector(s);
const TAU = Math.PI * 2;
const DAY = 864e5;
const HOLD_MS = 650;
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ================= Color ================= */
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function lum([r, g, b]) {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
// Picks a random colour as far as possible from the existing ones; the chosen colour is stored with the bubble.
function pickColor(existing) {
  let best = null, bestScore = -1;
  for (let k = 0; k < 40; k++) {
    const h = rnd() * 360, s = 62 + rnd() * 18, l = 49 + rnd() * 11;
    let dmin = 400;
    for (const c of existing) {
      let dh = Math.abs(c[0] - h); dh = Math.min(dh, 360 - dh);
      dmin = Math.min(dmin, dh + 0.7 * Math.abs(c[2] - l) + 0.3 * Math.abs(c[1] - s));
    }
    const score = (existing.length ? dmin : 200) + rnd() * 5;
    if (score > bestScore) { bestScore = score; best = [Math.round(h), Math.round(s), Math.round(l)]; }
  }
  return best;
}
function palette(it) {
  if (it._p) return it._p;
  const [h, s, l] = it.c;
  const L = lum(hslToRgb(h, s, l));
  const whiteContrast = 1.05 / (L + 0.05);
  it._p = {
    base: `hsl(${h},${s}%,${l}%)`,
    hi: `hsl(${h},${s}%,${Math.min(l + 18, 86)}%)`,
    lo: `hsl(${h},${Math.min(s + 8, 96)}%,${Math.max(l - 16, 18)}%)`,
    tone: whiteContrast >= 2.6 ? 'w' : 'k',
    css: `hsl(${h} ${s}% ${l}%)`
  };
  return it._p;
}

/* ================= Dates ================= */
function fmtDate(ms) {
  return new Intl.DateTimeFormat(I18n.lang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
}
function relAge(ms) {
  const d = (Date.now() - ms) / DAY;
  if (d < 1 / 24) return tr('time.justNow');
  const rtf = new Intl.RelativeTimeFormat(I18n.lang(), { numeric: 'auto' });
  if (d < 1) return rtf.format(-Math.floor(d * 24), 'hour');
  const n = Math.floor(d);
  if (n < 14) return rtf.format(-n, 'day');
  if (n < 60) return rtf.format(-Math.floor(n / 7), 'week');
  return rtf.format(-Math.floor(n / 30), 'month');
}
function dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function dueDiff(iso) {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00').getTime();
  if (isNaN(t)) return null;
  return Math.round((t - dayStart(Date.now())) / DAY);
}
function dueText(iso) {
  const d = dueDiff(iso);
  if (d === null) return '';
  if (d === 0) return tr('due.today');
  if (d === 1) return tr('due.tomorrow');
  if (d > 1) return tr('due.left', { n: d });
  if (d === -1) return tr('due.yesterday');
  return tr('due.overdue', { n: Math.abs(d) });
}

/* ================= Data ================= */
const LS_KEY = 'bloopmind.v1';
const EXAMPLES = [['receipt', 38], ['book', 27], ['phone', 21], ['pulse', 14], ['drop', 9], ['leaf', 5], ['dumbbell', 3], ['cart', 1], ['gift', 0.2]];
let S = null;

// Example reminders keep an index (`ek`) instead of text, so they follow the interface language.
// Editing one turns it into a regular reminder (ek is cleared).
function ttl(it) { return it.ek != null ? tr('ex.' + it.ek + '.t') : it.t; }
function nte(it) {
  if (it.ek == null) return it.n;
  return I18n.has('ex.' + it.ek + '.n') ? tr('ex.' + it.ek + '.n') : tr('ex.note');
}

function normalize(o) {
  if (!o || !Array.isArray(o.items)) return null;
  const boxes = Array.isArray(o.boxes) && o.boxes.length ? o.boxes.filter(b => b && b.id).map(b => ({ id: String(b.id) })) : [{ id: 'b1' }];
  if (!boxes.length) boxes.push({ id: 'b1' });
  const ids = new Set(boxes.map(b => b.id));
  const items = [];
  for (const i of o.items) {
    if (!i || !i.id || !Array.isArray(i.c) || i.c.length < 3) continue;
    items.push({
      id: String(i.id), t: String(i.t || '').slice(0, 60), n: String(i.n || '').slice(0, 400),
      i: ICON_MAP[i.i] ? i.i : 'bell', c: [+i.c[0] || 0, +i.c[1] || 70, +i.c[2] || 55],
      at: +i.at || Date.now(), d: typeof i.d === 'string' ? i.d : '', b: ids.has(i.b) ? i.b : boxes[0].id, ex: !!i.ex,
      ek: Number.isInteger(i.ek) && i.ek >= 0 && i.ek < EXAMPLES.length ? i.ek : null
    });
  }
  return { v: 1, boxes, items, sound: o.sound !== false, updated: +o.updated || 0 };
}
function loadLocal() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? normalize(JSON.parse(raw)) : null; } catch (e) { return null; }
}
function seed() {
  const now = Date.now();
  const items = [];
  EXAMPLES.forEach(([icon, days], k) => {
    items.push({ id: 'ex' + k, t: '', n: '', ek: k, i: icon, c: pickColor(items.map(x => x.c)), at: now - days * DAY, d: '', b: 'b1', ex: true });
  });
  return { v: 1, boxes: [{ id: 'b1' }], items, sound: true, updated: 0 };
}

let saveT = 0;
function touch() { S.updated = Date.now(); clearTimeout(saveT); saveT = setTimeout(flush, 350); }
function flush() {
  clearTimeout(saveT);
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* storage may be unavailable (private mode, quota) */ }
}

/* ================= Stage ================= */
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d');
const G = { x: 0, y: 0, w: 300, h: 400, L: 0, R: 300, B: 400, T: 0, rMin: 20, rMax: 48, cap: 1, fit: 1, dpr: 1, sw: 300, sh: 400 };
let TH = { fill: 'rgba(255,255,255,.7)', line: '#aab', shadow: 'rgba(0,0,0,.2)', ink: '#123' };
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  TH = { fill: g('--box-fill') || TH.fill, line: g('--box-line') || TH.line, shadow: g('--box-shadow') || TH.shadow, ink: g('--ink') || TH.ink, danger: g('--danger') || '#c42a3c' };
}

const worlds = new Map();   // box id -> physics world
const bodies = new Map();   // reminder id -> body
let active = null;          // { id, w }
let fx = [];
let soft = 0;

function applyGeom(w) {
  w.L = G.L; w.R = G.R; w.B = G.B; w.ceil = G.T + 3; w.g = 3.4 * (G.B - G.T);
}
function worldOf(id) {
  let w = worlds.get(id);
  if (!w) { w = Phys.createWorld(); applyGeom(w); w.init = false; w.q = []; worlds.set(id, w); }
  return w;
}
const itemsOf = id => S.items.filter(i => i.b === id);
const baseR = (it, now) => {
  const days = Math.max(0, (now - it.at) / DAY);
  const f = 1 - Math.exp(-days / 9);
  return G.rMin + (G.rMax - G.rMin) * f;
};
function usedArea(id, now) {
  let u = 0;
  for (const it of S.items) if (it.b === id) { const r = baseR(it, now); u += Math.PI * r * r; }
  return u;
}
const fillOf = (id, now) => usedArea(id, now) / G.cap;
const hasRoom = (id, now) => usedArea(id, now) + Math.PI * G.rMin * G.rMin <= G.cap;

function layout() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(260, Math.floor(r.width)), h = Math.max(300, Math.floor(r.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const old = { L: G.L, R: G.R, B: G.B, T: G.T, k: G.S };
  G.dpr = dpr; G.sw = w; G.sh = h;
  const mx = Math.max(16, Math.min(56, w * 0.04));
  const bw = Math.min(w - 2 * mx, 1040);
  const top = clamp(h * 0.11, 46, 88), hintH = 28;
  G.x = (w - bw) / 2; G.y = top; G.w = bw; G.h = Math.max(200, h - top - hintH);
  const wall = 3;
  G.L = G.x + wall; G.R = G.x + G.w - wall; G.B = G.y + G.h - wall; G.T = G.y;
  const Sz = Math.sqrt((G.R - G.L) * (G.B - G.T));
  G.S = Sz;
  G.rMin = Math.max(18, 0.052 * Sz);
  G.rMax = Math.max(G.rMin + 14, 0.125 * Sz);
  G.cap = 0.58 * (G.R - G.L) * (G.B - G.T);
  if (old.R > old.L && S) {
    const sx = (G.R - G.L) / (old.R - old.L), sy = (G.B - G.T) / (old.B - old.T), k = Math.sqrt(sx * sy);
    worlds.forEach(wd => {
      for (const b of wd.bodies) {
        b.x = G.L + (b.x - old.L) * sx; b.y = G.B - (old.B - b.y) * sy; b.r *= k;
      }
    });
    soft = performance.now() + 1500;
  }
  worlds.forEach(applyGeom);
}

/* ---------- Creating bodies ---------- */
function makeBody(w, it, o = {}) {
  const now = Date.now();
  const r = baseR(it, now) * G.fit;
  const x = o.x != null ? o.x : G.L + r + rnd() * Math.max(1, G.R - G.L - 2 * r);
  const y = o.y != null ? o.y : G.T - r - 24 - rnd() * 10;
  const b = Phys.addBody(w, { id: it.id, x, y, r, vx: (rnd() - 0.5) * 60, vy: o.vy != null ? o.vy : 280, entered: !!o.entered });
  b.item = it; b.app = o.instant ? 1 : 0; b.rt = r; b.holdP = 0;
  bodies.set(it.id, b);
  return b;
}
function enqueue(it, delay) {
  const w = worldOf(it.b);
  w.q.push({ it, at: performance.now() + delay });
}
function startWorld(id) {
  const w = worldOf(id);
  if (w.init) return;
  w.init = true;
  const list = itemsOf(id).slice().sort((a, b) => a.at - b.at);
  if (RM) {
    const now = Date.now();
    list.forEach((it, i) => {
      const r = baseR(it, now) * G.fit;
      makeBody(w, it, { x: G.L + r + rnd() * Math.max(1, G.R - G.L - 2 * r), y: G.B - r - i * 4, vy: 0, entered: true, instant: true });
    });
    Phys.settle(w, 3);
  } else {
    list.forEach((it, i) => enqueue(it, 120 + Math.min(i * 85, 2200)));
  }
}
function setActive(id) {
  if (active && active.id === id) return;
  press = null; Snd.holdStop();
  active = { id, w: worldOf(id) };
  startWorld(id);
  updateUI();
}
function activeBox() { return active ? active.id : S.boxes[0].id; }

/* ---------- Data operations ---------- */
function removeItemData(id) { S.items = S.items.filter(i => i.id !== id); touch(); }
function findRoomBox(now) {
  if (hasRoom(activeBox(), now)) return activeBox();
  for (const b of S.boxes) if (hasRoom(b.id, now)) return b.id;
  return null;
}
function newBox() {
  let n = S.boxes.length + 1, id = 'b' + n;
  while (S.boxes.some(b => b.id === id)) { n++; id = 'b' + n; }
  S.boxes.push({ id });
  touch();
  return id;
}

/* ---------- Effects ---------- */
function popFx(b) {
  const it = b.item, p = palette(it), [h, s, l] = it.c;
  const x = b.x, y = b.y, r = b.r;
  const cHi = p.hi, cBase = p.base, cLo = p.lo;
  fx.push({ k: 'flash', x, y, r, t: 0, life: 0.24, c: cHi });
  fx.push({ k: 'ring', x, y, r0: r * 0.92, r1: r * 2.5, w0: Math.max(3, r * 0.14), t: 0, life: 0.5, c: cBase });
  const n = RM ? 6 : 24;
  if (!RM) {
    fx.push({ k: 'ring', x, y, r0: r * 0.7, r1: r * 3.5, w0: 2.4, t: -0.05, life: 0.75, c: 'rgba(255,255,255,0.8)' });
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * TAU + (rnd() - 0.5) * 0.3;
      fx.push({ k: 'shard', cx: x, cy: y, R: r, a, len: 0.32 + rnd() * 0.45, sp: 90 + rnd() * 260, va: (rnd() - 0.5) * 5, w: 2 + rnd() * 3, t: 0, life: 0.5 + rnd() * 0.35, c: cHi });
    }
    for (let i = 0; i < 12; i++) {
      const a = rnd() * TAU;
      fx.push({ k: 'spark', x, y, a, d0: r * (0.9 + rnd() * 0.3), l: 8 + rnd() * 14, sp: 260 + rnd() * 380, t: 0, life: 0.28 + rnd() * 0.2, c: 'rgba(255,255,255,0.95)' });
    }
  }
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = (120 + rnd() * 460) * (0.65 + r / 90);
    const cc = rnd() < 0.45 ? cBase : (rnd() < 0.5 ? cHi : cLo);
    fx.push({ k: 'drop', x: x + Math.cos(a) * r * 0.8, y: y + Math.sin(a) * r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, rr: 1.8 + rnd() * (2.2 + r * 0.06), t: 0, life: 0.7 + rnd() * 0.7, c: cc });
  }
}
function shock(b) {
  const w = active.w, reach = b.r * 3.3;
  for (const o of w.bodies) {
    if (o === b || o.drag) continue;
    const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
    if (d < reach) {
      const k = (1 - d / reach) * 420 * (G.rMin / Math.max(o.r, 1)) * 1.3;
      o.vx += dx / d * k; o.vy += dy / d * k - k * 0.25;
    }
  }
}
function updateFx(dt) {
  const floor = G.B;
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.t >= f.life) { fx.splice(i, 1); continue; }
    if (f.k === 'drop' && f.t > 0) {
      f.vy += 1500 * dt; f.vx *= 0.995; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y > floor - f.rr) { f.y = floor - f.rr; f.vy *= -0.3; f.vx *= 0.6; }
      if (f.x < G.L) { f.x = G.L; f.vx = Math.abs(f.vx) * 0.4; }
      if (f.x > G.R) { f.x = G.R; f.vx = -Math.abs(f.vx) * 0.4; }
    }
  }
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
function drawFx() {
  for (const f of fx) {
    if (f.t < 0) continue;
    const k = f.t / f.life;
    if (f.k === 'flash') {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.2 + k * 0.7));
      g.addColorStop(0, 'rgba(255,255,255,' + (0.85 * (1 - k)) + ')');
      g.addColorStop(0.5, f.c.replace('hsl(', 'hsla(').replace(')', ',' + (0.35 * (1 - k)) + ')'));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2, 0, TAU); ctx.fill();
    } else if (f.k === 'ring') {
      const e = easeOut(k);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.c; ctx.lineWidth = Math.max(0.6, f.w0 * (1 - k * 0.85));
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * e, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'shard') {
      const d = f.sp * f.life * easeOut(k) * 0.9, rot = f.va * f.t;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.4); ctx.strokeStyle = f.c; ctx.lineWidth = f.w * (1 - k * 0.6); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(f.cx + Math.cos(f.a) * d, f.cy + Math.sin(f.a) * d, f.R, f.a - f.len / 2 + rot, f.a + f.len / 2 + rot);
      ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'spark') {
      const d = f.d0 + f.sp * easeOut(k) * f.life, l = f.l * (1 - k);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x + Math.cos(f.a) * d, f.y + Math.sin(f.a) * d); ctx.lineTo(f.x + Math.cos(f.a) * (d + l), f.y + Math.sin(f.a) * (d + l)); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'drop') {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = f.c;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.rr * (1 - k * 0.5), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}

/* ---------- Popping ---------- */
let undo = null, toastT = 0;
function popBody(b, o = {}) {
  if (!bodies.has(b.id)) return;
  const it = b.item;
  popFx(b); Snd.pop(b.r); shock(b);
  Phys.removeBody(active.w, b); bodies.delete(b.id);
  removeItemData(it.id);
  if (!o.quiet) {
    undo = it;
    showToast(tr('toast.popped', { t: ttl(it) || tr('sheet.edit') }), tr('toast.undo'), () => {
      if (!undo) return;
      const back = undo; undo = null;
      if (!S.boxes.some(x => x.id === back.b)) back.b = S.boxes[0].id;
      S.items.push(back); touch(); setActive(back.b); enqueue(back, 80); Snd.undo(); hideToast(); updateUI();
    }, 6000);
  }
  updateUI();
}
function showToast(text, actionLabel, action, ms = 3500) {
  const t = $('#toast');
  t.textContent = '';
  const sp = document.createElement('span'); sp.textContent = text; t.appendChild(sp);
  if (actionLabel) { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = actionLabel; bt.addEventListener('click', action); t.appendChild(bt); }
  t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(hideToast, ms);
}
function hideToast() { $('#toast').hidden = true; clearTimeout(toastT); }

/* ---------- Pointer: tap / hold / drag ---------- */
let press = null;
const pt = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function pickBody(x, y) {
  if (!active) return null;
  const list = active.w.bodies;
  let best = null, bd = 1e9;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    const d = Math.hypot(b.x - x, b.y - y);
    if (d <= b.r + 4 && d - b.r < bd) { best = b; bd = d - b.r; }
  }
  return best;
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  Snd.unlock();
  if (modalOpen() || press) return;
  const p = pt(e), b = pickBody(p.x, p.y);
  if (!b) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const t = performance.now();
  press = { id: e.pointerId, b, sx: p.x, sy: p.y, ox: b.x - p.x, oy: b.y - p.y, t0: t, mode: 'hold', hist: [{ x: b.x, y: b.y, t }], tx: b.x, ty: b.y };
  b.drag = true; b.vx = 0; b.vy = 0; b.holdP = 0;
});
cv.addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  const p = pt(e);
  if (press.mode === 'hold' && Math.hypot(p.x - press.sx, p.y - press.sy) > 11) {
    press.mode = 'drag'; press.b.holdP = 0; Snd.holdStop();
  }
  if (press.mode === 'drag') { press.tx = p.x + press.ox; press.ty = p.y + press.oy; }
});
function endPress(e, cancel) {
  if (!press || (e && e.pointerId !== press.id)) return;
  const { b, mode, hist } = press;
  press = null; Snd.holdStop();
  if (!bodies.has(b.id)) return;
  b.holdP = 0; b.drag = false;
  if (mode === 'hold') {
    b.vx = 0; b.vy = 0;
    if (!cancel) openSheet('edit', b.item);
  } else if (!cancel) {
    const t = performance.now();
    let h0 = hist[0];
    for (const h of hist) if (t - h.t <= 110) { h0 = h; break; }
    const dt = (t - h0.t) / 1000;
    if (dt > 0.016) {
      let vx = (b.x - h0.x) / dt, vy = (b.y - h0.y) / dt;
      const sp = Math.hypot(vx, vy), mx = 1500;
      if (sp > mx) { vx *= mx / sp; vy *= mx / sp; }
      b.vx = vx; b.vy = vy;
      if (sp > 500) Snd.toss();
    }
  }
}
cv.addEventListener('pointerup', e => endPress(e, false));
cv.addEventListener('pointercancel', e => endPress(e, true));
cv.addEventListener('lostpointercapture', e => endPress(e, true));
document.addEventListener('visibilitychange', () => { if (document.hidden) { endPress(null, true); flush(); } });

/* ---------- Update and draw ---------- */
let last = 0, frameNo = 0;
function update(dt, ts) {
  if (!active) return;
  const w = active.w, now = Date.now();
  // bubbles waiting in the queue
  for (let i = w.q.length - 1; i >= 0; i--) {
    const q = w.q[i];
    if (ts >= q.at) {
      w.q.splice(i, 1);
      if (S.items.includes(q.it) && !bodies.has(q.it.id)) {
        makeBody(w, q.it);
        if (!q.silent) Snd.add();
      }
    }
  }
  // fit factor (shrinks bubbles when the box is over capacity)
  const used = usedArea(active.id, now);
  G.fit = used > G.cap ? Math.sqrt(G.cap / used) : 1;
  const lerp = 1 - Math.exp(-5 * dt);
  for (const b of w.bodies) {
    b.rt = baseR(b.item, now) * G.fit;
    b.r += (b.rt - b.r) * lerp;
    if (b.app < 1) b.app = Math.min(1, b.app + dt / 0.35);
    // jelly spring
    b.sqv += (-320 * b.sq - 15 * b.sqv) * dt; b.sq += b.sqv * dt;
    b.sq = clamp(b.sq, -0.3, 0.3);
  }
  w.vmax = ts < soft ? 520 : 2600;
  // press-and-hold / dragging
  if (press) {
    const b = press.b;
    if (!bodies.has(b.id)) { press = null; Snd.holdStop(); }
    else if (press.mode === 'hold') {
      const p = (ts - press.t0) / HOLD_MS;
      b.holdP = Math.min(1, p); b.vx = 0; b.vy = 0;
      if (p > 0.2) { if (!press.snd) { press.snd = true; Snd.holdStart(); } Snd.holdUpdate((p - 0.2) / 0.8); }
      if (p >= 1) { press = null; Snd.holdStop(); popBody(b); }
    } else {
      const tx = clamp(press.tx, G.L + b.r, G.R - b.r), ty = clamp(press.ty, w.ceil + b.r, G.B - b.r);
      b.vx = clamp((tx - b.x) * 22, -3200, 3200); b.vy = clamp((ty - b.y) * 22, -3200, 3200);
      press.hist.push({ x: b.x, y: b.y, t: ts });
      while (press.hist.length > 2 && ts - press.hist[0].t > 160) press.hist.shift();
    }
  }
  Phys.step(w, dt);
  // collision sounds and jelly squash
  if (w.events.length) {
    let top = null, n = 0;
    for (const e of w.events) {
      const kick = Math.min(e.s * 0.0011, 0.9);
      e.a.sqv += kick * 14 * (e.b ? 0.8 : 1); e.a.sqa = Math.atan2(e.ny, e.nx);
      if (e.b) { e.b.sqv += kick * 14 * 0.8; e.b.sqa = Math.atan2(-e.ny, -e.nx); }
      if (!top || e.s > top.s) top = e;
      if (++n >= 40) break;
    }
    if (top) {
      const sn = top.s / w.g;
      const r = top.b ? (top.a.r + top.b.r) / 2 : top.a.r;
      if (top.b) Snd.hit(sn, r); else Snd.wall(sn, r);
    }
    w.events.length = 0;
  }
  updateFx(dt);
  if ((++frameNo % 20) === 0) updateMeta();
}

function drawBox() {
  const { x, y, w, h } = G, rad = Math.min(18, w / 6);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y + h - rad); ctx.quadraticCurveTo(x, y + h, x + rad, y + h);
  ctx.lineTo(x + w - rad, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - rad); ctx.lineTo(x + w, y);
  ctx.shadowColor = TH.shadow; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  ctx.fillStyle = TH.fill; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = TH.line; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
  ctx.fillStyle = TH.line;
  ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.arc(x + w, y, 3.2, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawBoxGloss() {
  const { x, y, w, h } = G;
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + Math.min(70, w * 0.16), 0);
  g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x + 4, y + 10, Math.min(70, w * 0.16), h - 26);
  ctx.restore();
}
function ellipsize(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
  return text.slice(0, Math.max(1, lo)).trimEnd() + '…';
}
function drawBubble(b, ts) {
  const it = b.item, p = palette(it);
  const hp = b.holdP || 0;
  const ap = b.app < 1 ? (1 + 2.2 * Math.pow(b.app - 1, 3) + 1.2 * Math.pow(b.app - 1, 2)) * 1 : 1; // overshoot on entry
  const grow = 1 + 0.22 * easeOut(hp) + Math.sin(ts * 0.045) * 0.012 * hp;
  const sc = Math.max(0.01, ap) * grow;
  const r = b.r;
  ctx.save();
  ctx.translate(b.x + (hp ? Math.sin(ts * 0.09) * 2.2 * hp : 0), b.y);
  if (hp) ctx.rotate(Math.sin(ts * 0.07) * 0.07 * hp);
  // jelly squash
  if (Math.abs(b.sq) > 0.002) { ctx.rotate(b.sqa); ctx.scale(1 - b.sq, 1 + b.sq * 0.6); ctx.rotate(-b.sqa); }
  ctx.scale(sc, sc);
  // body
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = Math.max(6, r * 0.28); ctx.shadowOffsetY = Math.max(2, r * 0.08);
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r * 1.04);
  g.addColorStop(0, p.hi); g.addColorStop(0.55, p.base); g.addColorStop(1, p.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // lower reflection
  const g2 = ctx.createRadialGradient(r * 0.25, r * 0.55, 0, r * 0.25, r * 0.55, r * 0.8);
  g2.addColorStop(0, 'rgba(255,255,255,0.22)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // rim
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = Math.max(1.4, r * 0.035);
  ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
  // highlight
  ctx.save(); ctx.rotate(-0.62); ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.3, r * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore();
  // icon and title
  const title = ttl(it);
  const showText = r >= 34 && title;
  const isz = showText ? r * 0.72 : r * 1.0;
  const img = iconImg(it.i, p.tone);
  if (img) {
    if (p.tone === 'w') { ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; }
    ctx.drawImage(img, -isz / 2, (showText ? -r * 0.5 : -isz / 2), isz, isz);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  if (showText) {
    const fs = clamp(r * 0.235, 10, 15);
    ctx.font = `700 ${fs}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const key = title + '|' + Math.round(fs * 2);
    if (it._lk !== key) { it._lk = key; it._lt = ellipsize(title, r * 1.5); }
    ctx.fillStyle = p.tone === 'w' ? '#ffffff' : '#12172a';
    if (p.tone === 'w') { ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 3; }
    ctx.fillText(it._lt, 0, r * 0.52);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  }
  // due / overdue badge
  const dd = dueDiff(it.d);
  if (dd !== null && dd <= 0) {
    const bx = r * 0.68, by = -r * 0.68, br = Math.max(8, r * 0.19);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.fillStyle = TH.danger; ctx.font = `800 ${br * 1.4}px Figtree, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', bx, by + br * 0.06);
  }
  ctx.restore();
  // press-and-hold ring
  if (hp > 0) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.lineCap = 'round';
    const rr = r * grow + 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = p.tone === 'w' ? '#ffffff' : p.lo; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + TAU * hp); ctx.stroke();
    ctx.restore();
  }
}
function draw(ts) {
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.clearRect(0, 0, G.sw, G.sh);
  drawBox();
  if (active) for (const b of active.w.bodies) drawBubble(b, ts);
  drawBoxGloss();
  drawFx();
}
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  update(dt, ts);
  draw(ts);
  requestAnimationFrame(frame);
}

/* ================= Interface ================= */
function updateMeta() {
  if (!active) return;
  const now = Date.now(), id = active.id;
  const n = itemsOf(id).length;
  const f = fillOf(id, now), full = !hasRoom(id, now);
  const pct = Math.min(100, Math.round(f * 100));
  $('#count').textContent = (S.boxes.length > 1 ? tr('box.n', { n: S.boxes.findIndex(b => b.id === id) + 1 }) + ' \u00b7 ' : '') + trn('count', n);
  const mt = $('#meter'); mt.classList.toggle('full', full); mt.firstElementChild.style.width = pct + '%';
  const pc = $('#pct'); pc.classList.toggle('full', full); pc.textContent = full ? tr('meter.full') : tr('meter.pct', { n: pct });
  $('#clearEx').hidden = !S.items.some(i => i.ex);
  $('#empty').hidden = n > 0;
}
function renderBoxbar() {
  const bar = $('#boxbar'), now = Date.now();
  const lastFull = !hasRoom(S.boxes[S.boxes.length - 1].id, now);
  const show = S.boxes.length > 1 || lastFull;
  bar.hidden = !show;
  bar.textContent = '';
  if (!show) return;
  S.boxes.forEach((bx, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(active && active.id === bx.id));
    b.append(tr('box.n', { n: i + 1 }) + ' ');
    const cnt = document.createElement('span'); cnt.className = 'n'; cnt.textContent = String(itemsOf(bx.id).length);
    b.appendChild(cnt);
    b.addEventListener('click', () => { if (!active || active.id !== bx.id) { Snd.tap(); setActive(bx.id); } });
    bar.appendChild(b);
  });
  if (lastFull && S.boxes.length < 8) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab new'; b.textContent = tr('tab.new');
    b.addEventListener('click', () => { const id = newBox(); Snd.newbox(); setActive(id); showToast(tr('toast.boxOpened', { n: S.boxes.length })); });
    bar.appendChild(b);
  }
}
function renderSr() {
  const ul = $('#srList'); ul.textContent = '';
  S.items.forEach(it => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = ttl(it) + (it.d ? ', ' + dueText(it.d) : '');
    b.addEventListener('click', () => { if (!active || active.id !== it.b) setActive(it.b); openSheet('edit', it); });
    li.appendChild(b); ul.appendChild(li);
  });
}
function updateUI() { updateMeta(); renderBoxbar(); renderSr(); }

$('#clearEx').addEventListener('click', () => {
  const ex = S.items.filter(i => i.ex);
  if (!ex.length) return;
  let k = 0;
  ex.forEach(it => {
    const b = bodies.get(it.id);
    if (b && active && active.w.bodies.includes(b)) { setTimeout(() => { if (bodies.has(it.id)) popBody(b, { quiet: true }); }, k * 110); k++; }
    else removeItemData(it.id);
  });
  undo = null;
  showToast(tr('clearEx.done'));
  setTimeout(updateUI, k * 110 + 50);
});

/* ---------- Detail / edit sheet ---------- */
const scrim = $('#scrim'), form = $('#sheet');
const sh = { mode: 'new', item: null, icon: 'bell', color: null, noRoom: false, focus: null };
function sheetOpen() { return !scrim.hidden; }

function buildIconGrid() {
  const box = $('#icons');
  ICONS.forEach(([k]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ic'; b.dataset.k = k; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.innerHTML = iconSvg(k);
    b.addEventListener('click', () => { sh.icon = k; Snd.tap(); renderSheetIcon(); });
    box.appendChild(b);
  });
  renderIconLabels();
}
function renderIconLabels() {
  $('#icons').querySelectorAll('.ic').forEach(b => {
    const label = tr('icon.' + b.dataset.k);
    b.setAttribute('aria-label', label); b.title = label;
  });
}
function renderSheetIcon() {
  const p = paletteFor(sh.color);
  const badge = $('#shBadge');
  badge.style.background = p.css; badge.style.color = p.tone === 'w' ? '#fff' : '#12172a';
  badge.innerHTML = iconSvg(sh.icon);
  const grid = $('#icons');
  grid.style.setProperty('--sel', p.css); grid.style.setProperty('--sel-fg', p.tone === 'w' ? '#fff' : '#12172a');
  grid.querySelectorAll('.ic').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === sh.icon)));
}
function paletteFor(c) { return palette({ c }); }
function renderDue() {
  const v = $('#fDate').value, info = $('#dueInfo');
  const t = dueText(v);
  info.hidden = !t;
  info.textContent = t;
  info.style.color = (dueDiff(v) !== null && dueDiff(v) <= 0) ? 'var(--danger)' : '';
}
function openSheet(mode, item) {
  sh.mode = mode; sh.item = item || null; sh.focus = document.activeElement;
  if (mode === 'edit') {
    Snd.tap();
    sh.icon = item.i; sh.color = item.c;
    $('#fTitle').value = ttl(item); $('#fNote').value = nte(item); $('#fDate').value = item.d || '';
    $('#shTitle').textContent = tr('sheet.edit');
    $('#shSave').textContent = tr('save'); $('#shCancel').textContent = tr('close');
    $('#shPop').hidden = false; $('#fullNote').hidden = true; sh.noRoom = false;
    const ai = $('#ageInfo'); ai.hidden = false;
    ai.innerHTML = '';
    const l1 = document.createElement('span'); l1.textContent = tr('age.added', { d: fmtDate(item.at), rel: relAge(item.at) });
    const l2 = document.createElement('span'); l2.textContent = tr('age.grows');
    ai.append(l1, l2);
  } else {
    Snd.tap();
    sh.icon = 'bell'; sh.color = pickColor(S.items.map(i => i.c));
    $('#fTitle').value = ''; $('#fNote').value = ''; $('#fDate').value = '';
    $('#shTitle').textContent = tr('sheet.new');
    $('#shCancel').textContent = tr('cancel');
    $('#shPop').hidden = true; $('#ageInfo').hidden = true;
    sh.noRoom = findRoomBox(Date.now()) === null;
    $('#fullNote').hidden = !sh.noRoom;
    $('#shSave').textContent = sh.noRoom ? tr('addInNewBox') : tr('add');
  }
  $('#fErr').textContent = '';
  renderSheetIcon(); renderDue();
  scrim.hidden = false;
  setTimeout(() => { try { $('#fTitle').focus({ preventScroll: true }); } catch (_) { /* ignore */ } }, 60);
}
function closeSheet() {
  scrim.hidden = true;
  const f = sh.focus; sh.focus = null;
  if (f && f.focus && document.contains(f)) { try { f.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
}
$('#fDate').addEventListener('input', renderDue);
$('#shClose').addEventListener('click', closeSheet);
$('#shCancel').addEventListener('click', closeSheet);
scrim.addEventListener('pointerdown', e => { if (e.target === scrim) closeSheet(); });
$('#addBtn').addEventListener('click', () => { Snd.unlock(); openSheet('new'); });

form.addEventListener('submit', e => {
  e.preventDefault();
  const title = $('#fTitle').value.trim();
  if (!title) {
    $('#fErr').textContent = tr('err.title'); Snd.err(); $('#fTitle').focus(); return;
  }
  const note = $('#fNote').value.trim(), due = $('#fDate').value || '';
  if (sh.mode === 'edit') {
    const it = sh.item;
    it.t = title; it.n = note; it.i = sh.icon; it.d = due; it.ek = null; it._lk = null;
    touch(); Snd.save(); closeSheet(); updateUI();
    return;
  }
  const now = Date.now();
  let target = findRoomBox(now), opened = false;
  if (target === null) {
    if (S.boxes.length >= 8) { $('#fErr').textContent = tr('err.allFull'); Snd.err(); return; }
    target = newBox(); opened = true;
  }
  const it = { id: uid(), t: title, n: note, i: sh.icon, c: sh.color, at: now, d: due, b: target, ex: false, ek: null };
  S.items.push(it); touch();
  closeSheet();
  if (!active || active.id !== target) setActive(target);
  enqueue(it, 150);
  if (opened) { Snd.newbox(); showToast(tr('toast.boxOpened', { n: S.boxes.length })); }
  updateUI();
  // tell the user if this addition filled the box
  setTimeout(() => {
    if (!opened && !hasRoom(target, Date.now()) && S.boxes[S.boxes.length - 1].id === target) { Snd.full(); showToast(tr('toast.boxFull')); }
  }, 900);
});
$('#shPop').addEventListener('click', () => {
  const it = sh.item; if (!it) return;
  closeSheet();
  if (active && active.id !== it.b) setActive(it.b);
  setTimeout(() => {
    const b = bodies.get(it.id);
    if (b && active.w.bodies.includes(b)) popBody(b);
    else { removeItemData(it.id); updateUI(); }
  }, 160);
});

/* ---------- Settings ---------- */
const setScrim = $('#setScrim'), sndRow = $('#sndRow'), sndSwitch = $('#sndSwitch'), langSeg = $('#langSeg');
let setFocus = null;
function settingsOpen() { return !setScrim.hidden; }
function modalOpen() { return sheetOpen() || settingsOpen(); }

function renderSound() { sndSwitch.setAttribute('aria-checked', String(Snd.isOn())); }
sndRow.addEventListener('click', () => {
  Snd.setOn(!Snd.isOn()); S.sound = Snd.isOn(); renderSound(); flush();
  if (Snd.isOn()) Snd.tap();
});

function buildLangSeg() {
  I18n.LANGS.forEach(l => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.lang = l.code; b.lang = l.code; b.setAttribute('role', 'radio'); b.textContent = l.name;
    b.addEventListener('click', () => { if (I18n.lang() !== l.code) { I18n.set(l.code); Snd.tap(); } });
    langSeg.appendChild(b);
  });
  renderLangSeg();
}
function renderLangSeg() {
  langSeg.querySelectorAll('button').forEach(b => {
    const on = b.dataset.lang === I18n.lang();
    b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
  });
}
langSeg.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const codes = I18n.LANGS.map(l => l.code), i = codes.indexOf(I18n.lang());
  const step = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
  const next = codes[(i + step + codes.length) % codes.length];
  I18n.set(next);
  const btn = langSeg.querySelector('[data-lang="' + next + '"]'); if (btn) btn.focus();
});

function openSettings() {
  if (settingsOpen()) return;
  Snd.unlock(); Snd.tap();
  endPress(null, true);
  setFocus = document.activeElement;
  renderSound();
  setScrim.hidden = false;
  setTimeout(() => { try { $('#setClose').focus({ preventScroll: true }); } catch (_) { /* ignore */ } }, 60);
}
function closeSettings() {
  setScrim.hidden = true;
  const f = setFocus; setFocus = null;
  if (f && f.focus && document.contains(f)) { try { f.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
}
$('#setBtn').addEventListener('click', openSettings);
$('#setClose').addEventListener('click', closeSettings);
setScrim.addEventListener('pointerdown', e => { if (e.target === setScrim) closeSettings(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (settingsOpen()) { e.preventDefault(); closeSettings(); }
  else if (sheetOpen()) { e.preventDefault(); closeSheet(); }
});

/* ---------- Disable text / image selection and dragging (editable fields excepted) ---------- */
document.addEventListener('selectstart', e => {
  const el = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
  if (el && el.closest('input, textarea')) return;
  e.preventDefault();
});
document.addEventListener('dragstart', e => e.preventDefault());

/* ================= Boot ================= */
function boot() {
  I18n.init();
  readTheme();
  buildIconGrid();
  buildLangSeg();
  $('#appVer').textContent = APP_VERSION;
  const local = loadLocal();
  S = local || seed();
  if (!local) { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  Snd.setOn(S.sound); renderSound();
  layout();
  new ResizeObserver(() => layout()).observe(stage);
  window.addEventListener('resize', layout);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const lastItem = S.items.slice().sort((a, b) => b.at - a.at)[0];
  setActive(lastItem ? lastItem.b : S.boxes[0].id);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  I18n.onChange(() => {
    renderIconLabels(); renderLangSeg();
    S.items.forEach(i => { i._lk = null; });   // redraw bubble titles in the new language
    hideToast();
    updateUI();
  });
}
boot();
})();
