/* BlogSeem post editor: text, AI edit tools, cover image, scenes, video and slides. */
(function () {
  'use strict';
  var BS = window.BS, h = BS.h, t = BS.t, ui = BS.ui, SPECS = window.BS_SPECS;
  var panel = null, cur = null, lastFocus = null, videoUrl = null;

  function el() { return panel || (panel = document.getElementById('editor')); }

  BS.openEditor = function (pid, key) {
    if (!BS.pd(pid).posts[key]) return;
    cur = { pid: pid, key: key };
    lastFocus = document.activeElement;
    draw();
    el().hidden = false;
    document.body.classList.add('locked');
    var c = el().querySelector('.ed-close'); if (c) c.focus();
  };

  function close() {
    el().hidden = true; BS.clear(el());
    document.body.classList.remove('locked');
    if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = null; }
    var y = window.scrollY;
    if (['plan', 'lab', 'memory'].indexOf(BS.S.view) >= 0) { BS.renderStudio(); window.scrollTo(0, y); }
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
    cur = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur && !document.querySelector('dialog[open]')) close(); });

  function imgKey(slot) { return 'img:' + cur.pid + ':' + cur.key + ':' + slot; }

  function draw() {
    var pid = cur.pid, key = cur.key, pd = BS.pd(pid), post = pd.posts[key], p = SPECS.platform(pid);
    var kind = SPECS.format(pid, post.format).kind;
    post.hist = post.hist || [];
    var root = BS.clear(el());

    /* ----- header ----- */
    var title = key.charAt(0) === 'c' ? t('edCustom') : t('edDay', { n: post.day });
    var head = h('header.ed-head',
      h('div', h('h2', post.title || post.topic), h('p.meta', title + ' · ' + BS.platName(pid) + ' · ' + BS.fmtName(pid, post.format) + (post.time ? ' · ' + post.time : ''))),
      h('button.ed-close', { type: 'button', 'aria-label': t('close'), onclick: close }, '×'));

    /* ----- preview (right column) ----- */
    var pvMedia = h('div.pv-media'), pvCap = h('p.pv-cap'), pvTags = h('p.pv-tags');
    var pvCover = null;
    function preview() {
      BS.clear(pvMedia);
      if (pvCover) pvMedia.appendChild(h('img', { src: pvCover, alt: '' }));
      else pvMedia.appendChild(h('span.pv-ph', post.cover_text || post.title || ''));
      if (kind === 'video') pvMedia.appendChild(h('i.pv-play'));
      var c = post.caption || '';
      pvCap.textContent = c.length > 260 ? c.slice(0, 260) + '… ' + t('more') : c;
      pvTags.textContent = (post.tags || []).map(function (x) { return '#' + x; }).join(' ');
      var r = p.ratio; pvMedia.style.aspectRatio = (kind === 'text' && !pvCover) ? '' : r[0] + ' / ' + r[1];
      pvMedia.classList.toggle('hide', kind === 'text' && !pvCover);
    }
    var phone = h('div.phone', { 'aria-label': t('preview') },
      h('div.pv-top', h('i.dot', { style: { background: p.color } }), h('span', BS.platName(pid))), pvMedia, pvCap, pvTags);
    BS.imgGet(imgKey('cover')).then(function (v) { if (v) { pvCover = v; preview(); coverShow(v); } });

    /* ----- text ----- */
    var cap = h('textarea.cap', { rows: 8, maxlength: 20000, 'aria-label': t('secText') }, post.caption || '');
    var cnt = ui.counter(cap, p.limit);
    cap.addEventListener('input', function () { post.caption = cap.value; BS.save(); preview(); });
    ui.grow(cap);
    var tagsIn = h('input.tags', { type: 'text', value: (post.tags || []).map(function (x) { return '#' + x; }).join(' '), 'aria-label': t('tags'), placeholder: '#tag #tag' });
    tagsIn.addEventListener('input', function () {
      post.tags = tagsIn.value.split(/[\s,]+/).map(function (x) { return x.replace(/^#/, ''); }).filter(Boolean).slice(0, 30); BS.save(); preview();
    });
    var undo = ui.btn(t('undo'), 'ghost small', function () {
      var prev = post.hist.pop(); if (prev == null) return;
      cap.value = prev; post.caption = prev; BS.save(); cnt.update(); cap.grow(); preview(); undo.hidden = !post.hist.length;
    }, { hidden: !post.hist.length });
    var note = h('p.note', { 'aria-live': 'polite' });
    var regen = ui.btn(t('regen'), 'ghost small', function () {
      if (!confirm(t('regenConfirm'))) return;
      return ui.run(regen, function () {
        var oldHist = post.hist.concat(post.caption), cover = post.cover;
        return BS.generatePost(pid, key, { topic: post.topic, format: post.format, hook: post.hook, time: post.time, day: post.day }).then(function (np) {
          np.hist = oldHist.slice(-20); np.cover = cover; BS.save(); draw();
        });
      });
    });
    var copyAll = ui.btn(t('copyAll'), 'ghost small', function () {
      var tg = (post.tags || []).map(function (x) { return '#' + x; }).join(' ');
      BS.copy(post.caption + (tg ? '\n\n' + tg : ''));
    });

    /* ----- AI edit bar ----- */
    function improve(btn, payload) {
      var s = cap.selectionStart, e = cap.selectionEnd, sel = e > s;
      var part = sel ? cap.value.slice(s, e) : cap.value;
      if (part.trim().length < 2) { BS.toast(t('nothingToEdit'), 'err'); return null; }
      return ui.run(btn, function () {
        return BS.api('improve', Object.assign(BS.ctx(pid), payload, { text: part, max: sel ? 5000 : p.limit })).then(function (r) {
          post.hist.push(cap.value); if (post.hist.length > 20) post.hist.shift();
          cap.value = sel ? cap.value.slice(0, s) + r.text + cap.value.slice(e) : r.text;
          post.caption = cap.value; BS.save(); cnt.update(); cap.grow(); preview();
          undo.hidden = false; note.textContent = (sel ? t('partDone') + ' ' : '') + (r.note || t('done'));
        });
      });
    }
    var AI = [['hook', 'aiHook'], ['shorter', 'aiShorter'], ['punchier', 'aiPunchier'], ['simpler', 'aiSimpler'], ['longer', 'aiLonger'], ['cta', 'aiCta'], ['fix', 'aiFix'], ['emoji', 'aiEmoji'], ['noemoji', 'aiNoEmoji']];
    var bar = h('div.aibar', { role: 'group', 'aria-label': t('aiTools') });
    AI.forEach(function (a) { var b = ui.btn(t(a[1]), 'chipbtn', function () { return improve(b, { action: a[0] }); }); bar.appendChild(b); });
    var toneSel = h('select.mini-sel', { 'aria-label': t('aiTone') }, h('option', { value: '' }, t('aiTone')),
      ['plain', 'playful', 'expert', 'bold'].map(function (k) { return h('option', { value: k }, t('tone_' + k)); }));
    toneSel.addEventListener('change', function () { if (!toneSel.value) return; var v = toneSel.value; toneSel.value = ''; improve(toneSel, { action: 'tone', tone: v }); });
    var LANGS = [['en', 'English'], ['ru', 'Русский'], ['es', 'Español'], ['de', 'Deutsch'], ['fr', 'Français'], ['pt', 'Português'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['zh', '中文'], ['ja', '日本語']];
    var trSel = h('select.mini-sel', { 'aria-label': t('aiTranslate') }, h('option', { value: '' }, t('aiTranslate')), LANGS.map(function (l) { return h('option', { value: l[0] }, l[1]); }));
    trSel.addEventListener('change', function () { if (!trSel.value) return; var v = trSel.value; trSel.value = ''; improve(trSel, { action: 'translate', to: v }); });
    bar.appendChild(toneSel); bar.appendChild(trSel);
    var custom = h('input.custom', { type: 'text', maxlength: 300, placeholder: t('aiCustomPh'), 'aria-label': t('aiCustom') });
    var customGo = ui.btn(t('apply'), 'primary small', function () { if (!custom.value.trim()) return custom.focus(); return improve(customGo, { action: 'custom', instruction: custom.value.trim() }); });
    custom.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); customGo.click(); } });

    function setCaption(v, msg) {
      post.hist.push(cap.value); if (post.hist.length > 20) post.hist.shift();
      cap.value = v; post.caption = v; BS.save(); cnt.update(); cap.grow(); preview();
      undo.hidden = false; note.textContent = msg || '';
    }
    var fb = h('div.row-tools.fb', h('span.fine', t('fbAsk')),
      ui.btn(t('fbYes'), 'ghost small', function () {
        var tw = BS.S.twin = BS.S.twin || {}; tw.examples = tw.examples || [];
        var ex = (post.caption || '').slice(0, 280);
        if (ex && tw.examples.indexOf(ex) < 0) tw.examples = tw.examples.concat(ex).slice(-3);
        BS.save(); BS.toast(t('fbSaved'));
      }),
      ui.btn(t('fbNo'), 'ghost small', function () {
        var why = window.prompt(t('fbWhy'));
        if (!why || !why.trim()) return BS.toast(t('fbNoNote'));
        var tw = BS.S.twin = BS.S.twin || {}; tw.dislikes = (tw.dislikes || []).concat(why.trim().slice(0, 120)).slice(-4);
        BS.save(); BS.toast(t('fbSaved'));
      }));
    var labSec = buildLab(pid, key, post, setCaption);
    var textSec = h('section.ed-sec',
      h('div.ed-sec-head', h('h3', t('secText')), h('div.row-tools', cnt, undo, copyAll, regen)),
      cap, fb, h('label.fld.inline', h('span.lbl', t('tags')), tagsIn),
      h('div.ai', h('div.ai-head', h('h4', t('aiTools')), h('p.fine', t('selHint'))), bar, h('div.custom-row', custom, customGo), note));

    /* ----- cover ----- */
    var coverFrame = h('div.imgframe.cover', { style: { aspectRatio: p.ratio[0] + ' / ' + p.ratio[1] } }, h('span.ph', t('noImage')));
    var coverDl = ui.btn(t('download'), 'ghost small', null, { hidden: true });
    function coverShow(src) {
      BS.clear(coverFrame); coverFrame.appendChild(h('img', { src: src, alt: t('cover') }));
      coverDl.hidden = false; coverDl.onclick = function () { BS.download('blogseem-' + pid + '-' + key + '.jpg', BS.dataUrlToBlob(src)); };
    }
    var imgPrompt = h('textarea', { rows: 3, maxlength: 500, 'aria-label': t('imgPrompt') }, post.image_prompt || '');
    imgPrompt.addEventListener('input', function () { post.image_prompt = imgPrompt.value; BS.save(); });
    var genCover = ui.btn(t('makeImage'), 'primary small', function () {
      return ui.run(genCover, function () {
        return BS.makeImage(imgPrompt.value, p.ratio).then(function (src) {
          return BS.imgSet(imgKey('cover'), src).then(function () { post.cover = true; pvCover = src; BS.save(); coverShow(src); preview(); });
        });
      });
    });
    var coverSec = h('section.ed-sec',
      h('div.ed-sec-head', h('h3', t('secCover')), h('p.hint', t('secCoverHint'))),
      h('div.cover-grid', coverFrame, h('div.stack', h('label.fld', h('span.lbl', t('imgPrompt')), imgPrompt), h('div.row-tools', genCover, coverDl))));

    /* ----- scenes ----- */
    var sceneSec = null, outSec = null;
    if (kind === 'video' || kind === 'carousel' || kind === 'thread') {
      sceneSec = buildScenes(pid, key, post, kind, p, cap);
      outSec = kind === 'video' ? buildVideo(pid, key, post, p) : kind === 'carousel' ? buildSlides(pid, key, post, p) : buildThread(post);
    }

    root.appendChild(head);
    root.appendChild(h('div.ed-body', h('div.ed-main', textSec, labSec, coverSec, sceneSec, outSec), h('aside.ed-side', phone, h('p.fine', t('previewNote')))));
    preview();
  }

  /* ---------- scenes ---------- */
  function buildScenes(pid, key, post, kind, p) {
    var list = h('ol.scenes');
    var thread = kind === 'thread';
    function row(b, i) {
      var txt = h('textarea', { rows: thread ? 3 : 2, maxlength: thread ? 500 : 120, 'aria-label': t(thread ? 'threadPost' : 'sceneText') }, b.text);
      txt.addEventListener('input', function () { b.text = txt.value; BS.save(); });
      ui.grow(txt);
      var tools = h('div.row-tools');
      var pol = ui.btn(t('aiPunchier'), 'ghost small', function () {
        return ui.run(pol, function () {
          return BS.api('improve', Object.assign(BS.ctx(pid), { text: txt.value, action: 'punchier', max: thread ? 500 : 120 })).then(function (r) { txt.value = r.text; b.text = r.text; BS.save(); txt.grow(); });
        });
      });
      tools.appendChild(pol);
      tools.appendChild(ui.btn(t('remove'), 'ghost small', function () { post.beats.splice(i, 1); BS.save(); redraw(); }));
      var body = h('div.scene-body', h('label.fld', h('span.lbl', t(thread ? 'threadPost' : 'sceneText')), txt));
      if (!thread) {
        var say = h('input', { type: 'text', maxlength: 300, value: b.say || '', 'aria-label': t('sceneSay') });
        say.addEventListener('input', function () { b.say = say.value; BS.save(); });
        var show = h('input', { type: 'text', maxlength: 240, value: b.show || '', 'aria-label': t('sceneShow') });
        show.addEventListener('input', function () { b.show = show.value; BS.save(); });
        var thumb = h('div.thumb', { style: { aspectRatio: p.ratio[0] + ' / ' + p.ratio[1] } }, h('span.ph', '—'));
        BS.imgGet('img:' + pid + ':' + key + ':b' + i).then(function (v) { if (v) { BS.clear(thumb); thumb.appendChild(h('img', { src: v, alt: '' })); } });
        var g = ui.btn(t('sceneImage'), 'ghost small', function () {
          return ui.run(g, function () {
            return BS.makeImage(b.show || post.image_prompt || b.text, p.ratio).then(function (src) {
              return BS.imgSet('img:' + pid + ':' + key + ':b' + i, src).then(function () { BS.clear(thumb); thumb.appendChild(h('img', { src: src, alt: '' })); });
            });
          });
        });
        tools.insertBefore(g, tools.firstChild);
        body.appendChild(h('label.fld', h('span.lbl', t('sceneSay')), say));
        body.appendChild(h('label.fld', h('span.lbl', t('sceneShow')), show));
        return h('li.scene', thumb, body, tools);
      }
      return h('li.scene.thread', body, tools);
    }
    function redraw() {
      BS.clear(list);
      // images are keyed by scene index; removing a scene shifts them, so drop stale ones
      post.beats.forEach(function (b, i) { list.appendChild(row(b, i)); });
    }
    redraw();
    var add = ui.btn(t('addScene'), 'ghost small', function () { post.beats.push({ text: '', say: '', show: '' }); BS.save(); redraw(); var ta = list.lastChild.querySelector('textarea'); if (ta) ta.focus(); });
    return h('section.ed-sec',
      h('div.ed-sec-head', h('h3', t(kind === 'video' ? 'secScenes' : kind === 'carousel' ? 'secSlides' : 'secThread')), h('p.hint', t(kind === 'video' ? 'secScenesHint' : kind === 'carousel' ? 'secSlidesHint' : 'secThreadHint'))),
      list, h('div.row-tools', add));
  }

  function loadBeatImages(pid, key, post, withCover) {
    return Promise.all(post.beats.map(function (b, i) {
      return BS.imgGet('img:' + pid + ':' + key + ':b' + i).then(function (v) {
        if (!v && i === 0 && withCover) return BS.imgGet('img:' + pid + ':' + key + ':cover');
        return v;
      }).then(function (v) { return v ? BS.loadImage(v).catch(function () { return null; }) : null; });
    }));
  }

  function videoRatio(pid, fid) {
    if (pid === 'youtube' && fid === 'video') return [16, 9];
    if (fid === 'circle') return [1, 1];
    return [9, 16];
  }

  /* ---------- video ---------- */
  function buildVideo(pid, key, post, p) {
    var out = h('div.video-out');
    var prog = h('div.bar', { hidden: true }, h('i'));
    var secs = h('input', { type: 'range', min: 2, max: 4.5, step: 0.1, value: post.secPer || 2.6, 'aria-label': t('secPer') });
    var secsLbl = h('span.fine', t('secPerN', { n: secs.value }));
    secs.addEventListener('input', function () { post.secPer = Number(secs.value); secsLbl.textContent = t('secPerN', { n: secs.value }); BS.save(); });
    var wm = h('input', { type: 'checkbox', id: 'wm', checked: post.watermark !== false, onchange: function () { post.watermark = wm.checked; BS.save(); } });
    var go = ui.btn(t('makeVideo'), 'primary', function () {
      if (!post.beats.some(function (b) { return b.text; })) return BS.toast(t('noScenes'), 'err');
      return ui.run(go, function () {
        BS.clear(out); prog.hidden = false; prog.firstChild.style.width = '0';
        return loadBeatImages(pid, key, post, true).then(function (imgs) {
          var beats = post.beats.map(function (b, i) { return { text: b.text, img: imgs[i] }; });
          return window.BSVideo.render({ beats: beats, ratio: videoRatio(pid, post.format), secPerBeat: Number(secs.value), watermark: wm.checked, onProgress: function (f) { prog.firstChild.style.width = Math.round(f * 100) + '%'; } });
        }).then(function (r) {
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          videoUrl = URL.createObjectURL(r.blob);
          post.video = true; BS.save();
          BS.clear(out);
          var vid = h('video', { src: videoUrl, controls: true, playsinline: true, preload: 'metadata' });
          // MediaRecorder files carry no duration; seeking far forces the browser to compute it so the timeline works.
          vid.addEventListener('loadedmetadata', function () {
            if (vid.duration === Infinity) {
              vid.currentTime = 1e7;
              vid.addEventListener('timeupdate', function back() { vid.removeEventListener('timeupdate', back); vid.currentTime = 0; });
            }
          });
          out.appendChild(vid);
          out.appendChild(h('div.row-tools', ui.btn(t('download') + ' .' + r.ext, 'primary small', function () { BS.download('blogseem-' + pid + '-' + key + '.' + r.ext, r.blob); }),
            h('span.fine', t('videoInfo', { w: r.w, h: r.h, s: Math.round(r.seconds) }))));
        }).catch(function (e) { BS.toast(e && e.message === 'unsupported' ? t('videoUnsupported') : t('videoFail'), 'err'); }).then(function () { prog.hidden = true; });
      });
    });
    if (!window.BSVideo || !window.BSVideo.supported()) { go.disabled = true; out.appendChild(h('p.err-text', t('videoUnsupported'))); }
    return h('section.ed-sec',
      h('div.ed-sec-head', h('h3', t('secVideo')), h('p.hint', t('secVideoHint'))),
      h('div.video-opts', h('label.fld.inline', h('span.lbl', t('secPer')), secs, secsLbl), h('label.check', wm, t('watermark'))),
      h('div.row-tools', go), prog, out, h('p.fine', t('videoKeepOpen')));
  }

  /* ---------- slides ---------- */
  function buildSlides(pid, key, post, p) {
    var grid = h('div.slides');
    var blobs = [];
    var go = ui.btn(t('makeSlides'), 'primary', function () {
      if (!post.beats.some(function (b) { return b.text; })) return BS.toast(t('noScenes'), 'err');
      return ui.run(go, function () {
        BS.clear(grid); blobs = [];
        return loadBeatImages(pid, key, post, true).then(function (imgs) {
          var n = post.beats.length;
          return post.beats.reduce(function (chain, b, i) {
            return chain.then(function () {
              return window.BSVideo.still({ text: b.text, img: imgs[i] }, i, n, p.ratio, { watermark: true }).then(function (blob) {
                blobs.push(blob);
                var url = URL.createObjectURL(blob);
                grid.appendChild(h('button.slide', { type: 'button', title: t('download'), onclick: function () { BS.download('blogseem-' + pid + '-' + key + '-' + (i + 1) + '.png', blob); } }, h('img', { src: url, alt: t('slideN', { n: i + 1 }) })));
              });
            });
          }, Promise.resolve());
        }).then(function () {
          grid.appendChild(ui.btn(t('downloadAll'), 'primary small', function () {
            blobs.forEach(function (bl, i) { setTimeout(function () { BS.download('blogseem-' + pid + '-' + key + '-' + (i + 1) + '.png', bl); }, i * 350); });
          }));
        });
      });
    });
    return h('section.ed-sec', h('div.ed-sec-head', h('h3', t('secSlideFiles')), h('p.hint', t('secSlideFilesHint'))), h('div.row-tools', go), grid);
  }

  /* ---------- Content Lab inside the editor: hook variants and real results ---------- */
  function buildLab(pid, key, post, setCaption) {
    var list = h('div.hook-list');
    var ask = ui.btn(t('hkAsk'), 'primary small', function () {
      var idea = (post.caption || post.topic || '').slice(0, 900);
      return ui.run(ask, function () {
        return BS.api('hooks', Object.assign(BS.ctx(pid), { idea: idea })).then(function (r) {
          BS.clear(list);
          r.variants.forEach(function (v) {
            list.appendChild(h('div.hook',
              h('div', h('span.tag', t('hs_' + v.style)), h('p.strong', v.text), h('p.hint', v.why)),
              ui.btn(t('hkUse'), 'ghost small', function () {
                var lines = (post.caption || '').split('\n'), i = 0;
                while (i < lines.length && !lines[i].trim()) i++;
                lines[i] = v.text; post.hookStyle = v.style; style.value = v.style;
                setCaption(lines.join('\n'), t('hkApplied', { s: t('hs_' + v.style) }));
              })));
          });
        });
      });
    });
    var r0 = post.result || {};
    function num(label, val) {
      var i = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: val == null ? '' : val, 'aria-label': label });
      return { el: h('label.fld', h('span.lbl', label), i), i: i };
    }
    var v = num(t('resViews'), r0.views), l = num(t('resLikes'), r0.likes), c = num(t('resComments'), r0.comments), sv = num(t('resSaves'), r0.saves);
    var style = h('select', { 'aria-label': t('resStyle') }, h('option', { value: '' }, t('hs_none')),
      BS.hookStyles.map(function (k) { return h('option', { value: k, selected: k === (r0.style || post.hookStyle) }, t('hs_' + k)); }));
    var sum = h('p.fine', r0.views ? t('resSummary', { e: ((r0.likes + r0.comments + r0.saves) / r0.views * 100).toFixed(1) }) : '');
    var save = ui.btn(t('resSave'), 'primary small', function () {
      var views = Number(v.i.value), likes = Number(l.i.value) || 0, comments = Number(c.i.value) || 0, saves = Number(sv.i.value) || 0;
      if (!(views > 0)) return BS.toast(t('resErrViews'), 'err');
      if (likes < 0 || comments < 0 || saves < 0 || likes + comments + saves > views) return BS.toast(t('resErrSum'), 'err');
      post.result = { views: views, likes: likes, comments: comments, saves: saves, style: style.value, at: Date.now() };
      BS.save(); BS.toast(t('resSaved')); sum.textContent = t('resSummary', { e: ((likes + comments + saves) / views * 100).toFixed(1) });
    });
    return h('section.ed-sec',
      h('div.ed-sec-head', h('h3', t('secLab')), h('p.hint', t('secLabHint'))),
      h('h4.mini', t('hkTitle')), h('div.row-tools', ask), list,
      h('h4.mini', t('resTitle')), h('p.hint', t('resHint')),
      h('div.res-grid', v.el, l.el, c.el, sv.el, h('label.fld', h('span.lbl', t('resStyle')), style)),
      h('div.row-tools', save), sum);
  }

  function buildThread(post) {
    var copy = ui.btn(t('copyThread'), 'primary small', function () {
      BS.copy(post.beats.map(function (b, i) { return (i + 1) + '/' + post.beats.length + '\n' + b.text; }).join('\n\n'));
    });
    return h('section.ed-sec', h('div.ed-sec-head', h('h3', t('secThreadOut'))), h('div.row-tools', copy));
  }
})();
