/*
 * BloopMind - reminders that live as bubbles
 * Copyright (C) 2026 Hasan Berat Kaylan
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://github.com/hasanbkaylan/bloopmind
 */
'use strict';

/*
 * Tiny i18n layer.
 *
 * Each file in js/locales/ registers one language:
 *     I18n.register('de', 'Deutsch', { 'add': 'Hinzufügen', ... });
 * English is the fallback for any missing key.
 *
 * Static markup is translated through data attributes:
 *     data-i18n="key"        -> textContent
 *     data-i18n-ph="key"     -> placeholder
 *     data-i18n-aria="key"   -> aria-label
 *     data-i18n-title="key"  -> title
 */
const I18n = (() => {
  const STORE = 'bloopmind.lang';
  const FALLBACK = 'en';
  const LANGS = [];            // [{ code, name }] in registration order
  const DICT = {};             // code -> { key: string }
  const subs = [];
  let cur = FALLBACK;

  const known = code => LANGS.some(l => l.code === code);

  function register(code, name, dict) {
    LANGS.push({ code, name });
    DICT[code] = dict;
  }

  function detect() {
    try {
      const saved = localStorage.getItem(STORE);
      if (known(saved)) return saved;
    } catch (e) { /* storage may be unavailable */ }
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || FALLBACK];
    for (const p of prefs) {
      const code = String(p).toLowerCase().slice(0, 2);
      if (known(code)) return code;
    }
    return FALLBACK;
  }

  function has(key) { return DICT[cur][key] !== undefined || (DICT[FALLBACK] || {})[key] !== undefined; }

  // t('toast.boxOpened', { n: 2 }) -> "Box 2 opened"
  function t(key, vars) {
    let s = DICT[cur][key];
    if (s === undefined) s = (DICT[FALLBACK] || {})[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }

  // Plural helper: tn('count', 3) looks up "count.one" or "count.other" using Intl.PluralRules.
  function tn(base, n) {
    const cat = new Intl.PluralRules(cur).select(n);
    return t(base + (cat === 'one' ? '.one' : '.other'), { n });
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  }

  function init() {
    cur = detect();
    document.documentElement.lang = cur;
    apply();
  }

  function set(code) {
    if (!known(code) || code === cur) return;
    cur = code;
    try { localStorage.setItem(STORE, code); } catch (e) { /* ignore */ }
    document.documentElement.lang = code;
    apply();
    subs.forEach(fn => fn(code));
  }

  return {
    LANGS, register, init, set, apply, t, tn, has,
    lang: () => cur,
    onChange: fn => { subs.push(fn); }
  };
})();
