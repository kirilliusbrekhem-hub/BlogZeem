/* BlogZeem tools: X-Ray audit, Trend Radar, Content Lab, Digital Twin (memory). Registered as BS.views.* */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t, ui = BS.ui;
  BS.views = BS.views || {};
  BS.hookStyles = ['curiosity', 'number', 'contrarian', 'story', 'question', 'promise'];

  function head(title, lead) { return h('header.view-head', h('h1.display', title), lead ? h('p.lead', lead) : null); }
  function field(label, el) { return h('label.fld', h('span.lbl', label), el); }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString(BS.lang() === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' }) : ''; } catch (e) { return ''; } }
  var CRIT = ['niche', 'profile', 'hooks', 'value', 'voice', 'cta', 'rhythm'];

  /* =============================== X-Ray =============================== */
  BS.views.xray = function (stage, pid) {
    var S = BS.S;
    var link = h('input', { type: 'text', maxlength: 200, placeholder: t('xLinkPh'), 'aria-label': t('xLink') });
    var bio = h('textarea', { rows: 4, maxlength: 1500, placeholder: t('xBioPh'), 'aria-label': t('xBio') });
    var posts = h('textarea', { rows: 9, maxlength: 7000, placeholder: t('xPostsPh'), 'aria-label': t('xPosts') });
    var out = h('div.xr-out', { 'aria-live': 'polite' });
    var go = ui.btn(t('xGo'), 'primary', function () {
      var hasTg = /(?:t\.me|telegram\.me)\//i.test(link.value);
      if (!hasTg && (bio.value + posts.value).trim().length < 200) { return BS.toast(t('xErrInput'), 'err'); }
      return ui.run(go, function () {
        var prev = (S.audits || []).filter(function (a) { return a.pid === pid; }).slice(-1)[0];
        return BS.api('audit', Object.assign(BS.ctx(pid), { voice: '', link: link.value.trim(), bio: bio.value, posts: posts.value })).then(function (r) {
          S.audits = (S.audits || []).concat({ pid: pid, score: r.score, at: Date.now() }).slice(-30); BS.save();
          BS.clear(out); renderResult(out, r, pid, prev);
          out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });
    stage.appendChild(head(t('xTitle'), t('xLead')));
    stage.appendChild(ui.sec(t('xInput'), t('xInputHint'), h('div.stack', field(t('xLink'), link), h('p.fine', t('xLinkHint')), field(t('xBio'), bio), field(t('xPosts'), posts), h('div.actions', go, h('span.fine', t('xFine'))))));
    stage.appendChild(out);
  };

  function renderResult(out, r, pid, prev) {
    var delta = prev ? r.score - prev.score : null;
    out.appendChild(h('section.xr-score',
      h('div.xr-num', h('span.n', String(r.score)), h('span.of', '/ 100')),
      h('div', h('h2', t('xScoreTitle', { p: BS.platName(pid) })),
        delta == null ? null : h('p.xr-delta', t(delta >= 0 ? 'xUp' : 'xDown', { a: prev.score, b: Math.abs(delta) })),
        h('p.hint', t('xNote')),
        r.fetched ? h('p.fine', t('xFetched', { title: r.fetched.title || 'Telegram', n: r.fetched.posts })) : null)));
    var rows = h('ul.crit');
    r.criteria.forEach(function (c) {
      rows.appendChild(h('li.crit-row',
        h('div.crit-top', h('span.crit-name', t('crit_' + c.id)), h('span.crit-w', t('xWeight', { n: c.weight })), h('b', c.score + '/10')),
        h('div.meter', { role: 'img', 'aria-label': c.score + '/10' }, h('i', { style: { width: c.score * 10 + '%' } })),
        c.evidence ? h('blockquote', c.evidence) : null,
        c.fix ? h('p.crit-fix', c.fix) : null));
    });
    out.appendChild(ui.sec(t('xCriteria'), t('xCriteriaHint'), rows));
    if (r.strengths.length) out.appendChild(ui.sec(t('xStrengths'), '', h('ul.plain', r.strengths.map(function (x) { return h('li', x); }))));
    if (r.top_fixes.length) out.appendChild(ui.sec(t('xFixes'), t('xFixesHint'), h('ol.plain', r.top_fixes.map(function (x) { return h('li', x); }))));
    if (r.week.length) out.appendChild(ui.sec(t('xWeek'), t('xWeekHint'), h('ol.plain', r.week.map(function (x) { return h('li', x); }))));
    if (r.improved_bio) out.appendChild(ui.sec(t('xBetterBio'), '', ui.copyRow(r.improved_bio)));
    if (r.rewrites.length) {
      out.appendChild(ui.sec(t('xRewrites'), t('xRewritesHint'), h('div.stack', r.rewrites.map(function (w) {
        return h('div.rw', h('p.rw-old', w.quote), w.problem ? h('p.hint', w.problem) : null, ui.copyRow(w.better));
      }))));
    }
    var cardBtn = ui.btn(t('xCard'), 'primary', function () {
      return ui.run(cardBtn, function () { return drawCard(r, pid).then(function (blob) { BS.download('blogzeem-xray-' + pid + '.png', blob); }); });
    });
    var shareBtn = ui.btn(t('xShare'), 'ghost', function () {
      return ui.run(shareBtn, function () {
        return drawCard(r, pid).then(function (blob) {
          var file = new File([blob], 'blogzeem-xray.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'BlogZeem' }).catch(function () { /* cancelled */ });
          BS.download('blogzeem-xray-' + pid + '.png', blob); BS.toast(t('xShareFallback'));
        });
      });
    });
    out.appendChild(h('div.view-foot', h('div.row-tools', cardBtn, shareBtn)));
  }

  function drawCard(r, pid) {
    var fam = 'Unbounded, "Arial Black", Arial, sans-serif';
    var load = document.fonts && document.fonts.load ? document.fonts.load('700 40px Unbounded').catch(function () { /* fallback font */ }) : Promise.resolve();
    return Promise.all([load, BS.loadImage('icon.svg').catch(function () { return null; })]).then(function (res) {
      var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = '#F4F5FA'; x.fillRect(0, 0, W, H);
      if (res[1]) x.drawImage(res[1], 72, 64, 84, 84);
      x.fillStyle = '#15131F'; x.font = '700 46px ' + fam; x.textBaseline = 'alphabetic';
      x.fillText('Blog', 176, 122); var bw = x.measureText('Blog').width; x.fillStyle = '#3B2CF0'; x.fillText('Zeem', 176 + bw, 122);
      x.fillStyle = '#5C5A70'; x.font = '500 38px Arial, sans-serif';
      x.fillText(t('xCardTitle', { p: BS.platName(pid) }), 72, 250);
      var big = String(r.score);
      x.font = '700 400px ' + fam; var nw = x.measureText(big).width;
      x.fillStyle = '#F6E94B'; x.fillRect(56, 560, nw + 40, 150);
      x.fillStyle = '#15131F'; x.fillText(big, 72, 730);
      x.fillStyle = '#5C5A70'; x.font = '700 84px ' + fam; x.fillText('/100', 72 + nw + 24, 730);
      var y = 820;
      r.criteria.forEach(function (cr) {
        x.fillStyle = '#15131F'; x.font = '500 34px Arial, sans-serif'; x.textAlign = 'left'; x.fillText(t('crit_' + cr.id), 72, y + 8);
        x.fillStyle = '#DDDFEE'; x.fillRect(560, y - 18, 380, 24);
        x.fillStyle = '#3B2CF0'; x.fillRect(560, y - 18, 38 * cr.score, 24);
        x.fillStyle = '#15131F'; x.font = '700 32px Arial, sans-serif'; x.textAlign = 'right'; x.fillText(cr.score + '/10', 1008, y + 8);
        y += 66;
      });
      x.textAlign = 'left'; x.fillStyle = '#5C5A70'; x.font = '400 28px Arial, sans-serif';
      x.fillText(t('xCardNote'), 72, 1290);
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    });
  }

  /* ============================ Trend Radar ============================ */
  BS.views.trends = function (stage, pid) {
    var q = h('input', { type: 'text', maxlength: 80, placeholder: t('trQueryPh'), 'aria-label': t('trQuery') });
    var out = h('div.tr-out', { 'aria-live': 'polite' });
    var go = ui.btn(t('trGo'), 'primary', function () {
      return ui.run(go, function () {
        BS.clear(out);
        return BS.api('trends', Object.assign(BS.ctx(pid), { query: q.value.trim() })).then(function (r) {
          out.appendChild(h('p.fine', t('trSrc', { n: r.checked, q: r.queries.join(', ') })));
          r.ideas.forEach(function (it) {
            var s = it.source;
            out.appendChild(h('article.tr-item',
              h('a.tr-head', { href: s.link, target: '_blank', rel: 'noopener noreferrer' }, s.title),
              h('p.fine', [s.source, fmtDate(s.date)].filter(Boolean).join(' · ')),
              h('p.tr-why', it.why),
              h('ul.tr-angles', it.angles.map(function (a) {
                return h('li', h('span', a), ui.btn(t('trWrite'), 'ghost small', function () { BS.newCustomPost(pid, a, it.format); }));
              })),
              it.hook ? h('p.fine', t('trHook', { h: it.hook })) : null));
          });
        });
      });
    });
    stage.appendChild(head(t('trTitle'), t('trLead')));
    stage.appendChild(ui.sec(t('trFind'), t('trFindHint'), h('div.stack', field(t('trQuery'), q), h('div.actions', go, h('span.fine', t('trFine'))))));
    stage.appendChild(out);
  };

  /* ============================ Content Lab ============================ */
  BS.views.lab = function (stage) {
    var S = BS.S, st = BS.labStats();
    stage.appendChild(head(t('labTitle'), t('labLead')));
    if (!st.total) { stage.appendChild(h('div.empty', h('p', t('labEmpty')), ui.btn(t('toPlan'), 'primary', function () { S.view = 'plan'; BS.save(); BS.renderStudio(); }))); return; }
    var max = Math.max.apply(null, st.rows.map(function (r) { return r.er; })) || 1;
    var table = h('ul.lab-rows');
    st.rows.forEach(function (r) {
      table.appendChild(h('li.lab-row',
        h('span.lab-name', t(r.style === 'none' ? 'hs_none' : 'hs_' + r.style)),
        h('div.meter', { role: 'img', 'aria-label': r.er.toFixed(1) + '%' }, h('i', { style: { width: Math.max(3, r.er / max * 100) + '%' } })),
        h('span.lab-er', r.er.toFixed(1) + '%'),
        h('span.fine', t('labN', { n: r.n }) + (r.n < 3 ? ' · ' + t('labFewShort') : ''))));
    });
    var ins = BS.hookInsight();
    var toggle = h('input', { type: 'checkbox', id: 'useins', checked: S.useInsights !== false, onchange: function () { S.useInsights = toggle.checked; BS.save(); } });
    stage.appendChild(ui.sec(t('labByStyle'), t('labByStyleHint'), h('div.stack', table,
      h('p.lab-insight', ins ? t('labBest', { s: t('hs_' + ins.style), a: ins.er.toFixed(1), b: ins.avg.toFixed(1), n: ins.n }) : t('labFew')),
      h('label.check', toggle, t('labUse')))));
    var list = h('ul.lab-posts');
    st.list.sort(function (a, b) { return (b.r.at || 0) - (a.r.at || 0); }).forEach(function (x) {
      list.appendChild(h('li', h('div', h('p.strong', x.post.title || x.post.topic), h('p.fine', BS.platName(x.pid) + ' · ' + t('labMetrics', { v: x.r.views, l: x.r.likes, c: x.r.comments, s: x.r.saves }) + ' · ' + x.er.toFixed(1) + '%')),
        ui.btn(t('open'), 'ghost small', function () { BS.S.cur = x.pid; BS.openEditor(x.pid, x.key); })));
    });
    stage.appendChild(ui.sec(t('labPosts'), t('labPostsHint'), list));
  };

  /* ====================== Digital Twin (memory) ====================== */
  BS.views.memory = function (stage) {
    var S = BS.S; S.twin = S.twin || {};
    var tw = S.twin;
    var sample = h('textarea', { rows: 8, maxlength: 6000, placeholder: t('samplePh'), 'aria-label': t('sampleLabel') });
    var fields = h('div.stack');
    var preview = h('pre.mem-preview');
    function upd() { preview.textContent = BS.voiceText() || t('memNothing'); }
    function inp(key, label, max) {
      var i = h('input', { type: 'text', maxlength: max || 140, value: tw[key] || '', 'aria-label': label });
      i.addEventListener('input', function () { tw[key] = i.value; BS.save(); upd(); });
      return field(label, i);
    }
    function drawFields() {
      BS.clear(fields);
      [['humor', 'twHumor'], ['sentences', 'twSentences'], ['address', 'twAddress'], ['emoji', 'twEmoji'], ['formats', 'twFormats']].forEach(function (f) { fields.appendChild(inp(f[0], t(f[1]), 140)); });
      fields.appendChild(inp('vocabulary', t('twVocab'), 200)); fields.appendChild(inp('phrases', t('twPhrases'), 300)); fields.appendChild(inp('avoid', t('twAvoid'), 200));
    }
    var learn = ui.btn(t('learnStyle'), 'primary', function () {
      if (sample.value.trim().length < 80) { sample.focus(); return BS.toast(t('errSample'), 'err'); }
      return ui.run(learn, function () {
        return BS.api('voice', { sample: sample.value, lang: /[Ѐ-ӿ]/.test(sample.value) ? 'ru' : 'en' }).then(function (r) {
          ['humor', 'sentences', 'address', 'emoji', 'formats'].forEach(function (k) { if (r[k]) tw[k] = r[k]; });
          if (r.vocabulary.length) tw.vocabulary = r.vocabulary.join(', ');
          if (r.phrases.length) tw.phrases = r.phrases.join(' | ');
          if (r.avoid.length) tw.avoid = r.avoid.join(', ');
          BS.save(); drawFields(); upd(); BS.toast(t('styleLearned'));
        });
      });
    });
    var rules = h('textarea#voice', { rows: 4, maxlength: 600, placeholder: t('voicePh'), 'aria-label': t('voiceLabel') }, S.voice || '');
    var cnt = ui.counter(rules, 600);
    rules.addEventListener('input', function () { S.voice = rules.value; BS.save(); upd(); });
    function memList(key) {
      var ul = h('ul.mem-list');
      (tw[key] || []).forEach(function (txt, i) {
        ul.appendChild(h('li', h('span', txt), ui.btn(t('remove'), 'ghost small', function () { tw[key].splice(i, 1); BS.save(); BS.renderStudio(); })));
      });
      return (tw[key] || []).length ? ul : h('p.fine', t('memEmptyList'));
    }
    var tone = h('select#tone', { 'aria-label': t('toneLabel'), onchange: function () { S.tone = tone.value; BS.save(); } },
      ['plain', 'playful', 'expert', 'bold'].map(function (k) { return h('option', { value: k, selected: S.tone === k }, t('tone_' + k)); }));
    drawFields(); upd();
    stage.appendChild(head(t('memTitle'), t('memLead')));
    stage.appendChild(ui.sec(t('memLearn'), t('memLearnHint'), h('div.stack', sample, h('div.actions', learn))));
    stage.appendChild(ui.sec(t('twProfile'), t('twProfileHint'), fields));
    stage.appendChild(ui.sec(t('memRules'), t('memRulesHint'), h('div.stack', rules, h('div.row-tools', cnt))));
    stage.appendChild(ui.sec(t('twApproved'), t('twApprovedHint'), memList('examples')));
    stage.appendChild(ui.sec(t('twRejected'), t('twRejectedHint'), memList('dislikes')));
    stage.appendChild(ui.sec(t('memTone'), t('memToneHint'), tone));
    stage.appendChild(ui.sec(t('twSent'), t('twSentHint'), preview));
  };
})();
