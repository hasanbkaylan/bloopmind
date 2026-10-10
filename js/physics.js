/*
 * BloopMind - reminders that live as bubbles
 * Copyright (C) 2026 Hasan Berat Kaylan
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://github.com/hasanbkaylan/bloopmind
 */
'use strict';

/* Circle physics engine: position-based (PBD), small fixed sub-steps, friction, bounce.
   The box has a left wall, a right wall and a floor; the top is open. */
const Phys = (() => {
  const H = 1 / 480;        // fixed sub-step
  const ITER = 3;           // constraint iterations
  const MAXSUB = 40;        // max sub-steps per frame
  const VMAX = 2600;

  function createWorld() {
    return {
      bodies: [], L: 0, R: 300, B: 500, ceil: 0, g: 1900, acc: 0,
      events: [], cs: [], nc: 0,
      e_pair: 0.34, e_wall: 0.32, fric_pair: 70, fric_floor: 14, damp: 0.35, mu_s: 0.2, vmax: VMAX
    };
  }

  function addBody(w, o) {
    const b = Object.assign({
      id: '', x: 0, y: 0, vx: 0, vy: 0, r: 20,
      px: 0, py: 0, pvx: 0, pvy: 0,
      drag: false, entered: false,
      sq: 0, sqv: 0, sqa: 0
    }, o);
    w.bodies.push(b); w.ord = null;
    return b;
  }

  function removeBody(w, b) {
    const i = w.bodies.indexOf(b);
    if (i >= 0) { w.bodies.splice(i, 1); w.ord = null; }
  }

  function contact(w) {
    const k = w.nc++;
    return w.cs[k] || (w.cs[k] = { a: null, b: null, nx: 0, ny: 0, pre: 0 });
  }

  function sub(w, h) {
    const bs = w.bodies, n = bs.length, g = w.g;
    const damp = 1 / (1 + w.damp * h);
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      b.px = b.x; b.py = b.y;
      if (b.drag) { b.x += b.vx * h; b.y += b.vy * h; b.pvx = 0; b.pvy = 0; continue; }
      b.vy += g * h; b.vx *= damp; b.vy *= damp;
      b.pvx = b.vx; b.pvy = b.vy;
      b.x += b.vx * h; b.y += b.vy * h;
    }
    w.nc = 0;
    const L = w.L, R = w.R, B = w.B;
    // sweep sorted by x: only nearby neighbours are tested
    let ord = w.ord;
    if (!ord || ord.length !== n) ord = w.ord = bs.slice();
    for (let i = 1; i < n; i++) {
      const t = ord[i]; let j = i - 1;
      while (j >= 0 && ord[j].x > t.x) { ord[j + 1] = ord[j]; j--; }
      ord[j + 1] = t;
    }
    let mr = 0;
    for (let i = 0; i < n; i++) if (bs[i].r > mr) mr = bs[i].r;
    const reach = 2 * mr + 10;
    const iters = n > 34 ? 2 : ITER;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const a = ord[i];
        for (let j = i + 1; j < n; j++) {
          const c = ord[j];
          const dx = c.x - a.x, dy = c.y - a.y, md = a.r + c.r;
          if (dx > reach) break;
          if (Math.abs(dx) >= md || Math.abs(dy) >= md) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= md * md) continue;
          let d = Math.sqrt(d2), nx, ny;
          if (d < 1e-6) { d = 1e-6; nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
          const pen = Math.min(md - d, 1.2);
          const wa = a.drag ? 0 : 1 / (a.r * a.r), wc = c.drag ? 0 : 1 / (c.r * c.r), ws = wa + wc;
          if (ws === 0) continue;
          const ka = pen * wa / ws, kc = pen * wc / ws;
          a.x -= nx * ka; a.y -= ny * ka; c.x += nx * kc; c.y += ny * kc;
          if (it === 0) {
            const k = contact(w);
            k.a = a; k.b = c; k.nx = nx; k.ny = ny;
            k.pre = (a.pvx - c.pvx) * nx + (a.pvy - c.pvy) * ny; // >0: approaching
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const b = bs[i];
        if (b.x - b.r < L) { b.x += Math.min(L + b.r - b.x, 8); if (it === 0 && !b.drag) { const k = contact(w); k.a = b; k.b = null; k.nx = -1; k.ny = 0; k.pre = b.pvx * -1; } }
        else if (b.x + b.r > R) { b.x -= Math.min(b.x + b.r - R, 8); if (it === 0 && !b.drag) { const k = contact(w); k.a = b; k.b = null; k.nx = 1; k.ny = 0; k.pre = b.pvx; } }
        if (b.y + b.r > B) { b.y -= Math.min(b.y + b.r - B, 8); if (it === 0 && !b.drag) { const k = contact(w); k.a = b; k.b = null; k.nx = 0; k.ny = 1; k.pre = b.pvy; } }
        if (!b.entered) { if (b.y - b.r >= w.ceil) b.entered = true; }
        else if (b.y - b.r < w.ceil) { b.y = w.ceil + b.r; if (it === 0 && !b.drag) { const k = contact(w); k.a = b; k.b = null; k.nx = 0; k.ny = -1; k.pre = -b.pvy; } }
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.drag) continue;
      b.vx = (b.x - b.px) / h; b.vy = (b.y - b.py) / h;
    }
    const RV = 0.075 * g, SV = 0.11 * g, VT = w.mu_s * g * h;
    for (let k = 0; k < w.nc; k++) {
      const c = w.cs[k], a = c.a, o = c.b;
      if (o) {
        const wa = a.drag ? 0 : 1 / (a.r * a.r), wc = o.drag ? 0 : 1 / (o.r * o.r), ws = wa + wc;
        const nx = c.nx, ny = c.ny;
        if (c.pre > RV) {
          const sep = (o.vx - a.vx) * nx + (o.vy - a.vy) * ny;
          const target = w.e_pair * c.pre;
          if (sep < target) {
            const dv = target - sep;
            if (!a.drag) { a.vx -= nx * dv * wa / ws; a.vy -= ny * dv * wa / ws; }
            if (!o.drag) { o.vx += nx * dv * wc / ws; o.vy += ny * dv * wc / ws; }
          }
          if (c.pre > SV) w.events.push({ s: c.pre, a, b: o, nx, ny });
        }
        // tangential friction
        const rvx = o.vx - a.vx, rvy = o.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        const tx = rvx - vn * nx, ty = rvy - vn * ny;
        const tl = Math.sqrt(tx * tx + ty * ty);
        const mu = tl < VT ? 1 : Math.min(1, w.fric_pair * h);
        if (!a.drag) { a.vx += tx * mu * wa / ws; a.vy += ty * mu * wa / ws; }
        if (!o.drag) { o.vx -= tx * mu * wc / ws; o.vy -= ty * mu * wc / ws; }
      } else {
        const nx = c.nx, ny = c.ny;
        if (c.pre > RV) {
          const vn = a.vx * nx + a.vy * ny;
          const want = -w.e_wall * c.pre;
          if (vn > want) { a.vx -= nx * (vn - want); a.vy -= ny * (vn - want); }
          if (c.pre > SV) w.events.push({ s: c.pre, a, b: null, nx, ny });
        }
        if (ny === 1) { if (Math.abs(a.vx) < VT) a.vx = 0; else a.vx *= Math.max(0, 1 - w.fric_floor * h); }
        else if (ny === 0) a.vy *= Math.max(0, 1 - w.fric_floor * 0.4 * h);
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.drag) continue;
      const s2 = b.vx * b.vx + b.vy * b.vy;
      const vm = w.vmax; if (s2 > vm * vm) { const f = vm / Math.sqrt(s2); b.vx *= f; b.vy *= f; }
    }
  }

  function step(w, dt) {
    w.acc += Math.min(dt, 0.05);
    let n = 0;
    while (w.acc >= H && n < MAXSUB) { sub(w, H); w.acc -= H; n++; }
    if (n === MAXSUB) w.acc = 0;
  }

  // Fast off-screen settling (duration in seconds)
  function settle(w, seconds) {
    const n = Math.round(seconds / H);
    for (let i = 0; i < n; i++) sub(w, H);
    w.events.length = 0;
  }

  return { H, createWorld, addBody, removeBody, step, settle };
})();
