/* BlogSeem studio: setup, build, account, plan, repurpose, memory. The post editor lives in editor.js. */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t, ui = BS.ui = {};
  var SPECS = window.BS_SPECS;

  /* ---------- small UI kit ---------- */
  ui.btn = function (label, cls, onclick, attrs) {
    return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), Object.assign({ type: 'button', onclick: onclick }, attrs || {}), label);
  };
  ui.run = function (btn, fn) {
    if (btn.disabled) return null;
    btn.disabled = true; btn.classList.add('busy');
    return Promise.resolve().then(fn).catch(function (e) { BS.toast(BS.errText(e), 'err'); }).then(function () { btn.disabled = false; btn.classList.remove('busy'); });
  };
  ui.counter = function (ta, limit) {
    var c = h('span.count');
    function u() { var n = ta.value.length; c.textContent = n + ' / ' + limit; c.classList.toggle('over', n > limit); }
    ta.addEventListener('input', u); u();
    c.update = u;
    return c;
  };
  ui.grow = function (ta) {
    function g() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 560) + 'px'; }
    ta.addEventListener('input', g); setTimeout(g, 0); ta.grow = g;
  };

  var ORDER = ['instagram', 'tiktok', 'youtube', 'telegram', 'vk', 'dzen', 'x', 'threads', 'linkedin', 'facebook', 'pinterest', 'other'];
  var MAX_NEW = 3;

  // Multi-select of platforms. sel is an array mutated in place.
  ui.platformPicker = function (sel, opts) {
    var o = opts || {};
    var wrap = h('div.picker');
    var nameIn = h('input.other-name', { type: 'text', maxlength: 30, placeholder: t('otherPh'), 'aria-label': t('otherName'), value: (BS.S.names || {}).other || '' });
    nameIn.addEventListener('input', function () { BS.S.names = BS.S.names || {}; BS.S.names.other = nameIn.value.trim(); BS.save(); });
    function draw() {
      BS.clear(wrap);
      var row = h('div.chips', { role: 'group', 'aria-label': t('pickPlatforms') });
      ORDER.filter(function (id) { return !o.exclude || o.exclude.indexOf(id) < 0; }).forEach(function (id) {
        var on = sel.indexOf(id) >= 0;
        row.appendChild(h('button.chip', {
          type: 'button', 'aria-pressed': on ? 'true' : 'false', style: { '--c': SPECS.platform(id).color },
          onclick: function () {
            var i = sel.indexOf(id);
            if (i >= 0) sel.splice(i, 1);
            else { if (sel.length >= (o.max || MAX_NEW)) return BS.toast(t('maxPlatforms', { n: o.max || MAX_NEW })); sel.push(id); }
            draw(); if (o.onchange) o.onchange();
          }
        }, h('i.dot'), id === 'other' ? t('otherName') : SPECS.platform(id).name));
      });
      wrap.appendChild(row);
      if (sel.indexOf('other') >= 0) wrap.appendChild(h('label.other', t('otherLabel'), nameIn));
    }
    draw();
    return wrap;
  };

  /* ---------- screens ---------- */
  var root = function () { return document.getElementById('studio-root'); };

  BS.openStudio = function () { render(); };

  function render() {
    var r = BS.clear(root());
    if (BS.S.platforms.length) renderProject(r); else renderSetup(r);
  }
  BS.renderStudio = render;

  function renderSetup(r) {
    var sel = (BS.S.pending || []).slice();
    var brief = h('textarea#brief', { rows: 4, maxlength: 700, placeholder: t('briefPh'), 'aria-label': t('briefLabel') }, BS.S.brief || '');
    var go = ui.btn(t('buildBtn'), 'primary big', function () {
      var b = brief.value.trim();
      if (b.length < 8) { brief.focus(); return BS.toast(t('errBrief'), 'err'); }
      if (!sel.length) return BS.toast(t('errPick'), 'err');
      BS.start(b, sel.slice());
    });
    r.appendChild(h('section.setup',
      h('h1.display', t('setupTitle')),
      h('p.lead', t('setupLead')),
      h('label.fld', h('span.lbl', t('briefLabel')), brief),
      h('div.fld', h('span.lbl', t('pickPlatforms')), ui.platformPicker(sel, { max: MAX_NEW })),
      h('div.actions', go, h('span.fine', t('setupFine')))
    ));
  }

  /* Start a brand-new project. */
  BS.start = function (brief, pids) {
    var keepVoice = BS.S.voice, keepLang = BS.S.lang, keepNames = BS.S.names;
    BS.reset();
    BS.S.lang = keepLang; BS.S.voice = keepVoice || ''; BS.S.names = keepNames || {};
    BS.S.brief = brief; BS.S.platforms = pids.slice(); BS.S.cur = pids[0]; BS.S.view = 'account';
    BS.save();
    if (location.hash !== '#studio') location.hash = '#studio';
    BS.show('studio');
    runSteps(pids);
  };

  function addPlatform(pid) { BS.S.platforms.push(pid); BS.S.cur = pid; BS.S.view = 'account'; BS.save(); runSteps([pid]); }

  /* Build overlay: account setup + 30-day plan for each platform, in parallel. */
  function runSteps(pids) {
    var box = BS.clear(document.getElementById('making'));
    box.hidden = false;
    document.body.classList.add('locked');
    var rows = {}, failed = 0;
    var list = h('ul.steps');
    pids.forEach(function (pid) {
      ['profile', 'plan'].forEach(function (step) {
        var li = h('li.step.run', h('span.mark'), h('span.lbl', BS.platName(pid) + ' · ' + t(step === 'profile' ? 'stepProfile' : 'stepPlan')), h('span.why'));
        rows[pid + step] = li; list.appendChild(li);
      });
    });
    var msg = h('p.making-msg', t('making1'));
    var actions = h('div.actions');
    box.appendChild(h('div.making-in', h('h2.display', t('makingTitle')), msg, list, actions));
    var lines = ['making1', 'making2', 'making3', 'making4'], li = 0;
    var timer = setInterval(function () { li = (li + 1) % lines.length; msg.textContent = t(lines[li]); }, 3200);

    function job(pid, step) {
      var row = rows[pid + step], pd = BS.pd(pid);
      row.className = 'step run'; row.lastChild.textContent = '';
      return BS.api(step, BS.ctx(pid)).then(function (res) {
        if (step === 'profile') pd.profile = res; else pd.plan = res.days;
        BS.save(); row.className = 'step ok';
      }).catch(function (e) { failed++; row.className = 'step err'; row.lastChild.textContent = BS.errText(e); });
    }
    function go() {
      failed = 0; BS.clear(actions);
      var jobs = [];
      pids.forEach(function (pid) {
        var pd = BS.pd(pid);
        if (!pd.profile) jobs.push(job(pid, 'profile'));
        if (!pd.plan) jobs.push(job(pid, 'plan'));
      });
      Promise.all(jobs).then(function () {
        if (!failed) return done();
        actions.appendChild(ui.btn(t('retry'), 'primary', function () { go(); }));
        var ok = pids.some(function (p) { return BS.pd(p).profile || BS.pd(p).plan; });
        if (ok) actions.appendChild(ui.btn(t('openReady'), 'ghost', done));
        else actions.appendChild(ui.btn(t('back'), 'ghost', function () { done(true); }));
      });
    }
    function done(abort) {
      clearInterval(timer);
      box.hidden = true; document.body.classList.remove('locked');
      if (abort === true) { pids.forEach(function (p) { var i = BS.S.platforms.indexOf(p); if (i >= 0 && !BS.pd(p).profile && !BS.pd(p).plan) BS.S.platforms.splice(i, 1); }); BS.S.cur = BS.S.platforms[0] || null; }
      BS.save(); render();
    }
    go();
  }

  /* ---------- project shell ---------- */
  function renderProject(r) {
    var S = BS.S;
    if (!S.cur || S.platforms.indexOf(S.cur) < 0) S.cur = S.platforms[0];
    var pid = S.cur;

    var tabs = h('div.ptabs', { role: 'tablist', 'aria-label': t('platforms') });
    S.platforms.forEach(function (id) {
      tabs.appendChild(h('button.ptab', {
        role: 'tab', 'aria-selected': id === pid ? 'true' : 'false', style: { '--c': SPECS.platform(id).color },
        onclick: function () { S.cur = id; BS.save(); render(); }
      }, h('i.dot'), BS.platName(id)));
    });
    var more = h('button.ptab.add', { type: 'button', 'aria-label': t('addPlatform'), onclick: function () { openAdd(); } }, '+');
    tabs.appendChild(more);

    var views = [['account', 'navAccount'], ['plan', 'navPlan'], ['trends', 'navTrends'], ['dna', 'navDna'], ['challenge', 'navChallenge'], ['xray', 'navXray'], ['lab', 'navLab'], ['repurpose', 'navRepurpose'], ['memory', 'navMemory'], ['coins', 'navCoins']];
    var nav = h('nav.vnav', { 'aria-label': t('sections') });
    views.forEach(function (v) {
      nav.appendChild(h('button.vbtn', {
        type: 'button', 'aria-current': S.view === v[0] ? 'page' : null,
        onclick: function () { S.view = v[0]; BS.save(); render(); }
      }, t(v[1])));
    });

    var stage = h('div.stage#stage', { tabindex: -1 });
    var brief = h('p.brief', { title: S.brief }, S.brief.length > 90 ? S.brief.slice(0, 90) + '…' : S.brief);
    var side = h('aside.rail',
      h('div.rail-head', h('span.rail-label', t('yourChannel')), brief),
      nav,
      h('div.rail-foot',
        ui.btn(t('exportAll'), 'ghost small', exportAll),
        ui.btn(t('newProject'), 'ghost small', function () { if (confirm(t('newConfirm'))) { BS.reset(); location.hash = ''; BS.show('landing'); render(); } })
      ));
    r.appendChild(h('div.shell', side, h('div.main', tabs, stage)));

    if (S.view === 'account') renderAccount(stage, pid);
    else if (S.view === 'plan') renderPlan(stage, pid);
    else if (S.view === 'repurpose') renderRepurpose(stage);
    else if (BS.views && BS.views[S.view]) BS.views[S.view](stage, pid);
    else renderAccount(stage, pid);
  }

  function openAdd() {
    var left = ORDER.filter(function (id) { return BS.S.platforms.indexOf(id) < 0; });
    if (!left.length) return;
    var sel = [];
    var dlg = h('dialog.sheet');
    var go = ui.btn(t('addGo'), 'primary', function () { if (!sel.length) return; dlg.close(); dlg.remove(); addPlatform(sel[0]); });
    dlg.appendChild(h('div.sheet-in', h('h2', t('addPlatform')), h('p.fine', t('addHint')),
      ui.platformPicker(sel, { max: 1, exclude: BS.S.platforms }),
      h('div.actions', go, ui.btn(t('cancel'), 'ghost', function () { dlg.close(); dlg.remove(); }))));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.showModal();
  }

  /* ---------- section layout: title column + content column ---------- */
  ui.sec = function (title, hint, body, extra) {
    return h('section.sec', h('div.sec-head', h('h2', title), hint ? h('p.hint', hint) : null, extra || null), h('div.sec-body', body));
  };
  ui.copyRow = function (text, note) {
    return h('button.copyrow', { type: 'button', title: t('clickCopy'), onclick: function () { BS.copy(text); } }, h('span.t', text), note ? h('span.n', note) : null, h('span.c', t('copy')));
  };

  /* ---------- account ---------- */
  function renderAccount(stage, pid) {
    var pd = BS.pd(pid), p = SPECS.platform(pid);
    if (!pd.profile) {
      stage.appendChild(emptyState(t('noProfile'), t('buildProfile'), function (btn) {
        return ui.run(btn, function () { return BS.api('profile', BS.ctx(pid)).then(function (r) { pd.profile = r; BS.save(); render(); }); });
      }));
      return;
    }
    var pr = pd.profile;
    stage.appendChild(h('header.view-head', h('h1.display', t('accountTitle', { p: BS.platName(pid) })), h('p.lead', t('accountLead'))));

    // names + handles
    stage.appendChild(ui.sec(t('secNames'), t('secNamesHint'),
      h('div.stack',
        h('div.list', pr.names.map(function (n) { return ui.copyRow(n); })),
        h('h3.mini', t('handles')),
        h('div.list', pr.handles.map(function (n) { return ui.copyRow('@' + n); })),
        h('p.fine', t('handleCheck')))));

    // bio variants (editable, with AI polish)
    var bioWrap = h('div.stack');
    pr.bio.forEach(function (b, i) {
      var ta = h('textarea.bio', { rows: 3, maxlength: p.bio, 'aria-label': t('bioN', { n: i + 1 }) }, b);
      var cnt = ui.counter(ta, p.bio);
      ta.addEventListener('input', function () { pr.bio[i] = ta.value; BS.save(); });
      ui.grow(ta);
      var polish = ui.btn(t('polish'), 'ghost small', function () {
        return ui.run(polish, function () {
          return BS.api('improve', Object.assign(BS.ctx(pid), { text: ta.value, action: 'custom', instruction: t('polishInstr'), max: p.bio })).then(function (r) {
            ta.value = r.text; pr.bio[i] = r.text; BS.save(); cnt.update(); ta.grow(); BS.toast(r.note || t('done'));
          });
        });
      });
      bioWrap.appendChild(h('div.bio-row', ta, h('div.row-tools', cnt, polish, ui.btn(t('copy'), 'ghost small', function () { BS.copy(ta.value); }))));
    });
    stage.appendChild(ui.sec(t('secBio'), t('secBioHint', { n: p.bio }), bioWrap));

    if (pr.tagline) stage.appendChild(ui.sec(t('secTagline'), t('secTaglineHint'), ui.copyRow(pr.tagline)));

    // link in bio
    if (pr.link_in_bio && pr.link_in_bio.items.length) {
      stage.appendChild(ui.sec(t('secLinks'), t('secLinksHint'), h('div.stack',
        pr.link_in_bio.title ? h('p.strong', pr.link_in_bio.title) : null,
        h('ol.linkbtns', pr.link_in_bio.items.map(function (x) { return h('li', x); })))));
    }

    // highlights / sections
    if (pr.sections.length) {
      stage.appendChild(ui.sec(t('secSections'), t('secSectionsHint'), h('dl.defs', pr.sections.map(function (s) { return [h('dt', s.title), h('dd', s.idea)]; }))));
    }

    // pinned
    if (pr.pinned.length) {
      stage.appendChild(ui.sec(t('secPinned'), t('secPinnedHint'), h('div.stack', pr.pinned.map(function (s) {
        var b = ui.btn(t('writeThis'), 'ghost small', function () { BS.newCustomPost(pid, s.title + (s.idea ? ': ' + s.idea : '')); });
        return h('div.pin', h('div', h('p.strong', s.title), h('p.hint', s.idea)), b);
      }))));
    }

    // avatar + banner
    var visuals = h('div.visuals');
    [['avatar', pr.avatar_prompt, [1, 1]], ['banner', pr.banner_prompt, [16, 9]]].forEach(function (v) {
      visuals.appendChild(visualBox(pid, pr, v[0], v[1], v[2]));
    });
    stage.appendChild(ui.sec(t('secVisuals'), t('secVisualsHint'), visuals));

    // first week
    if (pr.first_week.length) {
      var ul = h('ul.checks');
      pr.first_week.forEach(function (s, i) {
        var id = 'wk' + i, cb = h('input', { type: 'checkbox', id: id, checked: !!pd.checks[id], onchange: function () { pd.checks[id] = cb.checked; BS.save(); } });
        ul.appendChild(h('li', cb, h('label', { for: id }, s)));
      });
      stage.appendChild(ui.sec(t('secWeek'), pr.rhythm || '', ul));
    }

    stage.appendChild(h('div.view-foot', ui.btn(t('toPlan'), 'primary', function () { BS.S.view = 'plan'; BS.save(); render(); })));
  }

  function visualBox(pid, pr, slot, prompt, ratio) {
    var key = 'img:' + pid + ':' + slot;
    var ta = h('textarea', { rows: 3, maxlength: 400, 'aria-label': t('imgPrompt') }, prompt || '');
    ta.addEventListener('input', function () { pr[slot + '_prompt'] = ta.value; BS.save(); });
    var frame = h('div.imgframe.' + slot, h('span.ph', t('noImage')));
    var dl = ui.btn(t('download'), 'ghost small', null, { hidden: true });
    function show(src) {
      BS.clear(frame); frame.appendChild(h('img', { src: src, alt: t(slot === 'avatar' ? 'avatar' : 'banner') }));
      dl.hidden = false; dl.onclick = function () { BS.download('blogseem-' + pid + '-' + slot + '.jpg', BS.dataUrlToBlob(src)); };
    }
    BS.imgGet(key).then(function (v) { if (v) show(v); });
    var gen = ui.btn(t('makeImage'), 'primary small', function () {
      return ui.run(gen, function () {
        return BS.makeImage(ta.value, ratio).then(function (src) { return BS.imgSet(key, src).then(function () { show(src); }); });
      });
    });
    return h('div.visual', h('h3.mini', t(slot === 'avatar' ? 'avatar' : 'banner')), frame, ta, h('div.row-tools', gen, dl));
  }

  function emptyState(msg, label, onclick) {
    var b = ui.btn(label, 'primary', function () { onclick(b); });
    return h('div.empty', h('p', msg), b);
  }

  /* ---------- plan ---------- */
  function postState(pd, key) { var p = pd.posts[key]; return p ? p : null; }

  function renderPlan(stage, pid) {
    var pd = BS.pd(pid);
    if (!pd.plan) {
      stage.appendChild(emptyState(t('noPlan'), t('buildPlan'), function (btn) {
        return ui.run(btn, function () { return BS.api('plan', BS.ctx(pid)).then(function (r) { pd.plan = r.days; BS.save(); render(); }); });
      }));
      return;
    }
    var written = Object.keys(pd.posts).length;
    var bar = h('div.bar'), barFill = h('i'); bar.appendChild(barFill);
    var status = h('span.fine');
    var cancel = false;
    var writeBtn = ui.btn(t('writeAll'), 'primary', function () {
      var todo = pd.plan.filter(function (d) { return !pd.posts[String(d.day)]; });
      if (!todo.length) return BS.toast(t('allWritten'));
      cancel = false; bar.hidden = false; writeBtn.disabled = true; stopBtn.hidden = false;
      var done = 0, errs = 0, idx = 0;
      function next() {
        if (cancel || idx >= todo.length) return Promise.resolve();
        var d = todo[idx++];
        return BS.generatePost(pid, String(d.day), d).then(function () { done++; }, function (e) { errs++; if (e && (e.code === 'limit' || e.code === 'config' || e.code === 'auth')) { cancel = true; BS.toast(BS.errText(e), 'err'); } })
          .then(function () { barFill.style.width = Math.round((done + errs) / todo.length * 100) + '%'; status.textContent = t('writing', { a: done, b: todo.length }); markTile(String(d.day)); return next(); });
      }
      Promise.all([next(), next(), next()]).then(function () {
        writeBtn.disabled = false; stopBtn.hidden = true; bar.hidden = true; status.textContent = errs ? t('writeDoneErr', { n: errs }) : t('writeDone');
      });
    });
    var stopBtn = ui.btn(t('stop'), 'ghost', function () { cancel = true; }, { hidden: true });
    bar.hidden = true;

    var grid = h('div.grid', { role: 'list' });
    var tiles = {};
    function markTile(key) {
      var tile = tiles[key]; if (!tile) return;
      var p = postState(pd, key);
      tile.classList.toggle('done', !!p);
      var st = tile.querySelector('.st'); BS.clear(st);
      if (p) { st.appendChild(h('i.s.t', { title: t('stText') })); if (p.cover) st.appendChild(h('i.s.i', { title: t('stImage') })); if (p.video) st.appendChild(h('i.s.v', { title: t('stVideo') })); }
    }
    pd.plan.forEach(function (d) {
      var key = String(d.day);
      var tile = h('button.tile', { type: 'button', role: 'listitem', onclick: function () {
          if (pd.posts[key]) return BS.openEditor(pid, key);
          tile.classList.add('loading');
          BS.generatePost(pid, key, d).then(function () { markTile(key); BS.openEditor(pid, key); }, function (e) { BS.toast(BS.errText(e), 'err'); }).then(function () { tile.classList.remove('loading'); });
        } },
        h('span.day', String(d.day)),
        h('span.fmt', BS.fmtName(pid, d.format)),
        h('span.topic', d.topic),
        h('span.meta', h('span.time', d.time), h('span.st')));
      tiles[key] = tile; grid.appendChild(tile); markTile(key);
    });
    // custom posts
    Object.keys(pd.posts).filter(function (k) { return k.charAt(0) === 'c'; }).forEach(function (key) {
      var p = pd.posts[key];
      var tile = h('button.tile.custom', { type: 'button', role: 'listitem', onclick: function () { BS.openEditor(pid, key); } },
        h('span.day', '+'), h('span.fmt', BS.fmtName(pid, p.format)), h('span.topic', p.topic || p.title), h('span.meta', h('span.time', t('custom')), h('span.st')));
      tiles[key] = tile; grid.appendChild(tile); markTile(key);
    });
    var newBtn = ui.btn(t('newPost'), 'ghost', function () { BS.newCustomPost(pid, ''); });

    stage.appendChild(h('header.view-head', h('h1.display', t('planTitle', { p: BS.platName(pid) })), h('p.lead', t('planLead')),
      h('div.toolbar', writeBtn, stopBtn, newBtn, ui.btn(t('exportCsv'), 'ghost', function () { exportCsv(pid); }), ui.btn(t('exportIcs'), 'ghost', function () { exportIcs(pid); }), status), bar));
    stage.appendChild(grid);
    void written;
  }

  /* Used by plan and by "Write all". */
  BS.generatePost = function (pid, key, d) {
    var pd = BS.pd(pid);
    var body = Object.assign(BS.ctx(pid), { topic: d.topic, format: d.format, hook: d.hook, tone: BS.S.tone });
    return BS.api('post', body).then(function (r) {
      pd.posts[key] = { title: r.title, topic: d.topic, format: d.format, hook: d.hook, time: d.time, day: d.day, caption: r.caption, beats: r.beats, tags: r.tags, cta: r.cta, cover_text: r.cover_text, image_prompt: r.image_prompt, hist: [] };
      BS.save();
      return pd.posts[key];
    });
  };

  BS.newCustomPost = function (pid, topic, format) {
    var pd = BS.pd(pid), p = SPECS.platform(pid);
    var dlg = h('dialog.sheet');
    var tp = h('textarea', { rows: 3, maxlength: 200, placeholder: t('topicPh'), 'aria-label': t('topic') }, topic || '');
    var sel = h('select', { 'aria-label': t('format') }, p.formats.map(function (f) { return h('option', { value: f.id }, f[BS.lang()] || f.en); }));
    if (format && p.formats.some(function (f) { return f.id === format; })) sel.value = format;
    var go = ui.btn(t('writePost'), 'primary', function () {
      var v = tp.value.trim(); if (!v) return tp.focus();
      return ui.run(go, function () {
        pd.custom = (pd.custom || 0) + 1;
        var key = 'c' + pd.custom;
        return BS.generatePost(pid, key, { topic: v, format: sel.value, hook: '', time: '', day: key }).then(function () {
          dlg.close(); dlg.remove(); BS.S.view = 'plan'; render(); BS.openEditor(pid, key);
        }, function (e) { pd.custom--; throw e; });
      });
    });
    dlg.appendChild(h('div.sheet-in', h('h2', t('newPost')), h('label.fld', h('span.lbl', t('topic')), tp), h('label.fld', h('span.lbl', t('format')), sel),
      h('div.actions', go, ui.btn(t('cancel'), 'ghost', function () { dlg.close(); dlg.remove(); }))));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.showModal();
  };

  BS.saveAdaptation = function (pid, r) {
    var pd = BS.pd(pid); pd.custom = (pd.custom || 0) + 1; var key = 'c' + pd.custom;
    pd.posts[key] = { title: r.title, topic: r.title || t('repurposed'), format: r.format, hook: '', time: '', day: key, caption: r.caption, beats: r.beats, tags: r.tags, cta: r.cta, cover_text: r.cover_text, image_prompt: r.image_prompt, hist: [] };
    BS.save();
    return key;
  };

  // Voice dictation through the browser's own speech recognition (Chrome, Edge, Safari). Null when unsupported.
  ui.mic = function (ta) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var rec = null, on = false, base = '';
    var b = ui.btn(t('micStart'), 'ghost small', function () {
      if (on) { rec.stop(); return; }
      rec = new SR(); rec.lang = BS.lang() === 'ru' ? 'ru-RU' : 'en-US'; rec.continuous = true; rec.interimResults = true;
      base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
      var finalText = '';
      rec.onresult = function (e) {
        var interim = '';
        for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript; }
        ta.value = (base + finalText + interim).slice(0, ta.maxLength > 0 ? ta.maxLength : 6000); ta.dispatchEvent(new Event('input'));
      };
      rec.onerror = function (e) { BS.toast(t(e.error === 'not-allowed' ? 'micDenied' : 'micFail'), 'err'); };
      rec.onend = function () { on = false; b.textContent = t('micStart'); b.classList.remove('rec'); };
      try { rec.start(); on = true; b.textContent = t('micStop'); b.classList.add('rec'); } catch (e) { BS.toast(t('micFail'), 'err'); }
    });
    return b;
  };

  /* ---------- exports ---------- */
  function csvCell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function dateFor(day) { var d = new Date(); d.setDate(d.getDate() + Number(day)); return d; }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }

  function exportCsv(pid) {
    var pd = BS.pd(pid);
    var rows = [['day', 'date', 'time', 'format', 'topic', 'hook', 'text', 'hashtags']];
    pd.plan.forEach(function (d) {
      var p = pd.posts[String(d.day)], dt = dateFor(d.day);
      rows.push([d.day, dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'), d.time, d.format, d.topic, d.hook, p ? p.caption : '', p ? p.tags.map(function (x) { return '#' + x; }).join(' ') : '']);
    });
    BS.download('blogseem-' + pid + '-plan.csv', '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
  }

  function icsText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function exportIcs(pid) {
    var pd = BS.pd(pid), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BlogSeem//RU', 'CALSCALE:GREGORIAN'];
    pd.plan.forEach(function (d) {
      var dt = dateFor(d.day), hm = String(d.time || '19:00').split(':'), hh = String(hm[0]).padStart(2, '0'), mm = hm[1] || '00';
      L.push('BEGIN:VEVENT', 'UID:bs-' + pid + '-' + d.day + '@blogseem', 'DTSTAMP:' + ymd(new Date()) + 'T000000Z',
        'DTSTART:' + ymd(dt) + 'T' + hh + mm + '00', 'DURATION:PT30M',
        'SUMMARY:' + icsText(BS.platName(pid) + ': ' + d.topic), 'DESCRIPTION:' + icsText(d.hook),
        'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(d.topic), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    BS.download('blogseem-' + pid + '.ics', L.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  function exportAll() {
    var out = JSON.stringify({ app: 'BlogSeem', exported: new Date().toISOString(), project: BS.S }, null, 2);
    BS.download('blogseem-project.json', out, 'application/json');
  }

  /* ---------- repurpose: one material -> every platform ---------- */
  function renderRepurpose(stage) {
    var S = BS.S;
    var src = h('textarea#source', { rows: 9, maxlength: 6000, placeholder: t('sourcePh'), 'aria-label': t('sourceLabel') });
    var cnt = ui.counter(src, 6000);
    var mic = ui.mic(src);
    var done = [];
    var chosen = S.platforms.slice();
    var rows = h('div.rp-platforms');
    var fmtSel = {};
    S.platforms.forEach(function (pid) {
      var p = SPECS.platform(pid);
      var cb = h('input', { type: 'checkbox', id: 'rp-' + pid, checked: true, onchange: function () { var i = chosen.indexOf(pid); if (cb.checked && i < 0) chosen.push(pid); if (!cb.checked && i >= 0) chosen.splice(i, 1); } });
      var sel = h('select', { 'aria-label': t('format') + ' ' + BS.platName(pid) }, p.formats.map(function (f) { return h('option', { value: f.id }, f[BS.lang()] || f.en); }));
      fmtSel[pid] = sel;
      rows.appendChild(h('div.rp-row', { style: { '--c': p.color } }, cb, h('label', { for: 'rp-' + pid }, h('i.dot'), BS.platName(pid)), sel));
    });
    var results = h('div.rp-results');
    var go = ui.btn(t('adapt'), 'primary', function () {
      var text = src.value.trim();
      if (text.length < 20) { src.focus(); return BS.toast(t('errSource'), 'err'); }
      if (!chosen.length) return BS.toast(t('errPick'), 'err');
      return ui.run(go, function () {
        BS.clear(results);
        var jobs = chosen.map(function (pid) {
          var holder = h('article.rp-item.loading', h('h3', BS.platName(pid)), h('p.fine', t('adapting')));
          results.appendChild(holder);
          return BS.api('repurpose', Object.assign(BS.ctx(pid), { source: text, format: fmtSel[pid].value })).then(function (r) {
            holder.classList.remove('loading'); BS.clear(holder);
            done.push({ pid: pid, r: r });
            var save = ui.btn(t('saveToPlan'), 'primary small', function () {
              var key = BS.saveAdaptation(pid, r); S.cur = pid; S.view = 'plan'; render(); BS.openEditor(pid, key);
            });
            holder.appendChild(h('div.rp-head', h('h3', BS.platName(pid) + ' · ' + BS.fmtName(pid, r.format)), h('div.row-tools', ui.btn(t('copy'), 'ghost small', function () { BS.copy(r.caption); }), save)));
            holder.appendChild(h('p.rp-text', r.caption));
            if (r.beats.length) holder.appendChild(h('ol.rp-beats', r.beats.map(function (b) { return h('li', b.text); })));
          }).catch(function (e) { holder.classList.remove('loading'); BS.clear(holder); holder.appendChild(h('h3', BS.platName(pid))); holder.appendChild(h('p.err-text', BS.errText(e))); });
        });
        done.length = 0;
        return Promise.all(jobs).then(function () {
          if (done.length > 1) results.appendChild(ui.btn(t('saveAll'), 'primary', function () {
            done.forEach(function (d) { BS.saveAdaptation(d.pid, d.r); }); S.view = 'plan'; render(); BS.toast(t('savedAll', { n: done.length }));
          }));
        });
      });
    });
    stage.appendChild(h('header.view-head', h('h1.display', t('repTitle')), h('p.lead', t('repLead'))));
    stage.appendChild(ui.sec(t('repSource'), t('repSourceHint'), h('div.stack', src, h('div.row-tools', mic, cnt))));
    stage.appendChild(ui.sec(t('repWhere'), t('repWhereHint'), h('div.stack', rows, h('div.actions', go))));
    stage.appendChild(results);
  }
})();
