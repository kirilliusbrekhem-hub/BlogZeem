/* BlogSeem growth: Creator DNA and the 30-day challenge. Registered as BS.views.dna and BS.views.challenge. */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t;
  BS.views = BS.views || {};
  var ARC = ['teacher', 'storyteller', 'expert', 'entertainer', 'curator', 'builder', 'provocateur', 'friend'];

  function ui() { return BS.ui; }
  function head(title, lead) { return h('header.view-head', h('h1.display', title), lead ? h('p.lead', lead) : null); }
  function field(label, el) { return h('label.fld', h('span.lbl', label), el); }
  function list(items, tag) { return h(tag || 'ul.plain', items.map(function (x) { return h('li', x); })); }

  function cardFile(canvasFn, name) {
    var fam = 'Unbounded, "Arial Black", Arial, sans-serif';
    var load = document.fonts && document.fonts.load ? document.fonts.load('700 40px Unbounded').catch(function () { /* fallback */ }) : Promise.resolve();
    return Promise.all([load, BS.loadImage('icon.svg').catch(function () { return null; })]).then(function (res) {
      var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = '#F4F5FA'; x.fillRect(0, 0, W, H);
      if (res[1]) x.drawImage(res[1], 72, 64, 84, 84);
      x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.fillStyle = '#15131F'; x.font = '700 46px ' + fam; x.fillText('Blog', 176, 122);
      var bw = x.measureText('Blog').width; x.fillStyle = '#3B2CF0'; x.fillText('Seem', 176 + bw, 122);
      canvasFn(x, fam, W, H);
      return new Promise(function (ok) { c.toBlob(function (blob) { ok({ blob: blob, name: name }); }, 'image/png'); });
    });
  }
  function wrap(x, text, left, y, maxW, lh, maxLines) {
    var words = String(text).split(/\s+/), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(test).width > maxW && line) { x.fillText(line, left, y); y += lh; n++; line = words[i]; if (n >= maxLines) return y; }
      else line = test;
    }
    if (line) { x.fillText(line, left, y); y += lh; }
    return y;
  }
  function shareButtons(make, fileName) {
    var u = ui();
    var save = u.btn(t('xCard'), 'primary', function () {
      return u.run(save, function () { return make().then(function (f) { BS.download(fileName, f.blob); }); });
    });
    var share = u.btn(t('xShare'), 'ghost', function () {
      return u.run(share, function () {
        return make().then(function (f) {
          var file = new File([f.blob], fileName, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'BlogSeem' }).catch(function () { /* cancelled */ });
          BS.download(fileName, f.blob); BS.toast(t('xShareFallback'));
        });
      });
    });
    return h('div.row-tools', save, share);
  }

  /* ============================ Creator DNA ============================ */
  BS.views.dna = function (stage, pid) {
    var u = ui(), S = BS.S;
    S.dna = S.dna || {};
    var bio = h('textarea', { rows: 3, maxlength: 1200, placeholder: t('dnaBioPh'), 'aria-label': t('dnaBio') });
    var posts = h('textarea', { rows: 8, maxlength: 6000, placeholder: t('dnaPostsPh'), 'aria-label': t('dnaPosts') });
    var out = h('div.xr-out', { 'aria-live': 'polite' });
    var go = u.btn(t('dnaGo'), 'primary', function () {
      if ((String(S.brief || '') + bio.value + posts.value).trim().length < 30) return BS.toast(t('dnaErrInput'), 'err');
      return u.run(go, function () {
        return BS.api('dna', Object.assign(BS.ctx(pid), { bio: bio.value, posts: posts.value })).then(function (r) {
          S.dna[pid] = { r: r, at: Date.now() }; BS.save();
          if (BS.wallet) BS.wallet.earn('dna');
          BS.clear(out); show(out, r, pid); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });
    stage.appendChild(head(t('dnaTitle'), t('dnaLead')));
    stage.appendChild(u.sec(t('dnaInput'), t('dnaInputHint'), h('div.stack', field(t('dnaBio'), bio), field(t('dnaPosts'), posts), h('div.actions', go, h('span.fine', t('dnaFine'))))));
    stage.appendChild(out);
    if (S.dna[pid] && S.dna[pid].r) show(out, S.dna[pid].r, pid);
  };

  function show(out, r, pid) {
    var u = ui();
    out.appendChild(h('section.dna-hero',
      h('p.dna-kicker', t('dnaYou')),
      h('h2.display.dna-type', t('arc_' + r.archetype)),
      h('p.dna-tag', r.tagline),
      h('p.hint', t('arcd_' + r.archetype))));
    out.appendChild(u.sec(t('dnaStrengths'), '', list(r.strengths)));
    out.appendChild(u.sec(t('dnaFormats'), t('dnaFormatsHint'), h('p.chips.dna-chips', r.formats.map(function (f) { return h('span.chip', t('fmt_' + f)); }))));
    if (r.voice.length) out.appendChild(u.sec(t('dnaVoice'), '', h('p.chips.dna-chips', r.voice.map(function (v) { return h('span.chip', v); }))));
    if (r.blind_spot) out.appendChild(u.sec(t('dnaBlind'), '', h('p', r.blind_spot)));
    out.appendChild(u.sec(t('dnaGrowth'), t('dnaGrowthHint'), list(r.growth, 'ol.plain')));
    if (r.ideas.length) out.appendChild(u.sec(t('dnaIdeas'), '', h('div.stack', r.ideas.map(function (x) {
      return h('div.rw', h('p', x), u.btn(t('writeThis'), 'ghost small', function () { BS.newCustomPost(pid, x); }));
    }))));
    out.appendChild(h('div.view-foot', shareButtons(function () { return drawDna(r, pid); }, 'blogseem-dna.png')));
  }

  function drawDna(r, pid) {
    return cardFile(function (x, fam) {
      x.fillStyle = '#5C5A70'; x.font = '500 38px Arial, sans-serif'; x.fillText(t('dnaCardTop', { p: BS.platName(pid) }), 72, 250);
      x.fillStyle = '#15131F'; x.font = '700 92px ' + fam;
      var y = wrap(x, t('arc_' + r.archetype), 72, 420, 936, 110, 2);
      x.fillStyle = '#3B2CF0'; x.fillRect(72, y - 40, 160, 12);
      x.fillStyle = '#15131F'; x.font = '500 44px Arial, sans-serif';
      y = wrap(x, r.tagline, 72, y + 50, 936, 62, 3);
      x.fillStyle = '#5C5A70'; x.font = '700 30px Arial, sans-serif'; x.fillText(t('dnaStrengths'), 72, y + 60);
      x.fillStyle = '#15131F'; x.font = '400 36px Arial, sans-serif'; y += 112;
      r.strengths.slice(0, 3).forEach(function (s) { y = wrap(x, '• ' + s, 72, y, 936, 50, 2) + 14; });
      x.fillStyle = '#5C5A70'; x.font = '400 28px Arial, sans-serif'; x.fillText(t('dnaCardNote'), 72, 1290);
    }, 'blogseem-dna.png');
  }

  /* =========================== 30-day challenge =========================== */
  function runs(pub, total) {
    var best = 0, cur = 0, now = 0;
    for (var d = 1; d <= total; d++) { if (pub[d]) { cur++; if (cur > best) best = cur; } else cur = 0; }
    var last = 0; for (d = total; d >= 1; d--) { if (pub[d]) { last = d; break; } }
    for (d = last; d >= 1 && pub[d]; d--) now++;
    return { best: best, now: now };
  }

  BS.views.challenge = function (stage, pid) {
    var u = ui(), pd = BS.pd(pid);
    pd.pub = pd.pub || {};
    stage.appendChild(head(t('chTitle'), t('chLead')));
    if (!pd.plan || !pd.plan.length) {
      stage.appendChild(h('div.empty', h('p', t('noPlan')), u.btn(t('buildPlan'), 'primary', function () { BS.S.view = 'plan'; BS.save(); BS.render ? BS.render() : location.reload(); })));
      return;
    }
    var total = pd.plan.length;
    var stats = h('div.ch-stats'), grid = h('div.grid.ch-grid', { role: 'list' });
    var tiles = {};
    function refresh() {
      var n = Object.keys(pd.pub).length, rr = runs(pd.pub, total);
      BS.clear(stats);
      stats.appendChild(h('div.ch-stat', h('b', n + '/' + total), h('span', t('chDone'))));
      stats.appendChild(h('div.ch-stat', h('b', String(rr.now)), h('span', t('chStreak'))));
      stats.appendChild(h('div.ch-stat', h('b', String(rr.best)), h('span', t('chBest'))));
      pd.plan.forEach(function (d) { var tile = tiles[d.day]; if (tile) { tile.classList.toggle('done', !!pd.pub[d.day]); tile.setAttribute('aria-pressed', pd.pub[d.day] ? 'true' : 'false'); tile.querySelector('.time').textContent = pd.pub[d.day] ? t('chPublished') : t('chMark'); } });
    }
    pd.plan.forEach(function (d) {
      var tile = h('button.tile', { type: 'button', role: 'listitem', 'aria-pressed': 'false', onclick: function () {
        if (pd.pub[d.day]) { delete pd.pub[d.day]; }
        else { pd.pub[d.day] = Date.now(); if (BS.wallet) BS.wallet.earn('chday', pid, d.day); }
        BS.save(); refresh();
      } }, h('span.day', String(d.day)), h('span.fmt', BS.fmtName(pid, d.format)), h('span.topic', d.topic), h('span.meta', h('span.time', pd.pub[d.day] ? t('chPublished') : t('chMark'))));
      tiles[d.day] = tile; grid.appendChild(tile);
    });
    stage.appendChild(stats);
    stage.appendChild(u.sec(t('chDays'), t('chDaysHint'), grid));
    stage.appendChild(h('div.view-foot', shareButtons(function () { return drawChallenge(pd, pid, total); }, 'blogseem-challenge.png')));
    refresh();
  };

  function drawChallenge(pd, pid, total) {
    var rr = runs(pd.pub, total), n = Object.keys(pd.pub).length;
    return cardFile(function (x, fam) {
      x.fillStyle = '#5C5A70'; x.font = '500 38px Arial, sans-serif'; x.fillText(t('chCardTop', { p: BS.platName(pid) }), 72, 250);
      var big = n + '/' + total;
      x.fillStyle = '#15131F'; x.font = '700 220px ' + fam; x.fillText(big, 72, 520);
      x.fillStyle = '#5C5A70'; x.font = '500 40px Arial, sans-serif'; x.fillText(t('chCardPosts'), 72, 585);
      var cols = 10, size = 78, gap = 14, left = 72, top = 650;
      for (var d = 1; d <= total; d++) {
        var i = d - 1, cx = left + (i % cols) * (size + gap), cy = top + Math.floor(i / cols) * (size + gap);
        x.fillStyle = pd.pub[d] ? '#3B2CF0' : '#DDDFEE';
        x.beginPath(); if (x.roundRect) x.roundRect(cx, cy, size, size, 18); else x.rect(cx, cy, size, size); x.fill();
      }
      x.fillStyle = '#15131F'; x.font = '700 44px Arial, sans-serif';
      x.fillText(t('chCardStreak', { n: rr.now }), 72, top + 3 * (size + gap) + 70);
      x.fillStyle = '#5C5A70'; x.font = '400 28px Arial, sans-serif'; x.fillText(t('chCardNote'), 72, 1290);
    }, 'blogseem-challenge.png');
  }
})();
