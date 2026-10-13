/* BlogSeem landing: routing, language, hero form, scripted hero demo. */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t, ui = BS.ui;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- routing ---------- */
  BS.show = function (view) {
    var studio = view === 'studio';
    document.getElementById('landing').hidden = studio;
    document.getElementById('studio').hidden = !studio;
    document.body.classList.toggle('in-studio', studio);
    document.title = t(studio ? 'titleStudio' : 'title');
    if (studio) BS.openStudio();
    window.scrollTo(0, 0);
    updateCta();
  };
  function route() { BS.show(location.hash === '#studio' ? 'studio' : 'landing'); }

  function updateCta() {
    var has = BS.S.platforms.length > 0;
    var b = document.getElementById('nav-cta');
    if (b) b.textContent = t(has ? 'navContinue' : 'navOpen');
  }

  /* ---------- language ---------- */
  function setLang(l) {
    BS.setLang(l);
    BS.applyI18n();
    document.getElementById('lang').textContent = l === 'ru' ? 'EN' : 'RU';
    document.getElementById('lang').setAttribute('aria-label', t('langLabel'));
    heroForm();
    demoStart();
    if (!document.getElementById('studio').hidden) BS.renderStudio();
    document.title = t(document.getElementById('studio').hidden ? 'title' : 'titleStudio');
    updateCta();
  }

  /* ---------- hero form ---------- */
  var sel = [], ph = 0, phTimer = 0;
  function heroForm() {
    var box = BS.clear(document.getElementById('hero-form'));
    var ta = h('textarea#hero-brief', { rows: 3, maxlength: 700, 'aria-label': t('briefLabel') });
    var examples = [t('ex1'), t('ex2'), t('ex3')];
    ta.setAttribute('placeholder', examples[ph % 3]);
    clearInterval(phTimer);
    if (!reduce) phTimer = setInterval(function () { if (document.activeElement !== ta && !ta.value) { ph++; ta.setAttribute('placeholder', examples[ph % 3]); } }, 3500);
    var go = ui.btn(t('heroGo'), 'primary big', function () {
      var v = ta.value.trim();
      if (v.length < 8) { ta.focus(); return BS.toast(t('errBrief'), 'err'); }
      if (!sel.length) return BS.toast(t('errPick'), 'err');
      BS.start(v, sel.slice());
    });
    box.appendChild(h('label.fld', h('span.lbl', t('heroLabel')), ta));
    box.appendChild(h('div.fld', h('span.lbl', t('heroWhere')), ui.platformPicker(sel, { max: 3 })));
    box.appendChild(h('div.actions', go, h('span.fine', t('heroFine'))));
  }

  /* ---------- hero demo: a post being built, in five steps ---------- */
  var demoTimer = 0, demoRun = 0;
  function demoStart() {
    var stage = document.getElementById('demo');
    if (!stage) return;
    var run = ++demoRun;
    clearTimeout(demoTimer);
    var D = {
      name: t('dName'), handle: t('dHandle'), bio: t('dBio'), cap: t('dCap'), tags: t('dTags'), sub: t('dSub'),
      days: [t('dDay1'), t('dDay2'), t('dDay3'), t('dDay4'), t('dDay5'), t('dDay6')]
    };
    var steps = ['dStep1', 'dStep2', 'dStep3', 'dStep4', 'dStep5'];
    var chips = BS.clear(document.getElementById('demo-steps'));
    steps.forEach(function (k) { chips.appendChild(h('li', t(k))); });
    var screen = BS.clear(document.getElementById('demo-screen'));

    function mark(i) { Array.prototype.forEach.call(chips.children, function (li, k) { li.className = k < i ? 'done' : k === i ? 'on' : ''; }); }
    function type(el, text, speed, cb) {
      var i = 0; el.textContent = '';
      (function tick() {
        if (run !== demoRun) return;
        if (reduce) { el.textContent = text; return cb && cb(); }
        el.textContent = text.slice(0, ++i);
        if (i < text.length) demoTimer = setTimeout(tick, speed); else if (cb) demoTimer = setTimeout(cb, 380);
      })();
    }
    function wait(ms, cb) { demoTimer = setTimeout(function () { if (run === demoRun) cb(); }, reduce ? 0 : ms); }

    function s1() {
      mark(0); BS.clear(screen);
      var name = h('p.d-name'), handle = h('p.d-handle'), bio = h('p.d-bio');
      screen.appendChild(h('div.d-profile', h('img.d-ava', { src: 'icon.svg', alt: '' }), name, handle, bio));
      type(name, D.name, 40, function () { type(handle, D.handle, 40, function () { type(bio, D.bio, 22, function () { wait(500, s2); }); }); });
    }
    function s2() {
      mark(1); BS.clear(screen);
      var g = h('div.d-days'); screen.appendChild(g);
      D.days.forEach(function (d, i) { wait(i * 260, function () { g.appendChild(h('div.d-day', h('b', String(i + 1)), h('span', d))); }); });
      wait(D.days.length * 260 + 900, s3);
    }
    function s3() {
      mark(2); BS.clear(screen);
      var cap = h('p.d-cap'), tags = h('p.d-tags');
      screen.appendChild(h('div.d-post', cap, tags));
      type(cap, D.cap, 18, function () { type(tags, D.tags, 20, function () { wait(500, s4); }); });
    }
    function s4() {
      mark(3); BS.clear(screen);
      var art = h('div.d-art', h('i.sun'), h('i.cup'), h('i.steam'));
      var cap = h('p.d-cap.sm', D.cap.slice(0, 70) + '…');
      screen.appendChild(h('div.d-post', art, cap));
      wait(2200, s5);
    }
    function s5() {
      mark(4); BS.clear(screen);
      var words = D.sub.split(' '), span = h('span'), line = h('p.d-sub', span);
      var bars = h('div.d-bars', h('i'), h('i'), h('i'), h('i'));
      screen.appendChild(h('div.d-video', bars, h('div.d-art.full', h('i.sun'), h('i.cup'), h('i.steam')), line));
      words.forEach(function (w, i) { wait(260 * (i + 1), function () { span.textContent = words.slice(0, i + 1).join(' '); }); });
      wait(260 * words.length + 2400, s1);
    }
    s1();
  }

  /* ---------- init ---------- */
  function init() {
    var l = BS.lang();
    document.documentElement.lang = l;
    BS.applyI18n();
    document.getElementById('lang').textContent = l === 'ru' ? 'EN' : 'RU';
    document.getElementById('lang').setAttribute('aria-label', t('langLabel'));
    document.getElementById('lang').addEventListener('click', function () { setLang(BS.lang() === 'ru' ? 'en' : 'ru'); });
    document.getElementById('nav-cta').addEventListener('click', function () { location.hash = '#studio'; });
    document.getElementById('brand').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });
    document.querySelectorAll('[data-go="studio"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); location.hash = '#studio'; }); });
    document.querySelectorAll('[data-go="top"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; window.scrollTo(0, 0); var f = document.getElementById('hero-brief'); if (f) f.focus(); }); });
    window.addEventListener('hashchange', route);
    heroForm();
    demoStart();
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
