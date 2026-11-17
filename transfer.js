// Generate / Send / Receive switch. Send and Receive are the Decimen Optical
// Transfer pages in decimen/, each loaded into an iframe the first time it is
// opened. The URL hash (#send, #receive) keeps a mode linkable.
(function () {
  var buttons = document.querySelectorAll('#modeSeg button');
  var generator = document.getElementById('generator');
  var transfer = document.getElementById('transfer');
  var frames = {
    send: document.getElementById('sendFrame'),
    receive: document.getElementById('receiveFrame')
  };
  var current = null;
  var fullObserver = null;

  function modeFromHash() {
    var mode = location.hash.slice(1);
    return frames[mode] ? mode : 'generate';
  }

  // location.replace, not src: changing src after the first load adds a
  // history entry, and Back would then navigate the hidden frame instead of
  // switching the mode.
  function load(frame) {
    if (frame.dataset.loaded === '1') return;
    frame.dataset.loaded = '1';
    frame.contentWindow.location.replace(new URL(frame.dataset.src, location.href).href);
  }

  // The receiver keeps its camera running while hidden, so leaving Receive
  // unloads it, which turns the camera off.
  function unload(frame) {
    if (frame.dataset.loaded !== '1') return;
    frame.dataset.loaded = '';
    frame.contentWindow.location.replace('about:blank');
  }

  function frameBody(frame) {
    try {
      return frame.contentDocument && frame.contentDocument.body;
    } catch (e) {
      return null; // not same-origin, e.g. index.html opened from disk
    }
  }

  // Tapping the code on the sender adds .qr-full to its body and fills its own
  // viewport. Mirroring it lets the frame cover the whole window.
  function syncFull() {
    var body = current === 'send' ? frameBody(frames.send) : null;
    document.body.classList.toggle('transfer-full', !!(body && body.classList.contains('qr-full')));
  }

  frames.send.addEventListener('load', function () {
    if (fullObserver) fullObserver.disconnect();
    var body = frameBody(frames.send);
    if (body) {
      fullObserver = new MutationObserver(syncFull);
      fullObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
    }
    syncFull();
  });

  // CSS sizes the panel to the window below this offset (see .transfer).
  function measure() {
    if (transfer.hidden || document.body.classList.contains('transfer-full')) return;
    var top = transfer.getBoundingClientRect().top + window.scrollY;
    transfer.style.setProperty('--transfer-top', Math.round(top) + 'px');
  }

  function setMode(mode) {
    if (mode === current) return;
    current = mode;
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    generator.hidden = mode !== 'generate';
    transfer.hidden = mode === 'generate';
    transfer.classList.toggle('is-send', mode === 'send'); // full-height panel, see style.css
    if (mode !== 'receive') unload(frames.receive);
    Object.keys(frames).forEach(function (key) {
      frames[key].hidden = key !== mode;
    });
    if (frames[mode]) {
      load(frames[mode]);
      measure();
    }
    syncFull();
    // The QR preview sizes itself on resize, and it measured nothing while hidden.
    if (mode === 'generate') window.dispatchEvent(new Event('resize'));
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.dataset.mode;
      if (mode === current) return;
      history.pushState(null, '', mode === 'generate' ? location.pathname + location.search : '#' + mode);
      setMode(mode);
    });
  });

  window.addEventListener('popstate', function () { setMode(modeFromHash()); });
  window.addEventListener('hashchange', function () { setMode(modeFromHash()); });
  window.addEventListener('resize', measure);
  if (document.fonts) document.fonts.ready.then(measure); // Poppins can change the header height

  setMode(modeFromHash());
})();
