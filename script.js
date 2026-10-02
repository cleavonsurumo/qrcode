(function () {
  var input = document.getElementById('qrInput');
  var charCount = document.getElementById('charCount');
  var inputError = document.getElementById('inputError');
  var canvas = document.getElementById('qrCanvas');
  var frame = document.getElementById('qrFrame');
  var qrMeta = document.getElementById('qrMeta');
  var fgColor = document.getElementById('fgColor');
  var bgColor = document.getElementById('bgColor');
  var fgHex = document.getElementById('fgHex');
  var bgHex = document.getElementById('bgHex');
  var dlSize = document.getElementById('dlSize');
  var dlPng = document.getElementById('dlPng');
  var dlSvg = document.getElementById('dlSvg');
  var copyPng = document.getElementById('copyPng');
  var segButtons = document.querySelectorAll('#ecSeg button');
  var styleButtons = document.querySelectorAll('#styleSeg button');

  var state = { ec: 'M', style: 'square', qr: null, moduleCount: 0 };
  var QUIET = 4; // quiet-zone modules per side (spec minimum)
  var FINDER = 7; // finder patterns are 7x7 modules, one per corner except bottom-right

  // Finder patterns stay solid in dots mode: scanners locate a code by the
  // 1:1:3:1:1 dark/light ratio across these blocks, which rounding would break.
  function isFinder(r, c, count) {
    return (r < FINDER && c < FINDER) ||
           (r < FINDER && c >= count - FINDER) ||
           (r >= count - FINDER && c < FINDER);
  }

  function finderOrigins(count) {
    return [[0, 0], [0, count - FINDER], [count - FINDER, 0]];
  }

  function build() {
    var text = input.value;
    charCount.textContent = text.length + (text.length === 1 ? ' char' : ' chars');
    inputError.textContent = '';

    if (!text.trim()) {
      state.qr = null;
      frame.classList.remove('has-code');
      qrMeta.textContent = '';
      setButtons(false);
      return;
    }

    try {
      var qr = qrcode(0, state.ec); // type 0 = auto-size
      qr.addData(text);
      qr.make();
      state.qr = qr;
      state.moduleCount = qr.getModuleCount();
      frame.classList.add('has-code');
      qrMeta.textContent = state.moduleCount + '\u00D7' + state.moduleCount + ' modules \u00B7 EC ' + state.ec;
      renderPreview();
      setButtons(true);
    } catch (e) {
      state.qr = null;
      frame.classList.remove('has-code');
      qrMeta.textContent = '';
      inputError.textContent = 'Too long for one QR code \u2014 shorten it or lower error correction';
      setButtons(false);
    }
  }

  function setButtons(enabled) {
    dlPng.disabled = !enabled;
    dlSvg.disabled = !enabled;
    copyPng.disabled = !enabled || typeof ClipboardItem === 'undefined';
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawSquares(ctx, qr, count, scale) {
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          // ceil the edges slightly so modules never leave hairline gaps
          var x = Math.floor((c + QUIET) * scale);
          var y = Math.floor((r + QUIET) * scale);
          var s = Math.ceil(scale);
          ctx.fillRect(x, y, s, s);
        }
      }
    }
  }

  function drawDots(ctx, qr, count, scale) {
    var rad = scale / 2;
    ctx.beginPath();
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c) && !isFinder(r, c, count)) {
          var cx = (c + QUIET + 0.5) * scale;
          var cy = (r + QUIET + 0.5) * scale;
          ctx.moveTo(cx + rad, cy);
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        }
      }
    }
    ctx.fill();

    finderOrigins(count).forEach(function (o) {
      var x = (o[1] + QUIET) * scale;
      var y = (o[0] + QUIET) * scale;
      // outer ring: 7x7 rounded square with the inner 5x5 punched out
      ctx.beginPath();
      roundRectPath(ctx, x, y, 7 * scale, 7 * scale, 2 * scale);
      roundRectPath(ctx, x + scale, y + scale, 5 * scale, 5 * scale, scale);
      ctx.fill('evenodd');
      // solid 3x3 eye
      ctx.beginPath();
      roundRectPath(ctx, x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale, scale);
      ctx.fill();
    });
  }

  function drawToCanvas(target, sizePx) {
    var qr = state.qr;
    var count = state.moduleCount;
    var total = count + QUIET * 2;
    var scale = sizePx / total;
    target.width = sizePx;
    target.height = sizePx;
    var ctx = target.getContext('2d');
    ctx.fillStyle = bgColor.value;
    ctx.fillRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = fgColor.value;
    if (state.style === 'dots') drawDots(ctx, qr, count, scale);
    else drawSquares(ctx, qr, count, scale);
  }

  function renderPreview() {
    if (!state.qr) return;
    var displaySize = frame.clientWidth || 320;
    var dpr = window.devicePixelRatio || 1;
    drawToCanvas(canvas, Math.round(displaySize * dpr));
  }

  function buildSvg() {
    var qr = state.qr;
    var count = state.moduleCount;
    var total = count + QUIET * 2;
    var dots = state.style === 'dots';
    var fg = fgColor.value;
    var parts = [];
    // crispEdges keeps square modules sharp, but would alias the dot outlines
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '"' +
               (dots ? '' : ' shape-rendering="crispEdges"') + '>');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="' + bgColor.value + '"/>');
    parts.push('<path fill="' + fg + '" d="');
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        if (dots) {
          if (isFinder(r, c, count)) continue;
          // circle of radius 0.5 centred in the module, as two half-arcs
          parts.push('M' + (c + QUIET) + ' ' + (r + QUIET + 0.5) +
                     'a.5.5 0 1 0 1 0a.5.5 0 1 0-1 0');
        } else {
          parts.push('M' + (c + QUIET) + ' ' + (r + QUIET) + 'h1v1h-1z');
        }
      }
    }
    parts.push('"/>');

    if (dots) {
      finderOrigins(count).forEach(function (o) {
        var x = o[1] + QUIET;
        var y = o[0] + QUIET;
        parts.push('<rect x="' + x + '" y="' + y + '" width="7" height="7" rx="2" fill="' + fg + '"/>');
        parts.push('<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" rx="1" fill="' + bgColor.value + '"/>');
        parts.push('<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="1" fill="' + fg + '"/>');
      });
    }

    parts.push('</svg>');
    return parts.join('');
  }

  function download(href, filename) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function exportCanvas() {
    var off = document.createElement('canvas');
    drawToCanvas(off, parseInt(dlSize.value, 10));
    return off;
  }

  // --- Events ---
  input.addEventListener('input', build);

  segButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      segButtons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      state.ec = btn.dataset.ec;
      build();
    });
  });

  styleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      styleButtons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      state.style = btn.dataset.style;
      if (state.qr) renderPreview();
    });
  });

  fgColor.addEventListener('input', function () { fgHex.textContent = fgColor.value.toUpperCase(); if (state.qr) renderPreview(); });
  bgColor.addEventListener('input', function () { bgHex.textContent = bgColor.value.toUpperCase(); if (state.qr) renderPreview(); });

  dlPng.addEventListener('click', function () {
    if (!state.qr) return;
    download(exportCanvas().toDataURL('image/png'), 'qr-code.png');
  });

  dlSvg.addEventListener('click', function () {
    if (!state.qr) return;
    var blob = new Blob([buildSvg()], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    download(url, 'qr-code.svg');
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  copyPng.addEventListener('click', function () {
    if (!state.qr) return;
    exportCanvas().toBlob(function (blob) {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
        copyPng.textContent = 'Copied \u2713';
        setTimeout(function () { copyPng.textContent = 'Copy image'; }, 1500);
      }).catch(function () {
        copyPng.textContent = 'Copy failed';
        setTimeout(function () { copyPng.textContent = 'Copy image'; }, 1500);
      });
    });
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderPreview, 120);
  });
})();
