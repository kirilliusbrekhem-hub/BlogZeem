/* BlogSeem coins: an anonymous device id, a server-side balance, and Evolution (a higher personal daily AI limit).
   The balance lives on the server. The client only asks. If storage is off, the coins UI stays hidden and everything else works. */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t;
  BS.views = BS.views || {};

  function makeId() {
    var a = new Uint8Array(16), s = '';
    try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
    for (var j = 0; j < 16; j++) s += (a[j] < 16 ? '0' : '') + a[j].toString(16);
    return s;
  }
  var mem = null;
  function device() {
    var id = null;
    try { id = localStorage.getItem('blogseem.dev'); } catch (e) { /* private mode */ }
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
      id = mem || makeId(); mem = id;
      try { localStorage.setItem('blogseem.dev', id); } catch (e) { /* keep in memory */ }
    }
    return id;
  }

  // Every AI request carries the device id, so the server can apply the personal limit.
  var rawApi = BS.api;
  BS.api = function (name, body) {
    var b = body || {};
    if (name !== 'wallet' && !b.device) b = Object.assign({}, b, { device: device() });
    return rawApi.call(BS, name, b);
  };

  var W = BS.wallet = { st: null, off: false, listeners: [] };
  function set(st) { W.st = st; W.listeners.slice().forEach(function (f) { try { f(st); } catch (e) { /* ignore */ } }); return st; }
  function call(body) {
    return rawApi.call(BS, 'wallet', Object.assign({ device: device() }, body)).then(set, function (e) {
      if (e && (e.code === 'storage' || e.code === 'net')) W.off = true;
      if (e && e.st) set(e.st);
      throw e;
    });
  }
  W.state = function () { return call({ op: 'state' }); };
  W.earn = function (action, pid, day) {
    if (W.off) return Promise.resolve(null);
    return call({ op: 'earn', action: action, pid: pid, day: day }).then(function (st) {
      if (st && st.gained > 0) BS.toast(t('coinGain', { n: st.gained }));
      return st;
    }, function () { return null; });
  };
  W.evolve = function () { return call({ op: 'evolve' }); };

  // Once a day, on start.
  function daily() {
    var today = new Date().toISOString().slice(0, 10), seen = null;
    try { seen = localStorage.getItem('blogseem.visit'); } catch (e) { /* ignore */ }
    if (seen === today) return;
    W.earn('visit').then(function (st) { if (st) { try { localStorage.setItem('blogseem.visit', today); } catch (e) { /* ignore */ } } });
  }
  setTimeout(daily, 1500);

  BS.views.coins = function (stage) {
    var u = BS.ui;
    stage.appendChild(h('header.view-head', h('h1.display', t('coinsTitle')), h('p.lead', t('coinsLead'))));
    var body = h('div.coins');
    stage.appendChild(body);
    function draw(st) {
      BS.clear(body);
      if (!st) { body.appendChild(h('div.empty', h('p', t('coinsOff')))); return; }
      body.appendChild(h('div.ch-stats',
        h('div.ch-stat', h('b', String(st.coins)), h('span', t('coinsBalance'))),
        h('div.ch-stat', h('b', st.earnedToday + '/' + st.dailyCap), h('span', t('coinsToday'))),
        h('div.ch-stat', h('b', '×' + st.mult), h('span', t('evoLimit')))));
      if (st.restricted) body.appendChild(h('p.hint', t('coinsRestricted')));
      var ways = h('ul.plain', [t('earnVisit'), t('earnDna'), t('earnChday')].map(function (x) { return h('li', x); }));
      body.appendChild(u.sec(t('coinsHow'), t('coinsHowHint'), ways));
      var costs = st.costs || [300, 900, 2700], mults = [1, 1.5, 2, 3];
      var lv = h('div.evo');
      for (var i = 0; i < costs.length; i++) lv.appendChild(level(i + 1, costs[i], mults[i + 1], st));
      body.appendChild(u.sec(t('evoTitle'), t('evoLead'), lv));
      body.appendChild(u.sec(t('coinsBuyTitle'), t('coinsBuySoon'), h('div.row',
        h('button.btn', { type: 'button', disabled: true }, t('coinsBuy')),
        h('button.btn', { type: 'button', disabled: true }, t('coinsSupport')))));
    }
    function level(n, cost, mult, st) {
      var done = st.level >= n, next = st.level + 1 === n, can = next && st.coins >= cost;
      var action = done ? h('span.tag', t('evoDone'))
        : h('button.btn' + (can ? '.primary' : ''), { type: 'button', disabled: !can, onclick: function () {
          W.evolve().then(function (s) { BS.toast(t('evoUp', { n: n })); draw(s); }, function (e) { BS.toast(t(e && e.code === 'coins' ? 'evoNeed' : 'errAi'), 'err'); });
        } }, next ? t('evoBuy', { c: cost }) : t('evoLocked', { c: cost }));
      return h('div.evo-lv' + (done ? '.done' : ''), h('b', t('evoLevel', { n: n })), h('span', t('evoMult', { m: mult })), action);
    }
    draw(W.st);
    W.state().then(draw, function () { draw(null); });
  };
})();
