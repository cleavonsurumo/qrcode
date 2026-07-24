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
  var segButtons = document.querySelectorAll('.seg button');

  var state = { ec: 'M', qr: null, moduleCount: 0 };
  var QUIET = 4; // quiet-zone modules per side (spec minimum)

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
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="' + bgColor.value + '"/>');
    parts.push('<path fill="' + fgColor.value + '" d="');
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          parts.push('M' + (c + QUIET) + ' ' + (r + QUIET) + 'h1v1h-1z');
        }
      }
    }
    parts.push('"/></svg>');
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
