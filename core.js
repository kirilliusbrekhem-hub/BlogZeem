/* BlogSeem core: state, i18n, DOM helper, API client, image store. */
(function () {
  'use strict';
  var BS = window.BS = {};
  var KEY = 'blogseem.v1';

  /* ---------- state ---------- */
  function blank() { return { lang: null, brief: '', platforms: [], names: {}, cur: null, view: 'account', byP: {}, tone: 'plain', voice: '', twin: {}, audits: [], useInsights: true }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.byP && s.platforms) return s; } catch (e) { /* fresh */ }
    return blank();
  }
  BS.S = load();
  var saveTimer = 0;
  BS.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(BS.S)); } catch (e) { /* private mode or full */ } }, 250);
  };
  BS.reset = function () { BS.S = blank(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

  /* ---------- i18n ---------- */
  BS.lang = function () {
    if (BS.S.lang) return BS.S.lang;
    var n = (navigator.language || 'en').toLowerCase();
    return n.indexOf('ru') === 0 || n.indexOf('uk') === 0 || n.indexOf('be') === 0 || n.indexOf('kk') === 0 ? 'ru' : 'en';
  };
  BS.setLang = function (l) { BS.S.lang = l; BS.save(); document.documentElement.lang = l; };
  BS.t = function (k, v) {
    var D = BS.D, L = BS.lang();
    var s = (D[L] && D[L][k]) || (D.en && D.en[k]) || k;
    if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]);
    return s;
  };
  BS.contentLang = function () { return /[Ѐ-ӿ]/.test(BS.S.brief || '') ? 'ru' : 'en'; };
  BS.applyI18n = function (root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = BS.t(el.getAttribute('data-i18n')); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', BS.t(el.getAttribute('data-i18n-ph'))); });
    (root || document).querySelectorAll('[data-i18n-label]').forEach(function (el) { el.setAttribute('aria-label', BS.t(el.getAttribute('data-i18n-label'))); });
  };

  /* ---------- DOM ---------- */
  // h('div.cls#id', {attr}, child, child...) ; text is always set as text, never as HTML.
  BS.h = function (sel, attrs) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    var el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, k, v) { if (k === '.') el.classList.add(v); else el.id = v; });
    var i = 1;
    if (attrs && typeof attrs === 'object' && !(attrs.nodeType) && !Array.isArray(attrs)) {
      i = 2;
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = !!v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (n) { if (n.slice(0, 2) === '--') el.style.setProperty(n, v[n]); else el.style[n] = v[n]; });
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { add(el, x); });
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  BS.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  BS.$ = function (s, r) { return (r || document).querySelector(s); };

  BS.toast = function (msg, kind) {
    var box = BS.$('#toasts');
    if (!box) return;
    var el = BS.h('div.toast' + (kind === 'err' ? '.err' : ''), { role: kind === 'err' ? 'alert' : 'status' }, msg);
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, kind === 'err' ? 6500 : 2600);
  };

  BS.copy = function (text, okMsg) {
    var done = function () { BS.toast(okMsg || BS.t('copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { BS.toast(BS.t('copyFail'), 'err'); }
      ta.remove();
    }
  };

  BS.download = function (name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  BS.dataUrlToBlob = function (u) {
    var p = u.split(','), mime = /data:([^;]+)/.exec(p[0])[1], bin = atob(p[1]), n = bin.length, a = new Uint8Array(n);
    while (n--) a[n] = bin.charCodeAt(n);
    return new Blob([a], { type: mime });
  };

  /* ---------- API ---------- */
  function apiErr(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  BS.api = function (name, body) {
    return fetch('/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .catch(function () { throw apiErr('net'); })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) {
          if (!r.ok) throw apiErr((j && j.error) || 'ai', j && j.message);
          return j;
        });
      });
  };
  BS.errText = function (e) {
    var c = e && e.code;
    var m = { config: 'errConfig', limit: 'errLimit', busy: 'errBusy', net: 'errNet', auth: 'errAuth', brief: 'errBrief', image: 'errImage' };
    return BS.t(m[c] || 'errAi');
  };
  BS.ctx = function (pid) {
    return { brief: BS.S.brief, platform: pid, platformName: (BS.S.names || {})[pid] || '', lang: BS.contentLang(), voice: BS.voiceText() };
  };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  BS.sleep = sleep;
  // YandexART is asynchronous: start a job, then poll until the picture is ready.
  BS.makeImage = function (prompt, ratio) {
    return BS.api('image', { prompt: prompt, w: ratio[0], h: ratio[1] }).then(function (j) {
      if (j.image) return j.image; // providers that answer at once
      var id = j.id, tries = 0;
      function poll() {
        if (++tries > 45) throw apiErr('image', 'timeout');
        return sleep(tries === 1 ? 4000 : 2500).then(function () { return BS.api('image', { id: id }); }).then(function (s) { return s.done ? s.image : poll(); });
      }
      return poll();
    });
  };

  /* ---------- image store (IndexedDB, memory fallback) ---------- */
  var mem = {}, dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open('blogseem', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('img'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var q = fn(d.transaction('img', mode).objectStore('img'));
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  BS.imgSet = function (k, v) { mem[k] = v; return tx('readwrite', function (s) { return s.put(v, k); }).catch(function () { /* memory copy remains */ }); };
  BS.imgGet = function (k) { return mem[k] ? Promise.resolve(mem[k]) : tx('readonly', function (s) { return s.get(k); }).then(function (v) { if (v) mem[k] = v; return v || null; }).catch(function () { return null; }); };
  BS.imgDel = function (k) { delete mem[k]; return tx('readwrite', function (s) { return s.delete(k); }).catch(function () { /* ignore */ }); };

  BS.loadImage = function (src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  };

  /* ---------- Creator memory: everything the app knows about the author's voice, as text for every prompt ---------- */
  BS.labStats = function () {
    var by = {}, total = 0, sum = 0, list = [];
    BS.S.platforms.forEach(function (pid) {
      var posts = (BS.S.byP[pid] || {}).posts || {};
      Object.keys(posts).forEach(function (k) {
        var r = posts[k].result;
        if (!r || !(r.views > 0)) return;
        var er = (r.likes + r.comments + r.saves) / r.views * 100;
        var st = r.style || 'none';
        (by[st] = by[st] || { style: st, n: 0, sum: 0 }); by[st].n++; by[st].sum += er;
        total++; sum += er; list.push({ pid: pid, key: k, post: posts[k], er: er, r: r });
      });
    });
    var rows = Object.keys(by).map(function (k) { return { style: k, n: by[k].n, er: by[k].sum / by[k].n }; }).sort(function (a, b) { return b.er - a.er; });
    return { rows: rows, total: total, avg: total ? sum / total : 0, list: list };
  };
  // A style is only called "best" with at least 3 logged posts. Fewer is noise, and the UI says so.
  BS.hookInsight = function () {
    var st = BS.labStats();
    var ok = st.rows.filter(function (r) { return r.style !== 'none' && r.n >= 3; });
    return ok.length ? { style: ok[0].style, n: ok[0].n, er: ok[0].er, avg: st.avg } : null;
  };
  BS.voiceText = function () {
    var S = BS.S, tw = S.twin || {}, parts = [], st = [];
    [['humor', 'humor'], ['sentences', 'sentences'], ['address', 'addresses the reader'], ['emoji', 'emoji and punctuation'], ['formats', 'favourite structures']].forEach(function (f) { if (tw[f[0]]) st.push(f[1] + ': ' + tw[f[0]]); });
    if (st.length) parts.push('Style: ' + st.join('; ') + '.');
    if (tw.vocabulary) parts.push('Signature words: ' + tw.vocabulary + '.');
    if (tw.phrases) parts.push('Typical phrases: ' + tw.phrases + '.');
    if (tw.avoid) parts.push('The author never: ' + tw.avoid + '.');
    if (S.voice) parts.push('Rules: ' + S.voice);
    if (tw.dislikes && tw.dislikes.length) parts.push('Drafts the author rejected, because: ' + tw.dislikes.join(' | ') + '.');
    var ins = S.useInsights === false ? null : BS.hookInsight();
    if (ins) parts.push('Hook style that performed best for this author so far: ' + ins.style + '.');
    if (tw.examples && tw.examples.length) parts.push('Approved examples of the author\'s voice: ' + tw.examples.map(function (e, i) { return (i + 1) + ') ' + e; }).join(' '));
    return parts.join('\n').slice(0, 1580);
  };

  /* ---------- small helpers ---------- */
  BS.plat = function (id) { return window.BS_SPECS.platform(id); };
  BS.platName = function (id) { return id === 'other' ? ((BS.S.names || {}).other || BS.t('otherName')) : BS.plat(id).name; };
  BS.fmtName = function (pid, fid) { var f = window.BS_SPECS.format(pid, fid); return f[BS.lang()] || f.en; };
  BS.pd = function (pid) { var b = BS.S.byP; if (!b[pid]) b[pid] = { profile: null, plan: null, posts: {}, checks: {}, custom: 0 }; return b[pid]; };
})();
