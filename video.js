/* BlogSeem video builder: turns a script (beats) into a captioned video entirely in the browser.
   Canvas + MediaRecorder, no server, no cost. Output is silent: the creator adds voice or music in the app they publish from. */
(function (root) {
  'use strict';

  var PALETTES = [['#3B2CF0', '#8F6BFF'], ['#15131F', '#3B2CF0'], ['#E8483C', '#FF9A5C'], ['#0B7F86', '#3B2CF0'], ['#2A1B6E', '#E8483C']];
  var INK = '#15131F', LEMON = '#F6E94B';

  function pickMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    var list = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (var i = 0; i < list.length; i++) {
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) { /* next */ }
    }
    return '';
  }

  function size(ratio) {
    var rw = ratio[0], rh = ratio[1];
    var r = rw / rh;
    var long = r > 0.9 && r < 1.1 ? 960 : 1280;
    var w, h;
    if (r >= 1) { w = long; h = Math.round(long / r); } else { h = long; w = Math.round(long * r); }
    return { w: w - (w % 2), h: h - (h % 2) };
  }

  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }

  function coverDraw(ctx, img, W, H, zoom, dx, dy) {
    var s = Math.max(W / img.width, H / img.height) * zoom;
    var w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (W - w) / 2 + dx * W, (H - h) / 2 + dy * H, w, h);
  }

  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = [];
    words.forEach(function (w) {
      var test = cur.concat(w).join(' ');
      if (cur.length && ctx.measureText(test).width > maxW) { lines.push(cur); cur = [w]; } else cur.push(w);
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  function drawBackground(ctx, W, H, beat, i, u) {
    var pal = PALETTES[i % PALETTES.length];
    if (beat.img) {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
      var dir = i % 2 ? -1 : 1;
      coverDraw(ctx, beat.img, W, H, 1.04 + 0.1 * u, dir * 0.02 * u, -0.015 * u);
      var g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, 'rgba(21,19,31,0)'); g.addColorStop(1, 'rgba(21,19,31,.78)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    var g2 = ctx.createLinearGradient(0, 0, W, H);
    g2.addColorStop(0, pal[0]); g2.addColorStop(1, pal[1]);
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    // slow drifting circles keep a text-only scene alive
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff';
    var R = Math.min(W, H);
    ctx.beginPath(); ctx.arc(W * (0.2 + 0.25 * u), H * (0.25 + 0.08 * Math.sin(u * 3 + i)), R * 0.32, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.arc(W * (0.85 - 0.2 * u), H * (0.78 - 0.1 * u), R * 0.42, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawCaption(ctx, W, H, text, u, fontFamily) {
    var vertical = H >= W;
    var fs = Math.round((vertical ? W : H) * (vertical ? 0.072 : 0.082));
    ctx.font = '700 ' + fs + 'px ' + fontFamily;
    ctx.textBaseline = 'middle';
    var lines = wrap(ctx, text, W * 0.8);
    var lh = fs * 1.55;
    var total = lines.length * lh;
    var top = vertical ? H * 0.62 - total / 2 : H * 0.7 - total / 2;
    var words = lines.reduce(function (n, l) { return n + l.length; }, 0);
    var shown = Math.ceil(words * ease(u / 0.5));
    var count = 0;
    var space = ctx.measureText(' ').width, padX = fs * 0.34;
    lines.forEach(function (ln, li) {
      var take = Math.max(0, Math.min(ln.length, shown - count));
      count += ln.length;
      if (!take) return;
      var full = ln.join(' ');
      var fullW = ctx.measureText(full).width;
      var part = ln.slice(0, take).join(' ');
      var partW = ctx.measureText(part).width;
      var x0 = (W - fullW) / 2, y = top + li * lh + lh / 2;
      var lift = (1 - ease((u - li * 0.06) / 0.18)) * fs * 0.4;
      ctx.fillStyle = LEMON;
      ctx.fillRect(x0 - padX, y - fs * 0.78 + lift, partW + padX * 2 - (take < ln.length ? 0 : 0), fs * 1.56);
      ctx.fillStyle = INK; ctx.textAlign = 'left';
      ctx.fillText(part, x0, y + lift);
    });
    void space;
  }

  function drawChrome(ctx, W, H, n, i, u, watermark, fontFamily) {
    var gap = W * 0.012, barH = Math.max(4, H * 0.005), x = W * 0.05, bw = (W * 0.9 - gap * (n - 1)) / n, y = H * 0.035;
    for (var k = 0; k < n; k++) {
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + k * (bw + gap), y, bw, barH);
      var f = k < i ? 1 : k === i ? u : 0;
      if (f > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + k * (bw + gap), y, bw * f, barH); }
    }
    if (watermark) {
      ctx.font = '700 ' + Math.round(Math.min(W, H) * 0.032) + 'px ' + fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.fillText('BlogSeem', W / 2, H * 0.955);
    }
  }

  function frame(ctx, W, H, beats, secPer, t, opts, fontFamily) {
    var n = beats.length;
    var i = Math.min(n - 1, Math.floor(t / secPer));
    var u = Math.min(1, (t - i * secPer) / secPer);
    drawBackground(ctx, W, H, beats[i], i, u);
    drawCaption(ctx, W, H, beats[i].text, u, fontFamily);
    drawChrome(ctx, W, H, n, i, u, opts.watermark !== false, fontFamily);
    if (i > 0 && u * secPer < 0.3) { // wipe between scenes
      var p = ease(u * secPer / 0.3);
      ctx.fillStyle = INK; ctx.fillRect(-W * p, 0, W, H);
    }
  }

  function supported() { return !!(pickMime() !== null && document.createElement('canvas').captureStream); }

  /* opts: {beats:[{text, img?:HTMLImageElement}], ratio:[w,h], secPerBeat, watermark, onProgress(0..1), fontFamily} */
  function render(opts) {
    return new Promise(function (resolve, reject) {
      var mime = pickMime();
      var beats = (opts.beats || []).filter(function (b) { return b && b.text; });
      if (mime === null || !beats.length) return reject(new Error(beats.length ? 'unsupported' : 'empty'));
      var d = size(opts.ratio || [9, 16]);
      var canvas = document.createElement('canvas');
      canvas.width = d.w; canvas.height = d.h;
      var ctx = canvas.getContext('2d');
      var fam = opts.fontFamily || 'Unbounded, "Arial Black", Arial, sans-serif';
      var secPer = opts.secPerBeat || 2.6, total = secPer * beats.length;
      var stream = canvas.captureStream(30), chunks = [];
      var rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : { videoBitsPerSecond: 5e6 }); } catch (e) { return reject(e); }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { reject(e.error || new Error('record')); };
      rec.onstop = function () {
        var type = rec.mimeType || mime || 'video/webm';
        resolve({ blob: new Blob(chunks, { type: type }), ext: /mp4/.test(type) ? 'mp4' : 'webm', w: d.w, h: d.h, seconds: total });
      };
      var start = null;
      function tick(now) {
        if (start === null) { start = now; rec.start(250); }
        var t = (now - start) / 1000;
        frame(ctx, d.w, d.h, beats, secPer, Math.min(t, total - 0.001), opts, fam);
        if (opts.onProgress) opts.onProgress(Math.min(1, t / total));
        if (t < total) requestAnimationFrame(tick);
        else setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, 200);
      }
      var go = function () { requestAnimationFrame(tick); };
      if (document.fonts && document.fonts.load) document.fonts.load('700 40px Unbounded').then(go, go); else go();
    });
  }

  /* One finished slide as PNG (for carousels). */
  function still(beat, i, n, ratio, opts) {
    var d = size(ratio || [4, 5]);
    var c = document.createElement('canvas'); c.width = d.w; c.height = d.h;
    var ctx = c.getContext('2d');
    frame(ctx, d.w, d.h, [{ text: beat.text, img: beat.img }], 1, 0.999, { watermark: !opts || opts.watermark !== false }, (opts && opts.fontFamily) || 'Unbounded, "Arial Black", Arial, sans-serif');
    return new Promise(function (res) { c.toBlob(res, 'image/png'); });
  }

  root.BSVideo = { render: render, supported: supported, size: size, still: still };
})(window);
