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

  var state = { ec: 'M', style: 'dots', qr: null, moduleCount: 0, icon: null, iconHost: '' };
  var QUIET = 4; // quiet-zone modules per side (spec minimum)
  var FINDER = 7; // finder patterns are 7x7 modules, one per corner except bottom-right
  // icon.horse sends CORS headers; without them the favicon would taint the
  // canvas and PNG download / copy would throw.
  var ICON_SRC = 'https://icon.horse/icon/';
  var ICON_DELAY = 400; // ms of typing pause before a domain is looked up
  var LOGO_PAD = 0.5; // modules of clear space between the icon and the data around it
  var iconCache = Object.create(null); // host -> square canvas, or null if the site has none
  var iconTimer;

  // http(s) URLs and bare domains such as youtube.com/watch?v=…
  var LINK_RE = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[\/?#]\S*)?$/i;

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

  // --- Site icon for links ---
  function linkHost(text) {
    var m = LINK_RE.exec(text.trim());
    return m ? m[1].toLowerCase() : '';
  }

  function setIconHost(host) {
    if (host === state.iconHost) return;
    clearTimeout(iconTimer);
    state.iconHost = host;
    state.icon = iconCache[host] || null;
    if (host && !(host in iconCache)) {
      iconTimer = setTimeout(function () { loadIcon(host); }, ICON_DELAY);
    }
  }

  function loadIcon(host) {
    iconCache[host] = null; // reserve so a quick switch back doesn't refetch
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      iconCache[host] = iconFromImage(img);
      if (state.iconHost === host) {
        state.icon = iconCache[host];
        if (state.qr) renderPreview();
      }
    };
    img.src = ICON_SRC + encodeURIComponent(host);
  }

  // Copies the favicon onto a square canvas, or returns null when it is only
  // icon.horse's placeholder for sites without one.
  function iconFromImage(img) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (!w || !h) return null;
    var side = Math.max(w, h);
    var c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, (side - w) / 2, (side - h) / 2);
    if (side === 256 && isLetterTile(ctx.getImageData(0, 0, side, side).data)) return null;
    return c;
  }

  // icon.horse answers unknown domains with a grey letter on a flat #E2E2E2
  // 256px tile (status 200, not 404), so recognise it by its pixels.
  function isLetterTile(px) {
    if (Math.abs(px[0] - 226) > 3 || px[3] !== 255) return false;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] !== 255 || Math.abs(px[i] - px[i + 1]) > 2 || Math.abs(px[i + 1] - px[i + 2]) > 2) return false;
    }
    return true;
  }

  // Centre square of modules left blank for the icon, or null. Blanked modules
  // are damage the error correction must repair, so the square grows with the
  // EC level. The shares were measured by decoding v1-v40 codes with the centre
  // blanked: they keep the square to about half the area that stops a decode.
  // The -2 matters for small codes, where finder patterns crowd out the data.
  var LOGO_SHARE = { L: 0.19, M: 0.25, Q: 0.26, H: 0.31 };

  function logoBox(count) {
    if (!state.icon) return null;
    var n = Math.floor(count * LOGO_SHARE[state.ec] - 2);
    if (n % 2 === 0) n--; // odd, so the square centres on the module grid
    if (n < 3) return null;
    return { start: (count - n) / 2, size: n };
  }

  function inLogo(box, r, c) {
    return box !== null &&
           r >= box.start && r < box.start + box.size &&
           c >= box.start && c < box.start + box.size;
  }

  function drawLogo(ctx, box, scale) {
    var xy = (box.start + QUIET + LOGO_PAD) * scale;
    var s = (box.size - LOGO_PAD * 2) * scale;
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, xy, xy, s, s, s * 0.2);
    ctx.clip();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.icon, xy, xy, s, s);
    ctx.restore();
  }

  function build() {
    var text = input.value;
    charCount.textContent = text.length + (text.length === 1 ? ' char' : ' chars');
    inputError.textContent = '';
    setIconHost(linkHost(text));

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

  function drawSquares(ctx, qr, count, scale, box) {
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c) && !inLogo(box, r, c)) {
          // ceil the edges slightly so modules never leave hairline gaps
          var x = Math.floor((c + QUIET) * scale);
          var y = Math.floor((r + QUIET) * scale);
          var s = Math.ceil(scale);
          ctx.fillRect(x, y, s, s);
        }
      }
    }
  }

  function drawDots(ctx, qr, count, scale, box) {
    var rad = scale / 2;
    ctx.beginPath();
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c) && !isFinder(r, c, count) && !inLogo(box, r, c)) {
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
    var box = logoBox(count);
    var ctx = target.getContext('2d');
    ctx.fillStyle = bgColor.value;
    ctx.fillRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = fgColor.value;
    if (state.style === 'dots') drawDots(ctx, qr, count, scale, box);
    else drawSquares(ctx, qr, count, scale, box);
    if (box) drawLogo(ctx, box, scale);
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
    var box = logoBox(count);
    var fg = fgColor.value;
    var parts = [];
    // crispEdges keeps square modules sharp, but would alias the dot outlines
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '"' +
               (dots ? '' : ' shape-rendering="crispEdges"') + '>');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="' + bgColor.value + '"/>');
    parts.push('<path fill="' + fg + '" d="');
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c) || inLogo(box, r, c)) continue;
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

    if (box) {
      var xy = box.start + QUIET + LOGO_PAD;
      var s = box.size - LOGO_PAD * 2;
      var dims = ' x="' + xy + '" y="' + xy + '" width="' + s + '" height="' + s + '"';
      parts.push('<clipPath id="logo"><rect' + dims + ' rx="' + s * 0.2 + '"/></clipPath>');
      parts.push('<image' + dims + ' clip-path="url(#logo)" href="' + state.icon.toDataURL('image/png') + '"/>');
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
