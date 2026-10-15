/* BlogZeem landing: routing, language, hero form. */
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
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
