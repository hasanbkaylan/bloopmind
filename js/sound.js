/*
 * BloopMind - reminders that live as bubbles
 * Copyright (C) 2026 Hasan Berat Kaylan
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://github.com/hasanbkaylan/bloopmind
 */
'use strict';

/* Procedural sound effects built on the Web Audio API. No audio files needed. */
const Snd = (() => {
  const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let ac = null, out = null, noise = null, on = true, voices = 0, hold = null, lastHit = 0;
  function ctxOk() {
    if (!on) return null;
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 6;
        out = ac.createGain(); out.gain.value = 0.85;
        out.connect(comp); comp.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return null; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function env(g, t, peak, att, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0003), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(o) {
    const a = ctxOk(); if (!a || voices > 18) return;
    const t = a.currentTime + (o.at || 0);
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    if (o.det) osc.detune.value = o.det;
    env(g, t, o.gain || 0.2, o.att || 0.004, o.dur);
    if (o.lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); f.connect(g); } else osc.connect(g);
    g.connect(out);
    voices++;
    osc.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* ignore */ } };
    osc.start(t); osc.stop(t + o.dur + 0.03);
  }
  function burst(o) {
    const a = ctxOk(); if (!a || voices > 18) return;
    const t = a.currentTime + (o.at || 0);
    const src = a.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = a.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = a.createGain(); env(g, t, o.gain || 0.3, o.att || 0.002, o.dur);
    src.connect(f); f.connect(g); g.connect(out);
    voices++;
    src.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* ignore */ } };
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.03);
  }
  return {
    unlock() { ctxOk(); },
    setOn(v) { on = !!v; if (!on) this.holdStop(); },
    isOn() { return on; },
    hit(sn, r) {
      const a = ctxOk(); if (!a) return;
      const nowT = performance.now(); if (nowT - lastHit < 22) return; lastHit = nowT;
      const v = clamp(sn * 0.85, 0.04, 0.5);
      const f0 = clamp(980 - r * 8.5, 240, 760) * (0.92 + rnd() * 0.16);
      tone({ f0, f1: f0 * 0.52, dur: 0.07 + r * 0.0009, gain: v * 0.55, type: 'sine', lp: 2600 });
      burst({ f0: 2200, dur: 0.025, gain: v * 0.12, q: 1.2 });
    },
    wall(sn, r) {
      const a = ctxOk(); if (!a) return;
      const nowT = performance.now(); if (nowT - lastHit < 22) return; lastHit = nowT;
      const v = clamp(sn * 0.8, 0.04, 0.45);
      tone({ f0: 150 + (60 - Math.min(r, 60)) * 1.5, f1: 62, dur: 0.12, gain: v * 0.7, type: 'sine' });
    },
    add() { tone({ f0: 250, f1: 640, dur: 0.17, gain: 0.2 }); tone({ f0: 500, f1: 1000, dur: 0.08, gain: 0.07, at: 0.1 }); },
    tap() { tone({ f0: 760, f1: 1120, dur: 0.06, gain: 0.12, type: 'triangle' }); },
    save() { tone({ f0: 523, dur: 0.12, gain: 0.13, type: 'triangle' }); tone({ f0: 784, dur: 0.18, gain: 0.13, type: 'triangle', at: 0.07 }); },
    undo() { tone({ f0: 720, f1: 430, dur: 0.12, gain: 0.14, type: 'triangle' }); },
    err() { tone({ f0: 180, f1: 150, dur: 0.12, gain: 0.1, type: 'square', lp: 700 }); },
    full() { tone({ f0: 392, f1: 330, dur: 0.22, gain: 0.14, type: 'triangle' }); tone({ f0: 294, f1: 247, dur: 0.3, gain: 0.14, type: 'triangle', at: 0.14 }); },
    newbox() { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.22, gain: 0.11, type: 'triangle', at: i * 0.07 })); },
    toss() { burst({ f0: 500, f1: 1600, dur: 0.14, gain: 0.08, q: 0.6 }); },
    pop(r) {
      const sc = clamp(1.35 - r / 110, 0.55, 1.2);
      burst({ f0: 1700 * sc, f1: 700 * sc, dur: 0.14, gain: 0.55, q: 0.7 });
      burst({ f0: 5200, ft: 'highpass', dur: 0.05, gain: 0.18, q: 0.5 });
      tone({ f0: 420 * sc, f1: 70, dur: 0.2, gain: 0.5, type: 'sine' });
      for (let i = 0; i < 4; i++) tone({ f0: 1800 + rnd() * 1800, f1: 2600 + rnd() * 1500, dur: 0.06, gain: 0.06, at: 0.03 + i * 0.035 + rnd() * 0.02, type: 'sine' });
    },
    holdStart() {
      const a = ctxOk(); if (!a || hold) return;
      const osc = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      osc.type = 'triangle'; osc.frequency.value = 170;
      lfo.frequency.value = 9; lg.gain.value = 7; lfo.connect(lg); lg.connect(osc.frequency);
      g.gain.value = 0.0001; osc.connect(g); g.connect(out);
      osc.start(); lfo.start();
      hold = { osc, g, lfo };
    },
    holdUpdate(p) {
      if (!hold || !ac) return;
      const t = ac.currentTime;
      hold.osc.frequency.setTargetAtTime(170 + 640 * p * p, t, 0.03);
      hold.g.gain.setTargetAtTime(0.03 + 0.11 * p, t, 0.03);
    },
    holdStop() {
      if (!hold || !ac) { hold = null; return; }
      const { osc, g, lfo } = hold; hold = null;
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.02);
      try { osc.stop(t + 0.12); lfo.stop(t + 0.12); } catch (e) { /* ignore */ }
    }
  };
})();
